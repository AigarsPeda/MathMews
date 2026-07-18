import type { TopicAttemptStats, TopicStatsMap } from "@/types/game";
import type { PuzzleTopic } from "@/types/puzzle";

const EMPTY_TOPIC_STATS: TopicAttemptStats = { correct: 0, wrong: 0 };

export function getTopicAttemptStats(
  stats: TopicStatsMap | undefined,
  topic: PuzzleTopic,
): TopicAttemptStats {
  const entry = stats?.[topic];
  if (!entry) return { ...EMPTY_TOPIC_STATS };
  return {
    correct: typeof entry.correct === "number" ? Math.max(0, entry.correct) : 0,
    wrong: typeof entry.wrong === "number" ? Math.max(0, entry.wrong) : 0,
  };
}

export function recordTopicAttempt(
  stats: TopicStatsMap | undefined,
  topic: PuzzleTopic,
  correct: boolean,
): TopicStatsMap {
  const current = getTopicAttemptStats(stats, topic);
  return {
    ...stats,
    [topic]: {
      correct: current.correct + (correct ? 1 : 0),
      wrong: current.wrong + (correct ? 0 : 1),
    },
  };
}

export function topicAccuracy(entry: TopicAttemptStats): number | null {
  const total = entry.correct + entry.wrong;
  if (total === 0) return null;
  return entry.correct / total;
}

export function topicMistakeRate(entry: TopicAttemptStats): number | null {
  const total = entry.correct + entry.wrong;
  if (total === 0) return null;
  return entry.wrong / total;
}

export type TopicStatsRow = {
  topic: PuzzleTopic;
  correct: number;
  wrong: number;
  attempts: number;
  accuracy: number | null;
  mistakeRate: number | null;
};

export function buildTopicStatsRows(
  stats: TopicStatsMap | undefined,
): TopicStatsRow[] {
  if (!stats) return [];

  const rows: TopicStatsRow[] = [];
  for (const topic of Object.keys(stats) as PuzzleTopic[]) {
    const normalized = getTopicAttemptStats(stats, topic);
    const attempts = normalized.correct + normalized.wrong;
    if (attempts === 0) continue;
    rows.push({
      topic,
      correct: normalized.correct,
      wrong: normalized.wrong,
      attempts,
      accuracy: topicAccuracy(normalized),
      mistakeRate: topicMistakeRate(normalized),
    });
  }

  return rows.sort((a, b) => {
    const aRate = a.mistakeRate ?? -1;
    const bRate = b.mistakeRate ?? -1;
    if (bRate !== aRate) return bRate - aRate;
    if (b.wrong !== a.wrong) return b.wrong - a.wrong;
    return a.topic.localeCompare(b.topic);
  });
}

/** Topics tied for highest mistake rate (and wrong count). Empty if none have mistakes. */
export function findToughestTopicRows(rows: TopicStatsRow[]): TopicStatsRow[] {
  const withMistakes = rows.filter((row) => row.wrong > 0);
  const lead = withMistakes[0];
  if (!lead || lead.mistakeRate === null) return [];

  return withMistakes.filter(
    (row) =>
      row.mistakeRate === lead.mistakeRate && row.wrong === lead.wrong,
  );
}

export function normalizeTopicStats(value: unknown): TopicStatsMap {
  if (!value || typeof value !== "object") return {};

  const result: TopicStatsMap = {};
  for (const [topic, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const correct =
      typeof record.correct === "number" && Number.isFinite(record.correct)
        ? Math.max(0, Math.floor(record.correct))
        : 0;
    const wrong =
      typeof record.wrong === "number" && Number.isFinite(record.wrong)
        ? Math.max(0, Math.floor(record.wrong))
        : 0;
    if (correct === 0 && wrong === 0) continue;
    result[topic as PuzzleTopic] = { correct, wrong };
  }
  return result;
}

export function summarizeTopicStats(stats: TopicStatsMap | undefined): {
  totalCorrect: number;
  totalWrong: number;
  totalAttempts: number;
  overallAccuracy: number | null;
} {
  let totalCorrect = 0;
  let totalWrong = 0;
  for (const entry of Object.values(stats ?? {})) {
    if (!entry) continue;
    totalCorrect += entry.correct;
    totalWrong += entry.wrong;
  }
  const totalAttempts = totalCorrect + totalWrong;
  return {
    totalCorrect,
    totalWrong,
    totalAttempts,
    overallAccuracy:
      totalAttempts === 0 ? null : totalCorrect / totalAttempts,
  };
}
