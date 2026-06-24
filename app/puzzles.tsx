import { GameHeaderStats } from "@/components/economy/GameHeaderStats";
import { NoLivesPanel } from "@/components/economy/LivesCounter";
import { DifficultyPicker } from "@/components/puzzle/DifficultyPicker";
import { PuzzlePathItem } from "@/components/puzzle/PuzzlePathItem";
import {
  PuzzlePathProgressChip,
  PuzzlePathProgressSheet,
} from "@/components/puzzle/PuzzlePathProgress";
import { GameColors } from "@/constants/game";
import {
  canPlayPuzzleIndex,
  getNextIncompleteDifficulty,
  getPuzzlePathState,
  getPuzzlesByDifficulty,
  isPuzzleDifficulty,
  resolvePuzzlePathDifficulty,
} from "@/constants/puzzles";
import { useGame } from "@/contexts/GameProvider";
import { useLocale } from "@/contexts/LocaleProvider";
import { useDifficultyLabelLower } from "@/hooks/use-difficulty-label";
import type { PuzzleDifficulty } from "@/types/puzzle";
import { canSpendLife } from "@/utils/lives";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function PuzzlesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { difficulty: difficultyParam } = useLocalSearchParams<{
    difficulty?: string;
  }>();
  const rawDifficulty = Array.isArray(difficultyParam)
    ? difficultyParam[0]
    : difficultyParam;
  const paramDifficulty = isPuzzleDifficulty(rawDifficulty ?? "")
    ? rawDifficulty
    : null;

  const {
    isReady,
    hasCompletedOnboarding,
    pet,
    wallet,
    progress,
    buyLife,
    recordInteraction,
  } = useGame();
  const [difficulty, setDifficulty] = useState<PuzzleDifficulty>(
    paramDifficulty ?? "easy",
  );
  const [showProgress, setShowProgress] = useState(false);
  const difficultyLabelLower = useDifficultyLabelLower(difficulty);
  const prevSolvedRef = useRef(progress.puzzlesSolved);
  const didMountResolve = useRef(false);

  useEffect(() => {
    if (!paramDifficulty) return;
    setDifficulty(
      resolvePuzzlePathDifficulty(
        locale,
        progress.puzzlesSolved,
        paramDifficulty,
      ),
    );
  }, [paramDifficulty, progress.puzzlesSolved, locale]);

  useEffect(() => {
    if (didMountResolve.current) return;
    didMountResolve.current = true;
    if (paramDifficulty) return;
    setDifficulty(
      resolvePuzzlePathDifficulty(locale, progress.puzzlesSolved, "easy"),
    );
  }, [locale, progress.puzzlesSolved, paramDifficulty]);

  useEffect(() => {
    const prev = prevSolvedRef.current;
    prevSolvedRef.current = progress.puzzlesSolved;

    const total = getPuzzlesByDifficulty(locale, difficulty).length;
    const wasComplete = prev[difficulty] >= total;
    const isComplete = progress.puzzlesSolved[difficulty] >= total;

    if (!wasComplete && isComplete) {
      const next = getNextIncompleteDifficulty(
        locale,
        progress.puzzlesSolved,
        difficulty,
      );
      if (next) {
        setDifficulty(next);
      }
    }
  }, [progress.puzzlesSolved, difficulty, locale]);

  const puzzles = getPuzzlesByDifficulty(locale, difficulty);
  const solvedCount = progress.puzzlesSolved[difficulty];
  const scrollRef = useRef<ScrollView>(null);
  const currentIndex = Math.min(solvedCount, Math.max(0, puzzles.length - 1));

  const scrollToCurrent = useCallback((y: number) => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, y - moderateScale(8)),
      animated: true,
    });
  }, []);

  const handleSelectDifficulty = useCallback(
    (next: PuzzleDifficulty) => {
      recordInteraction();
      triggerHaptic();
      setDifficulty(next);
    },
    [recordInteraction],
  );

  const handlePlayPuzzle = useCallback(
    (index: number, isReplay: boolean) => {
      if (!canSpendLife(progress.lives)) return;
      if (!canPlayPuzzleIndex(index, solvedCount)) return;
      recordInteraction();
      triggerHaptic();
      router.push({
        pathname: "/play",
        params: {
          difficulty,
          index: String(index),
          ...(isReplay ? { replay: "true" } : {}),
        },
      });
    },
    [difficulty, progress.lives, recordInteraction, router, solvedCount],
  );

  const handleBackHome = useCallback(() => {
    recordInteraction();
    triggerHaptic();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  }, [recordInteraction, router]);

  const handlePlayCurrent = useCallback(() => {
    if (solvedCount >= puzzles.length) return;
    handlePlayPuzzle(solvedCount, false);
  }, [handlePlayPuzzle, puzzles.length, solvedCount]);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={GameColors.primary} />
      </View>
    );
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding/name-pet" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBackHome}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("puzzlePath.a11yBack")}
          >
            <Text style={styles.backText}>{t("common.back")}</Text>
          </Pressable>
          <GameHeaderStats
            coins={wallet.coins}
            streak={progress.streak}
            lives={progress.lives}
          />
        </View>

        <Text style={styles.title}>{t("puzzlePath.title")}</Text>
        <Text style={styles.subtitle}>
          {t("puzzlePath.subtitle", { name: pet.name })}
        </Text>

        <DifficultyPicker
          selected={difficulty}
          onSelect={handleSelectDifficulty}
        />

        {!canSpendLife(progress.lives) ? (
          <NoLivesPanel
            lives={progress.lives}
            coins={wallet.coins}
            onBuyLife={buyLife}
          />
        ) : (
          <>
            <PuzzlePathProgressChip
              difficulty={difficulty}
              solvedCount={solvedCount}
              totalCount={puzzles.length}
              onPress={() => {
                recordInteraction();
                triggerHaptic();
                setShowProgress(true);
              }}
            />

            <PuzzlePathProgressSheet
              visible={showProgress}
              difficulty={difficulty}
              solvedCount={solvedCount}
              totalCount={puzzles.length}
              onClose={() => setShowProgress(false)}
            />

            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {puzzles.map((puzzle, index) => {
                const state = getPuzzlePathState(index, solvedCount);
                return (
                  <PuzzlePathItem
                    key={puzzle.id}
                    puzzle={puzzle}
                    puzzleNumber={index + 1}
                    state={state}
                    onLayout={(y) => {
                      if (index === currentIndex) {
                        requestAnimationFrame(() => scrollToCurrent(y));
                      }
                    }}
                    onPress={() =>
                      handlePlayPuzzle(index, state === "completed")
                    }
                  />
                );
              })}

              {solvedCount >= puzzles.length ? (
                <View style={styles.completeCard}>
                  <Text style={styles.completeEmoji}>🎉</Text>
                  <Text style={styles.completeTitle}>
                    {t("puzzlePath.allNutsCracked", {
                      difficulty: difficultyLabelLower,
                    })}
                  </Text>
                  <Text style={styles.completeText}>
                    {t("puzzlePath.tryAnother")}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            {solvedCount < puzzles.length ? (
              <Pressable
                style={styles.primaryBtn}
                onPress={handlePlayCurrent}
                accessibilityRole="button"
                accessibilityLabel={t("puzzlePath.playCurrent")}
              >
                <Text style={styles.primaryBtnText}>
                  {t("puzzlePath.playNut", { number: solvedCount + 1 })}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GameColors.background,
  },
  safe: {
    flex: 1,
    backgroundColor: GameColors.background,
  },
  screen: {
    flex: 1,
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(4),
    paddingBottom: moderateScale(8),
    gap: moderateScale(12),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    minHeight: moderateScale(48),
    justifyContent: "center",
    paddingRight: moderateScale(12),
  },
  backText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
  },
  title: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    color: GameColors.text,
  },
  subtitle: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
    marginTop: moderateScale(-4),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: moderateScale(4),
    paddingBottom: moderateScale(16),
  },
  primaryBtn: {
    minHeight: moderateScale(52),
    borderRadius: moderateScale(16),
    backgroundColor: GameColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(16),
  },
  primaryBtnText: {
    fontSize: moderateScale(17),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  completeCard: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.success,
    padding: moderateScale(16),
    alignItems: "center",
    gap: moderateScale(6),
    marginTop: moderateScale(4),
  },
  completeEmoji: {
    fontSize: moderateScale(32),
  },
  completeTitle: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: GameColors.text,
    textAlign: "center",
  },
  completeText: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
    textAlign: "center",
  },
});
