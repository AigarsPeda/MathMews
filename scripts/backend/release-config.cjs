// Called by Expo config for store builds. Placeholder values must fail the build.
function validateStoreConfig(env, platform) {
  const missing = [];
  const configured = value => typeof value === 'string' && value.trim() && !/TODO|REPLACE|<|>/.test(value);
  if (!configured(env.EXPO_PUBLIC_SUPABASE_URL) || !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(env.EXPO_PUBLIC_SUPABASE_URL)) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!configured(env.EXPO_PUBLIC_SUPABASE_ANON_KEY)) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if ((!platform || platform === 'ios') && !/^appl_\w+$/.test(env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '')) missing.push('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY (Apple app key, appl_...)');
  if ((!platform || platform === 'android') && !/^goog_\w+$/.test(env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '')) missing.push('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY (Google app key, goog_...)');
  if ((!platform || platform === 'ios') && env.EXPO_PUBLIC_APPLE_AUTH_ENABLED !== 'true') missing.push('EXPO_PUBLIC_APPLE_AUTH_ENABLED (configure and test account recovery first)');
  if ((!platform || platform === 'android') && env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED !== 'true') missing.push('EXPO_PUBLIC_GOOGLE_AUTH_ENABLED (configure and test account recovery first)');
  if (!['sandbox','production'].includes(env.EXPO_PUBLIC_APP_ENVIRONMENT)) missing.push('EXPO_PUBLIC_APP_ENVIRONMENT');
  if (!configured(env.EXPO_PUBLIC_PUBLISHER_NAME)) missing.push('EXPO_PUBLIC_PUBLISHER_NAME (confirmed legal publisher)');
  if (!configured(env.EXPO_PUBLIC_SUPPORT_EMAIL) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.EXPO_PUBLIC_SUPPORT_EMAIL)) missing.push('EXPO_PUBLIC_SUPPORT_EMAIL');
  for (const field of ['EXPO_PUBLIC_PRIVACY_POLICY_URL','EXPO_PUBLIC_SUPPORT_URL','EXPO_PUBLIC_ACCOUNT_DELETION_URL']) {
    let valid=false;
    try { const url=new URL(env[field]); valid=configured(env[field]) && url.protocol==='https:' && !/localhost|\.invalid$|\.example$/.test(url.hostname) && !url.username && !url.password; } catch {}
    if (!valid) missing.push(field+' (published HTTPS page)');
  }
  if (missing.length) throw new Error(`Store build configuration is incomplete: ${missing.join(', ')}. Fill the commented placeholders in .env for local builds and set the same public values in the EAS build environment. Never add database passwords or webhook secrets to EXPO_PUBLIC variables.`);
}
module.exports = { validateStoreConfig };
