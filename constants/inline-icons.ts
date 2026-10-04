import type { AppIconName } from "./app-icons";

/** Existing translated copy uses these markers; render them with our own art. */
export const INLINE_ICONS = {
  "←": "arrow-left",
  "🐾": "paw", "🍖": "feed", "🎾": "ball", "⚙️": "settings",
  "❤️": "heart", "💛": "heart", "💔": "broken-heart", "🔥": "flame",
  "🪙": "coin", "✨": "sparkle", "🎉": "sparkle", "🐱": "cat",
  "🧑‍🧒": "parent", "🛏️": "bed", "🪴": "plant", "🥜": "nut",
  "🔒": "lock", "🎬": "film", "🧠": "brain", "✓": "check",
  "⚠️": "warning", "🏠": "home", "🏡": "home", "🧸": "teddy",
  "🛋️": "sofa", "😴": "sleep", "🐭": "mouse", "⚽": "ball",
  "🍎": "apple", "📕": "book", "💺": "chair", "🧁": "cupcake",
  "🐚": "shell", "🔵": "blue-dot", "🎈": "balloon", "🍪": "cookie",
  "🐑": "sheep", "🧑": "person",
  "📦": "box", "🧶": "play", "🪶": "feather",
} as const satisfies Record<string, AppIconName>;
