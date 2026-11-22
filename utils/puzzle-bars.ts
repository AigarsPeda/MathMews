import type { EverydayModel } from '@/types/everyday';

export type BarModel = Extract<EverydayModel, { kind: 'bars' }>;
export const groupLetter = (index: number) => String.fromCharCode(65 + index);

type BarAnswer = {
  answer: string;
  caption: string;
  columns: number[];
  marks: number[];
};

export function barAnswer(model: BarModel): BarAnswer {
  const { task, values, index } = model;
  const columns = values.map((_, i) => i);
  const total = values.reduce((sum, value) => sum + value, 0);
  const sum = values.join(' + ');
  if (task === 'mean' || task === 'total') {
    const mean = task === 'mean';
    const value = mean ? total / values.length : total;
    const expression = mean ? `(${sum}) ÷ ${values.length}` : sum;
    return { answer: String(value), caption: `${expression} = ${value}`, columns, marks: mean ? [value] : [] };
  }
  if (task === 'difference' || task === 'range') {
    const compared = task === 'range' ? values : values.slice(0, 2);
    const high = Math.max(...compared), low = Math.min(...compared);
    const gap = high - low;
    return { answer: String(gap), caption: `${high} − ${low} = ${gap}`,
      columns: compared.map((_, i) => i).filter(i => compared[i] === high || compared[i] === low), marks: [low, high] };
  }
  const most = task === 'most', least = task === 'least';
  const i = most ? values.indexOf(Math.max(...values)) : least ? values.indexOf(Math.min(...values)) : index;
  const letter = groupLetter(i), value = values[i];
  const calculation = task === 'missing' ? [model.total ?? total, ...values.filter((_, n) => n !== i)].join(' − ') + ' = ' : '';
  return { answer: most || least ? letter : String(value), caption: `${letter} = ${calculation}${value}`, columns: [i], marks: [value] };
}
