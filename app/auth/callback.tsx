import { Redirect } from 'expo-router';

// The active WebBrowser auth session verifies the PKCE code. Opening a deep
// link by itself must never replace the player's account. After an app kill,
// return to Settings so the player can retry while retaining the old session.
export default function AuthCallback() { return <Redirect href="/settings" />; }
