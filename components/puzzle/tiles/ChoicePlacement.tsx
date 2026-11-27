import { PuzzleText } from '@/components/puzzle/PuzzleText';
import { Announce } from './Announce';
import { Ink } from '@/constants/puzzle-theme';
import { moderateScale } from '@/utils/scale';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

/** Picking a piece does not change the checked draft until it reaches its destination. */
export function useChoicePlacement(placed: number | null, onPlace: (index: number | null) => void) {
  const [picked, setPicked] = useState<number | null>(null);
  function place(index: number | null) {
    onPlace(index);
    setPicked(null);
  }
  return {
    picked, pick: (index: number) => setPicked(current => current === index ? null : index),
    place, activate: () => place(picked), enabled: picked !== null || placed !== null,
  };
}

export function PlacementCue({ instruction, picked }: { instruction: string; picked?: string }) {
  const { t } = useTranslation();
  const message = picked === undefined ? instruction : t('challenges.pickedTile', { value: picked });
  return <>
    <PuzzleText style={styles.cue}>{message}</PuzzleText>
    <Announce trigger={picked} message={picked === undefined ? null : message} />
  </>;
}

const styles = StyleSheet.create({
  cue: { fontSize: moderateScale(15), fontWeight: '700', textAlign: 'center', color: Ink.soft },
});
