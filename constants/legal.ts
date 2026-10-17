// TODO: Confirm the publisher's legal name and monitored business email, then
// fill the public .env/EAS fields. Never infer a legal identity from a Git name.
export const PUBLISHER_NAME = process.env.EXPO_PUBLIC_PUBLISHER_NAME?.trim() || 'TODO: publisher legal name';
export const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() || '';
export const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL?.trim() || '';
export const ACCOUNT_DELETION_URL = process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL?.trim() || '';

/** Shown in the policy and App Store support field — update before launch. */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'TODO: support email';

export const PRIVACY_POLICY_LAST_UPDATED = "2026-10-16";
