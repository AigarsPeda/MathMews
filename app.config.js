/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    owner: "aigarsp",
    ...require("./app.json").expo,
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
  },
};
