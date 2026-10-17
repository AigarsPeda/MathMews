import { createRevenueCatWebhook } from './handler.ts';

// This entry point runs in Supabase's Deno runtime. The pure handler is also
// exercised by the Node backend suite without requiring a Deno installation.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

Deno.serve(createRevenueCatWebhook({
  authorization: Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION') ?? '',
  async persist(event) {
    if (!supabaseUrl || !serviceKey) throw new Error('Missing backend configuration');
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/record_revenuecat_event`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_event: event }),
    });
    if (!response.ok) throw new Error('Database rejected event');
    return await response.json();
  },
}));
