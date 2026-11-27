import { IconText } from "@/components/ui/IconText";
import { PuzzleObjectImage } from "./PuzzleObjectImage";
import { PuzzleColors as GameColors, Quantity, Ink, Motion } from "@/constants/puzzle-theme";
import type { PracticeToken } from "@/types/visual-explanation";
import { getPracticeTokenSize, PRACTICE_BOARD_HEIGHT, PRACTICE_BOARD_WIDTH } from "@/utils/practice-token-layout";
import { moderateScale } from "@/utils/scale";
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from "react-native-reanimated";
import { Caption, Focus } from './kit/Focus';
import { RevealSurface } from './kit/RevealSurface';
import { useRevealBeats } from './kit/useRevealBeats';

type PracticeScene = { prompt?: string; tokens: PracticeToken[]; result?: string; compact?: boolean; boardHeight?: number };

function MovingToken({ token, from, ratio, delay, span, position, moving, arrived }: { token: PracticeToken; from: PracticeToken; ratio: number; delay: number; span: number; position: SharedValue<number>; moving: boolean; arrived: boolean }) {
  const progress = useDerivedValue(() => moving ? Math.min(1, Math.max(0, (position.value * span - delay) / Motion.step)) : 1);
  const traveling = from.x !== token.x || from.y !== token.y;
  const movingStyle = useAnimatedStyle(() => {
    const part = progress.value;
    return { opacity: Number(from.visible !== false) * (1 - part) + Number(token.visible !== false) * part,
      transform: [{ translateX: (from.x + (token.x - from.x) * part) * ratio },
        { translateY: (from.y + (token.y - from.y) * part + (traveling ? token.arc ?? 0 : 0) * Math.sin(Math.PI * part)) * ratio },
        { scale: (from.scale ?? 1) * (1 - part) + (token.scale ?? 1) * part }] };
  });
  const fillStyle = useAnimatedStyle(() => ({ opacity: (Number(from.tone !== 'muted') * (1 - progress.value) + Number(token.tone !== 'muted') * progress.value) * (token.shape === 'part' ? 1 : .16) }));
  const plain = token.shape === "plain";
  const dimensions = getPracticeTokenSize(token);
  const size = dimensions.width * ratio;
  const height = dimensions.height * ratio;
  const shapeStyle = token.cornerRadius === undefined ? undefined : { borderRadius: token.cornerRadius * ratio };
  const color = token.tone === "primary" ? Quantity.violet.fill : token.tone === "blue" ? Quantity.teal.fill : Ink.guide;
  return (
    <Animated.View
      testID={`practice-token-${token.id}`}
      accessible={token.visible !== false && token.label.length > 0}
      accessibilityLabel={arrived ? token.label : from.label}
      accessibilityElementsHidden={token.visible === false}
      importantForAccessibility={token.visible === false ? "no-hide-descendants" : "auto"}
      style={[
        styles.token,
        { width: size, height, marginLeft: -size / 2, marginTop: -height / 2 },
        movingStyle,
      ]}
    >
      {token.shape && !plain && !token.object ? (
        <View style={[StyleSheet.absoluteFill, styles.tokenShape, shapeStyle, { backgroundColor: GameColors.cardBorder }]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.tokenShape, shapeStyle, { backgroundColor: color }, fillStyle]} />
        </View>
      ) : null}
      {token.object ? <PuzzleObjectImage object={token.object} tone={token.tone === "primary" ? "secondary" : "primary"} size={Math.min(size, height)} /> : <View>
        <IconText style={[
          styles.tokenText,
          { fontSize: (plain ? 21 : 25) * ratio, color: GameColors.text },
        ]}>
          {arrived ? token.label : from.label}
        </IconText>
      </View>}
    </Animated.View>
  );
}

export function VisualPracticeBoard(scene: PracticeScene) {
  const key = JSON.stringify([scene.prompt, scene.tokens, scene.result]);
  const [frame, setFrame] = useState({ key, from: scene.tokens, to: scene.tokens, changed: false });
  if (key !== frame.key) setFrame({ key, from: frame.to, to: scene.tokens, changed: true });
  return <PracticeFrame key={key} {...scene} from={frame.from} moving={frame.changed || !!scene.result} />;
}

function PracticeFrame({ prompt, tokens, result, compact = false, boardHeight = PRACTICE_BOARD_HEIGHT, from, moving }: PracticeScene & { from: PracticeToken[]; moving: boolean }) {
  const { active } = useAnimationActivity();
  const previous = new Map(from.map(token => [token.id, token]));
  const delays = tokens.map((token, index) => token.delayMs ?? Math.min(index, 5) * Motion.stagger);
  const span = Motion.step + Math.max(0, ...delays);
  const beats = useRevealBeats(moving ? 1 : 0, { step: span, minTotal: 0 });
  const { skip } = beats;
  useEffect(() => { if (moving && !active) skip(); }, [moving, active, skip]);
  const [width, setWidth] = useState(0);
  const ratio = width / PRACTICE_BOARD_WIDTH;
  const body = (
    <View style={[styles.stage, compact && styles.compactStage]}>
      {prompt ? <Focus dimmed={moving && !!result && beats.settled}><Caption strong style={styles.prompt}>{prompt}</Caption></Focus> : null}
      <View testID="practice-board" style={[styles.board, { aspectRatio: PRACTICE_BOARD_WIDTH / boardHeight }]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? tokens.map((token, i) => (
          <MovingToken key={token.id} token={token} from={previous.get(token.id) ?? {...token, visible: false}} ratio={ratio} delay={delays[i]} span={span} position={beats.position} moving={moving && active && !beats.reduced} arrived={!moving || !active || beats.reduced || beats.landed > 0} />
        )) : null}
      </View>
      {!compact || result ? <View style={styles.resultHost}>
        {result && beats.settled ? (
          <Focus active><Caption strong style={styles.result}>{result}</Caption></Focus>
        ) : null}
      </View> : null}
    </View>
  );
  return moving ? <RevealSurface beats={beats}>{body}</RevealSurface> : body;
}

const styles = StyleSheet.create({
  stage: { width: "100%", backgroundColor: GameColors.background, borderRadius: moderateScale(16), padding: moderateScale(12) },
  compactStage: { padding: moderateScale(6) },
  prompt: { fontSize: moderateScale(18), fontWeight: "800", color: GameColors.text, textAlign: "center", minHeight: moderateScale(28) },
  board: { width: "100%", overflow: "hidden" },
  token: { position: "absolute", left: 0, top: 0, alignItems: "center", justifyContent: "center" },
  tokenShape: { borderRadius: moderateScale(8) },
  tokenText: { fontWeight: "800", textAlign: "center" },
  resultHost: { minHeight: moderateScale(28), justifyContent: "center" },
  result: { fontSize: moderateScale(18), fontWeight: "800", color: Ink.text, textAlign: "center" },
});
