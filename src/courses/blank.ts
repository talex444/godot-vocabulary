/** How many wrong tries a typed blank allows before the answer is shown (decision 35). */
export const BLANK_TRIES = 2;

export type BlankVerdict =
  /** Exactly the answer. */
  | 'right'
  /** Only the case differs: GDScript is case-sensitive, so it is still a miss, with a hint. */
  | 'case'
  | 'wrong'
  /** The second miss: the answer is shown and the item counts as wrong. */
  | 'shown'
  /** Nothing typed; not a try. */
  | 'empty';

/** Judges one try at a typed blank; `misses` is how many tries already missed. Exact match only. */
export function judgeBlank(typed: string, answer: string, misses: number): { verdict: BlankVerdict; misses: number } {
  const word = typed.trim();
  if (word === '') return { verdict: 'empty', misses };
  if (word === answer) return { verdict: 'right', misses };
  const next = misses + 1;
  if (next >= BLANK_TRIES) return { verdict: 'shown', misses: next };
  return { verdict: word.toLowerCase() === answer.toLowerCase() ? 'case' : 'wrong', misses: next };
}

/**
 * Judges one try at a typed recall check (decision 71): like a blank, spaces inside tidied; a code name
 * (a class) is case-sensitive, any other name (a dock's) is not.
 */
export function judgeRecall(typed: string, answer: string, misses: number, caseSensitive: boolean): { verdict: BlankVerdict; misses: number } {
  const tidy = typed.trim().replace(/\s+/g, ' ');
  return caseSensitive ? judgeBlank(tidy, answer, misses) : judgeBlank(tidy.toLowerCase(), answer.toLowerCase(), misses);
}
