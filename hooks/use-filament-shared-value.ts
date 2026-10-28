import { useEffect } from 'react';
import { useFilamentContext } from 'react-native-filament';
import { runOnUI, type SharedValue } from 'react-native-reanimated';
import { useSharedValue, type ISharedValue } from 'react-native-worklets-core';

export function useFilamentSharedValue<T>(source: SharedValue<T>, initialValue: T): ISharedValue<T> {
  const target = useSharedValue(initialValue);
  const { workletContext } = useFilamentContext();

  useEffect(() => {
    const listenerId = Math.floor(Math.random() * 1000000);
    const sync = workletContext.createRunAsync((value: T) => {
      'worklet';
      target.value = value;
    });

    runOnUI(() => {
      'worklet';
      source.addListener(listenerId, sync);
      sync(source.get());
    })();

    return () => {
      runOnUI(() => {
        'worklet';
        source.removeListener(listenerId);
      })();
    };
  }, [source, target, workletContext]);

  return target;
}
