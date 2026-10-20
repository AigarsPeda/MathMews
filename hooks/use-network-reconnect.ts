import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import { useEffect } from 'react';
import { AppState } from 'react-native';

/** Also checks on resume, when the OS may have missed a background network event. */
export function subscribeToNetworkReconnect(onReconnect: () => void) {
  let active = true;
  let revision = 0;
  let previous: NetworkState | undefined;
  const online = (state: NetworkState) => state.isConnected === true && state.isInternetReachable !== false;
  const observe = (state: NetworkState, resumed = false) => {
    const restored = previous !== undefined && (!online(previous) || previous.type !== state.type);
    previous = state;
    if (active && online(state) && (restored || resumed) && AppState.currentState === 'active') onReconnect();
  };
  const refresh = async (resumed: boolean) => {
    const request = ++revision;
    try {
      const state = await getNetworkStateAsync();
      if (active && request === revision) observe(state, resumed);
    } catch { /* Existing sync timers remain the fallback if network state is unavailable. */ }
  };
  const network = addNetworkStateListener(state => { revision++; observe(state); });
  const app = AppState.addEventListener('change', state => { if (state === 'active') void refresh(true); });
  void refresh(false);
  return () => { active = false; revision++; network.remove(); app.remove(); };
}

export function useNetworkReconnect(onReconnect: () => void, enabled = true) {
  useEffect(() => enabled ? subscribeToNetworkReconnect(onReconnect) : undefined, [enabled, onReconnect]);
}
