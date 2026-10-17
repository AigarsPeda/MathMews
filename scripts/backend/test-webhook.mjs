import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { Buffer } from 'node:buffer';
import ts from 'typescript';

const source = await fs.readFile('supabase/functions/revenuecat-webhook/handler.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { createRevenueCatWebhook } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const authorization = 'Bearer unit-test-only-secret-abcdefghijklmnopqrstuvwxyz';
const event = { id: 'event-1', type: 'NON_RENEWING_PURCHASE', app_id: 'app_apple',
  app_user_id: '10000000-0000-4000-8000-000000000001', transaction_id: 'transaction-1',
  product_id: 'mathmews_coins_100', store: 'APP_STORE', environment: 'SANDBOX', event_timestamp_ms: 1000 };
const request = (body = { event }, header = authorization) => new Request('https://example.invalid/webhook', {
  method: 'POST', headers: { authorization: header, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('authenticates before accepting events and fails closed on missing configuration', async () => {
  let calls = 0;
  const persist = async () => { calls++; return { state: 'processed' }; };
  const handler = createRevenueCatWebhook({ authorization, persist });
  assert.equal((await handler(request({}, 'wrong'))).status, 401);
  assert.equal((await handler(new Request('https://example.invalid/'))).status, 405);
  assert.equal((await createRevenueCatWebhook({ authorization: '', persist })(request())).status, 503);
  assert.equal(calls, 0);
});

test('rejects malformed and oversized events without calling the database', async () => {
  const handler = createRevenueCatWebhook({ authorization, persist: async () => { throw new Error('Must not be called'); } });
  for (const body of [{}, { event: [] }, { event: { ...event, id: '' } }, { event: { ...event, event_timestamp_ms: 1.5 } }, { event: { ...event, product_id: 100 } }]) {
    assert.equal((await handler(request(body))).status, 400);
  }
  assert.equal((await handler(request({ event, padding: 'x'.repeat(65536) }))).status, 413);
});

test('persists only required purchase fields, not subscriber personal data', async () => {
  let captured;
  const handler = createRevenueCatWebhook({ authorization, persist: async value => { captured = value; return { state: 'processed', credited_delta: 100 }; } });
  const response = await handler(request({ event: { ...event, subscriber_attributes: { email: 'private@example.invalid' }, aliases: ['legacy'], ip: '127.0.0.1' } }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).credited_delta, 100);
  assert.deepEqual(captured, { ...event, cancel_reason: null });
});

test('acknowledges quarantine only after persistence and makes database failures retryable', async () => {
  const broken = createRevenueCatWebhook({ authorization, persist: async () => { throw new Error('secret connection detail'); } });
  const response = await broken(request());
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('secret connection'), false);
  const quarantined = createRevenueCatWebhook({ authorization, persist: async () => ({ state: 'quarantined', reason: 'unmapped_customer' }) });
  assert.equal((await quarantined(request())).status, 200);
});


test('accepts the same strong credential with optional Bearer scheme and surrounding whitespace', async () => {
  const secret='same-strong-random-secret-abcdefghijklmnopqrstuvwxyz';
  for (const configured of [secret,` Bearer ${secret} `]) {
    const handler=createRevenueCatWebhook({authorization:configured,persist:async()=>({state:'ignored'})});
    for (const sent of [secret,`Bearer ${secret}`,`bearer ${secret}`]) assert.equal((await handler(request({event},sent))).status,200);
    assert.equal((await handler(request({event},`${secret}-wrong`))).status,401);
  }
  const weak=createRevenueCatWebhook({authorization:'Bearer '+ 'a'.repeat(25),persist:async()=>({state:'ignored'})});
  assert.equal((await weak(request())).status,503,'The Bearer label does not count toward secret length');
});
