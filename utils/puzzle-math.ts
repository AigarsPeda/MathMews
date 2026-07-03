import type { MathOperator, OperationPathStep } from "@/types/puzzle";

export function applyMathOperator(
  left: number,
  right: number,
  operator: MathOperator,
): number | null {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "×":
      return left * right;
    case "÷":
      if (right === 0 || left % right !== 0) return null;
      return left / right;
  }
}

export function runOperationPath(
  start: number,
  steps: OperationPathStep[],
  selectedOperators?: MathOperator[],
): number | null {
  let value = start;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const operator = selectedOperators?.[i] ?? step.operator;
    const next = applyMathOperator(value, step.operand, operator);
    if (next === null) return null;
    value = next;
  }

  return value;
}

/** Standard order of operations (×÷ before +-). */
export function evaluateExpression(
  numbers: number[],
  operators: MathOperator[],
): number | null {
  if (numbers.length !== operators.length + 1) return null;

  const values = [...numbers];
  const ops = [...operators];

  let index = 0;
  while (index < ops.length) {
    const operator = ops[index];
    if (operator === "×" || operator === "÷") {
      const result = applyMathOperator(values[index], values[index + 1], operator);
      if (result === null) return null;
      values.splice(index, 2, result);
      ops.splice(index, 1);
      continue;
    }
    index += 1;
  }

  let total = values[0];
  for (let i = 0; i < ops.length; i++) {
    const result = applyMathOperator(total, values[i + 1], ops[i]);
    if (result === null) return null;
    total = result;
  }

  return total;
}

export function formatOperator(operator: MathOperator): string {
  return operator;
}
