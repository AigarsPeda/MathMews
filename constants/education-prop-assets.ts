/** Original Blender models: prototypes/education-props/. These are decorative, not task answers. */
export const EducationPropAssets = {
  addition: require("@/assets/3d/education-props/addition.webp"),
  "square-root": require("@/assets/3d/education-props/square-root.webp"),
  fractions: require("@/assets/3d/education-props/fractions.webp"),
  "book-closed": require("@/assets/3d/education-props/book-closed.webp"),
  "book-open": require("@/assets/3d/education-props/book-open.webp"),
  "book-stack": require("@/assets/3d/education-props/book-stack.webp"),
  pencil: require("@/assets/3d/education-props/pencil.webp"),
  "set-square": require("@/assets/3d/education-props/set-square.webp"),
  calculator: require("@/assets/3d/education-props/calculator.webp"),
} as const;
export type EducationProp = keyof typeof EducationPropAssets;

const schoolProps: readonly EducationProp[] = ["book-stack", "pencil", "book-open", "set-square", "book-closed", "calculator"];

/** Small, topic-aware rotations. Roots are reserved for Hard rather than early arithmetic. */
export function getTopicEducationProps(topicId: string, difficulty: string): readonly EducationProp[] {
  if (topicId === "addition") return ["addition", "book-stack", "pencil", "calculator"];
  if (topicId === "fractions" || topicId === "percentages") return ["fractions", "book-open", "set-square", "book-stack"];
  if (topicId === "measurement") return ["set-square", "pencil", "book-closed", "calculator"];
  if (difficulty === "hard" && (topicId === "operations" || topicId === "logic")) return ["square-root", "calculator", "book-stack", "book-open"];
  return schoolProps;
}
