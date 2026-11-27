import { Canvas, Oval, Group, RoundedRect, useCanvasRef } from '@shopify/react-native-skia';
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, useWindowDimensions } from 'react-native';
import { Ink, Quantity, Radius, Shape } from '@/constants/puzzle-theme';
import type { QuantityTaskModel } from '@/types/puzzle';
import { HelpProofContext } from '../kit/HelpProofContext';
import { landTick } from '../kit/proofHaptics';
import { QuantityEntryBuild, useQuantityPractice } from './QuantityPractice';
import { DiagramGlyph } from '../kit/DiagramIcon';
import { ProofGeometry } from '../kit/ProofFeedback';
import type { RevealBeats } from '../kit/useRevealBeats';
import { useProofViewport } from '../PlayProofCaption';
import { ProofWindow } from './ProofWindow';
import { modelInk, useModelPaint } from './useModelPaint';

/** Picture help keeps this much clear of the row band's edge on each side. */
const HELP_SIDE = 8;

export function ArrayBoard({ model, measuredWidth, landed, running, beats, interactive = false }: {
  model: Extract<QuantityTaskModel, { kind: 'array' }>; measuredWidth: number; landed: number; running: boolean; beats?: RevealBeats; interactive?: boolean;
}) {
  const { t } = useTranslation();
  const { fontScale, width: screenWidth } = useWindowDimensions();
  const width = measuredWidth || screenWidth - 52;
  const { rows, columns, object } = model;
  const viewport = useProofViewport();
  const budget = viewport ? Math.max(1, viewport.availableModelHeight - 8) : undefined;
  const help = useContext(HelpProofContext);
  const gap = help ? 4 : Shape.space.loose;
  // Picture help fills the sheet width with big pieces; Play keeps its compact pieces.
  const size = help ? Math.max(36, Math.min(96, Math.floor((width - 2 * HELP_SIDE - (columns - 1) * gap) / columns), Math.floor(help.height / rows) - gap)) : fontScale >= 2 ? 34 : 38;
  const across = Math.max(1, Math.min(columns, Math.floor((width - (help ? 2 * HELP_SIDE : 12) + gap) / (size + gap))));
  const lines = Math.ceil(columns / across);
  // The mouse's drawing spans 59 of its 64 units: picture help draws it a little larger so it fills the cell.
  const zoom = help && object ? 1.08 : 1;
  const step = size + gap;
  // Picture help gives each row room to breathe, up to what the model area allows.
  const rowHeight = help ? Math.max(lines * step, Math.min(Math.round(lines * step * 1.3), Math.floor(help.height / rows))) : Math.max(44, lines * step);
  const rowWidth = Math.min(width, across * step - (help ? gap : 0) + (help ? 2 * HELP_SIDE : 12));
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
            <RoundedRect x={0} y={0} width={rowWidth} height={rowHeight - (help ? Shape.space.loose : gap)} r={Radius.piece}
              color={running && i < landed ? help ? Quantity.teal.soft : Quantity.teal.light : (interactive && (pressedRow === i || hintVisible && !touched && i === 0)) || marked.has(i) ? Quantity.violet.light : Ink.tray} />
            {cells.map((cell, col) => <Group key={col} transform={[{ translateX: cell.x + size * (1 - zoom) / 2 }, { translateY: cell.y + size * (1 - zoom) / 2 }, { scale: size * zoom / 64 }]}>
              {object ? <DiagramGlyph name={object} displaySize={size * zoom} /> : <>
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
