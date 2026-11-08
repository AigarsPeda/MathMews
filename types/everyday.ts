/** Diagram data is shared across languages; labels describe the givens only. */
export type EverydayModel = { label: string } & (
  | { kind: "clock"; task: "read" | "elapsed" | "finish" | "start"; minutes: number; end?: number; duration?: number; analog: boolean }
  | { kind: "bars"; task: "read" | "total" | "difference" | "most" | "least" | "mean" | "range" | "missing"; values: number[]; step: number; index: number; total?: number; subject?: "cats" | "toys" }
  | { kind: "shapes"; task: "sides" | "corners" | "symmetry"; sides: number[]; rectangle: boolean; context?: "mats" }
  | { kind: "grid"; task: "reflect" | "rotate" | "translate"; size: number; start: number; turns: number; dx: number; dy: number }
  | { kind: "money"; task: "total" | "change" | "unit" | "discount" | "afford"; prices: number[]; quantities: number[]; paid: number; discount: number; unit: "cents" | "euros"; coins?: boolean; items?: ("apple" | "cookie" | "book" | "plant" | "balloon" | "cupcake")[] }
  | { kind: "capacity"; task: "read" | "total" | "space" | "servings" | "containers" | "litres"; amounts: number[]; capacities: number[]; portion: number; unit: "ml" | "l"; portionContainer?: "cup" | "bottle" | "bowl" }
  | { kind: "solid"; width: number; height: number; depth: number }
);

export type EverydayExample = { question: string; explanation: string; model: EverydayModel };
