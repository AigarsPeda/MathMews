type StoredEvent = Record<string, string | number | null>;
type PersistResult = { state: string; reason?: string; duplicate?: boolean; credited_delta?: number };

export type WebhookDependencies = {
  authorization: string;
  persist: (event: StoredEvent) => Promise<PersistResult>;
};

const MAX_BODY_BYTES = 64 * 1024;
const STRING_FIELDS = [
  'id', 'type', 'app_id', 'app_user_id', 'store', 'environment',
  'transaction_id', 'product_id', 'cancel_reason',
] as const;

async function sameSecret(actual: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([actual, expected].map(value =>
    crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

async function readBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty body');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) throw new RangeError('Body too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(body);
}

function normalizeEvent(body: unknown): StoredEvent {
  if (!body || typeof body !== 'object' || !('event' in body)) throw new Error('Missing event');
  const event = body.event;
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('Invalid event');
  const source = event as Record<string, unknown>;
  const normalized: StoredEvent = {};
  for (const field of STRING_FIELDS) {
    const value = source[field];
    if (value != null && (typeof value !== 'string' || value.length > 200)) throw new Error('Invalid field');
    normalized[field] = value == null ? null : value as string;
  }
  if (!normalized.id || !normalized.type) throw new Error('Missing event identity');
  const timestamp = source.event_timestamp_ms;
  if (timestamp != null && (typeof timestamp !== 'number' || !Number.isSafeInteger(timestamp) || timestamp < 0)) {
    throw new Error('Invalid event timestamp');
  }
  normalized.event_timestamp_ms = timestamp == null ? null : timestamp as number;
  // Do not persist subscriber attributes, email, IP, advertising IDs, or raw receipts.
  return normalized;
}

// The credential remains an exact secret match. Bearer is an optional HTTP
// scheme label, and HTTP trims surrounding whitespace from header values.
function credential(value: string): string {
  return value.trim().replace(/^Bearer\s+/i, '');
}

export function createRevenueCatWebhook(dependencies: WebhookDependencies) {
  const expected = credential(dependencies.authorization);
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
    if (expected.length < 32) return Response.json({ error: 'Webhook is not configured' }, { status: 503 });
    if (!await sameSecret(credential(request.headers.get('authorization') ?? ''), expected)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
      return Response.json({ error: 'Body too large' }, { status: 413 });
    }
    let event: StoredEvent;
    try {
      event = normalizeEvent(JSON.parse(await readBody(request)));
    } catch (error) {
      return Response.json({ error: error instanceof RangeError ? 'Body too large' : 'Invalid event' },
        { status: error instanceof RangeError ? 413 : 400 });
    }
    try {
      // Return success only after the database transaction durably accepts the event.
      // Quarantined events are retained for operator review, not silently dropped.
      return Response.json(await dependencies.persist(event));
    } catch {
      // Do not log credentials or purchase payloads. RevenueCat retries non-2xx responses.
      return Response.json({ error: 'Event could not be persisted' }, { status: 503 });
    }
  };
}
