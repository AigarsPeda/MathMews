/* eslint-disable @typescript-eslint/no-require-imports -- Exclude test UI from release. */
import { Redirect } from 'expo-router';
export default function DeveloperTestRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  const Screen = require('@/components/dev/DeveloperTestHost').DeveloperTestHost;
  return <Screen />;
}
