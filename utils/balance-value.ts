import type { MathOperator } from '@/types/puzzle';
import { applyMathOperator } from '@/utils/puzzle-math';

/** The catalog places the missing operand on either side of the operator. */
export function balanceLeftValue(expression: string, choice: string | null) {
  if (choice === null || choice.trim() === '' || !Number.isFinite(Number(choice))) return null;
  const match = /^(-?\d+|\?)\s*([+−×÷-])\s*(-?\d+|\?)$/.exec(expression);
  if (!match) return null;
  const operand = (text: string) => Number(text === '?' ? choice : text);
  const operator = match[2] === '−' ? '-' : match[2] as MathOperator;
  return applyMathOperator(operand(match[1]), operand(match[3]), operator);
}
