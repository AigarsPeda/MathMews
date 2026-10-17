export type WalletEnvironment = 'sandbox' | 'production';

// Development uses the hosted sandbox rows in the same Supabase project.
// TestFlight / Play license-testing builds explicitly select sandbox; the
// production EAS profile pins production. Node content tools default to dev.
export function getWalletEnvironment(): WalletEnvironment {
  if (typeof __DEV__ === 'undefined' || __DEV__) return 'sandbox';
  return process.env.EXPO_PUBLIC_APP_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production';
}
