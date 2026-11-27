import { Canvas, Oval, Group, RoundedRect, useCanvasRef } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, useWindowDimensions } from 'react-native';
import { Ink, Quantity, Radius, Shape } from '@/constants/puzzle-theme';
import type { QuantityTaskModel } from '@/types/puzzle';
import { landTick } from '../kit/proofHaptics';
import { QuantityEntryBuild, useQuantityPractice } from './QuantityPractice';
import { DiagramGlyph } from '../kit/DiagramIcon';
import { ProofGeometry } from '../kit/ProofFeedback';
import type { RevealBeats } from '../kit/useRevealBeats';
import { useProofViewport } from '../PlayProofCaption';
import { ProofWindow } from './ProofWindow';
import { modelInk, useModelPaint } from './useModelPaint';

export function ArrayBoard({ model, measuredWidth, landed, running, beats, interactive = false }: {
  model: Extract<QuantityTaskModel, { kind: 'array' }>; measuredWidth: number; landed: number; running: boolean; beats?: RevealBeats; interactive?: boolean;
}) {
  const { t } = useTranslation();
  const { fontScale, width: screenWidth } = useWindowDimensions();
  const width = measuredWidth || screenWidth - 52;
  const { rows, columns, object } = model;
  const viewport = useProofViewport();
  const budget = viewport ? Math.max(1, viewport.availableModelHeight - 8) : undefined;
  const size = fontScale >= 2 ? 34 : 38;
  const gap = Shape.space.loose;
  const across = Math.max(1, Math.min(columns, Math.floor((width - 12) / (size + gap))));
  const lines = Math.ceil(columns / across);
  const step = size + gap;
  const rowHeight = Math.max(44, lines * step);
  const rowWidth = Math.min(width, across * step + 12);
  const insetX = (rowWidth - across * step + gap) / 2, insetY = (rowHeight - lines * step) / 2;
  const canvasHeight = rowHeight * rows, canvasWidth = rowWidth;
  const canvas = useCanvasRef();
  const practice = useQuantityPractice();
  const [marked, setMarked] = useState(() => practice.snapshot.rows);
  const [inspected, inspect] = useState(0);
  const [touched, setTouched] = useState(false);
  const [hintVisible, showHint] = useState(false);
  const [pressedRow, pressRow] = useState<number | null>(null);
  useEffect(() => {
    if (!interactive || running || touched || marked.size) return;
    const start = setTimeout(() => showHint(true), 4000);
    const end = setTimeout(() => showHint(false), 5200);
    return () => { clearTimeout(start); clearTimeout(end); };
  }, [interactive, running, touched, marked.size]);
  const active = running ? Math.min(rows - 1, Math.max(0, landed - 1)) : inspected;
  const focus = (active + .5) / rows;
  const rowList = Array.from({length: rows}, (_, i) => ({i, x: 0, y: i * rowHeight}));
  const cells = Array.from({ length: columns }, (_, i) => ({ x: insetX + i % across * step, y: insetY + Math.floor(i / across) * step }));
  useModelPaint(!!beats, beats, canvas, image => {
    const ink = modelInk(image, canvasWidth, canvasHeight);
    return rowList.every(row => cells.every(cell => {
      for (let y = .25; y <= .75; y += .125) {
        for (let x = .25; x <= .75; x += .125) if (ink(row.x + cell.x + x * size, row.y + cell.y + y * size)) return true;
      }
      return false;
    }));
  });
  return <ProofWindow height={budget} focus={focus} persistent>
    <ProofGeometry style={{ alignSelf: 'center', width: canvasWidth, height: canvasHeight }}>
      <QuantityEntryBuild editing={interactive && !running} ready={measuredWidth > 0}>
        <Canvas ref={canvas} accessible={false} style={{width: canvasWidth, height: canvasHeight}}>
          {rowList.map(({ i, x, y }) => <Group key={i} transform={[{ translateX: x }, { translateY: y }]}>
            <RoundedRect x={0} y={0} width={rowWidth} height={rowHeight - gap} r={Radius.piece}
              color={running && i < landed ? Quantity.teal.light : (interactive && (pressedRow === i || hintVisible && !touched && i === 0)) || marked.has(i) ? Quantity.violet.light : Ink.tray} />
            {cells.map((cell, col) => <Group key={col} transform={[{ translateX: cell.x }, { translateY: cell.y }, { scale: size / 64 }]}>
              {object ? <DiagramGlyph name={object} displaySize={size} /> : <>
                <Oval x={6} y={6} width={52} height={52} color={Quantity.teal.edge} />
                <Oval x={6} y={6} width={52} height={52 - Shape.lip * 64 / size} color={Quantity.teal.fill} />
              </>}
            </Group>)}
          </Group>)}
        </Canvas>
      </QuantityEntryBuild>
      {interactive && rowList.map(({ i, x, y }) => <Pressable key={i} accessibilityRole="togglebutton" accessibilityState={{ checked: marked.has(i) }}
        accessibilityLabel={t('objectScenes.rowNumber', { row: i + 1 })} style={{ position: 'absolute', left: x, top: y, width: rowWidth, height: rowHeight }}
        onPressIn={() => { setTouched(true); pressRow(i); }} onPressOut={() => pressRow(null)} onPress={() => { landTick(); inspect(i); setMarked(previous => { const next = new Set(previous); if (next.has(i)) next.delete(i); else next.add(i); practice.saveRows(next); return next; }); }} />)}
    </ProofGeometry>
  </ProofWindow>;
}
