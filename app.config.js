/** @type {import('expo/config').ExpoConfig} */
const { validateStoreConfig } = require('./scripts/backend/release-config.cjs');
module.exports = ({ config }) => {
  if (['production','store-sandbox'].includes(process.env.EAS_BUILD_PROFILE)) {
    validateStoreConfig(process.env,process.env.EAS_BUILD_PLATFORM);
    if (process.env.EAS_BUILD_PROFILE==='production' && process.env.EXPO_PUBLIC_APP_ENVIRONMENT!=='production') {
      throw new Error('The production build must use production data. Use store-sandbox for billing tests.');
    }
  }
  return ({
  ...config,
  android: {
    ...config.android,
    // The game uses bundled media and app-private storage. Keep development
    // overlays available in dev clients; exclude them from store artifacts.
    blockedPermissions: [...new Set([...(config.android?.blockedPermissions ?? []),
      ...(['production','store-sandbox'].includes(process.env.EAS_BUILD_PROFILE) ? [
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.RECORD_AUDIO',
      ] : []),
    ])],
  },
  owner: "aigarsp",
  extra: {
    eas: {
      projectId: "773fbd6d-1f47-4e51-87af-c14a746529fd",
    },
    supabaseUrl:
      process.env.EXPO_PUBLIC_SUPABASE_URL ??
      process.env.NEXT_PUBLIC_SUPABASE_URL ??
      "",
    supabaseAnonKey:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "",
  },
  });
};
