import { useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { RevealPlayContext } from '../kit/RevealPlayContext';
import { useProofViewport } from '../PlayProofCaption';
import { useQuantityPractice } from './QuantityPractice';

/** Keep the editor's top inset at Check when the two hosts have the same usable space. */
export function QuantityStage({children, model, locked}: {children: ReactNode; model: string; locked: boolean}) {
  const viewport = useProofViewport();
  const screen = useWindowDimensions();
  const {attemptKey} = useContext(RevealPlayContext);
  const frozen = locked || !!attemptKey;
  const practice = useQuantityPractice();
  const [height, measure] = useState(0);
  const key = `${model}:${viewport?.fontScale}:${viewport?.innerWidth}`;
  const spare = viewport && height ? Math.max(0, viewport.availableModelHeight - height - 8) : 0;
  // Centre in the portion both layouts can use. The checked dock also contains the verdict and replay controls.
  const transfer = model === 'join' || model === 'take_away';
  const shortBoard = model === 'compare' || model === 'cookies';
  // The transfer trays share the stage with a taller retry dock at default text size.
  const stageFraction = transfer ? .52 : shortBoard ? .55 : .43;
  // The submitted cookie deal wraps to two lines in the pinned answer at larger type sizes.
  const extraAnswerHeight = model === 'cookies' ? 48 * Math.max(0, screen.fontScale - 1) : 0;
  const common = Math.max(0, Math.min(spare, screen.height * stageFraction - extraAnswerHeight - height));
  const saved = practice.snapshot.insets.get(key);
  const top = frozen && saved != null ? height && viewport ? Math.min(spare, saved) : saved : common / 2;
  useLayoutEffect(() => {
    if (!frozen && height && viewport) practice.snapshot.insets.set(key, top);
  }, [frozen, height, viewport, practice, key, top]);
  return <View style={{paddingTop: top}}><View onLayout={event => measure(event.nativeEvent.layout.height)}>{children}</View></View>;
}
