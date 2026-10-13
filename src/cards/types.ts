export type Family = 'godot-api' | 'gdscript' | 'github';

export const FAMILIES: readonly Family[] = ['godot-api', 'gdscript', 'github'];

/** What the answer names: a class, one of its members, a glossary term, or a language item. */
export type CardKind = 'class' | 'method' | 'property' | 'signal' | 'term' | (string & {});

export interface CardSource {
  /** Which document the card was generated from, e.g. 'godot-class-reference', 'github-glossary'. */
  doc: string;
  /** Where in that document: class name, term, or manual page and section. */
  ref: string;
  version: string;
}

/**
 * One four-choice card. Choices are `answer` plus `distractors`, shuffled at display time.
 * Ids are stable: `api:class:Timer`, `api:method:Timer.start`, `api:prop:Timer.wait_time`,
 * `api:signal:Timer.timeout`, `gh:term:pull-request`, `gd:…`.
 */
export interface Card {
  id: string;
  family: Family;
  kind: CardKind;
  /** Plain text with `inline code` and ``` fenced blocks. */
  prompt: string;
  code?: string;
  answer: string;
  distractors: [string, string, string];
  explain: string;
  /** Path under `public/`, e.g. `icons/Timer.svg`. */
  icon?: string;
  source: CardSource;
  /** Unlock order within the family; lower first. */
  rank: number;
  /** Id of a card that must have been seen before this one is introduced. */
  requires?: string;
}
