/* eslint-disable @typescript-eslint/no-require-imports -- Exclude test UI from release. */
import { Redirect } from 'expo-router';
export default function DeveloperSettingsRoute() {
  if (!__DEV__) return <Redirect href="/settings" />;
  const Screen = require('@/components/dev/DeveloperTestSettings').DeveloperTestSettings;
  return <Screen />;
}
