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
  /** The first three entries of `distractorPool`, kept for cards and code that predate the pool. */
  distractors: [string, string, string];
  /**
   * Wrong answers to draw from, at least four and six or more where the data allows (decision 24).
   * Never contains the answer or a duplicate. Generated cards always have one; custom cards may not.
   */
  distractorPool?: string[];
  /**
   * The card id each pool entry would have, index for index. An id with no card (a class whose own
   * card a generator rule dropped, a hand-written wrong answer) cannot be shown as a description.
   */
  distractorIds?: string[];
  explain: string;
  /** The complete description, BBCode converted, capped at 1,200 characters with "…". */
  explainFull?: string;
  /** The official docs page (and anchor) for this class, member, manual section or glossary term. */
  docsUrl?: string;
  /** The manual topic that introduces this card (decision 30), e.g. "Signals", "UI", "Git basics". */
  topic?: string;
  /** Path under `public/`, e.g. `icons/Timer.svg`. */
  icon?: string;
  source: CardSource;
  /** Unlock order within the family; lower first. */
  rank: number;
  /** Id of a card that must have been seen before this one is introduced. */
  requires?: string;
}
