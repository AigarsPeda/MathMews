export type BathroomFixtureKind = "bath" | "shower" | "toilet";
export type BathroomPhase = "approach" | "open" | "enter" | "wash" | "use" | "exit" | "close";

export function bathroomFixtureKind(id: string): BathroomFixtureKind | undefined {
  if (id === "bathroomBathAni" || id.startsWith("bathroomBathOval") ||
      id.startsWith("bathroomBathClawfoot") || id.startsWith("bathroomJacuzzi")) return "bath";
  if (id === "bathroomShowerCabin") return "shower";
  if (id === "bathroomWcAni") return "toilet";
  return undefined;
}
