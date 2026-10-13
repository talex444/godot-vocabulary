import type { RevealTable } from './types';

/**
 * Decision 41's tap-to-reveal table: every cell starts covered, a tap uncovers it for good. The guess
 * stays in the learner's head; nothing is typed, scored or stored.
 */
export interface RevealState {
  readonly rows: number;
  readonly columns: number;
  /** Uncovered cells as `row:column`. */
  readonly shown: ReadonlySet<string>;
}

export function coveredTable(table: RevealTable): RevealState {
  return { rows: table.rows.length, columns: table.columns.length, shown: new Set() };
}

export function isShown(state: RevealState, row: number, column: number): boolean {
  return state.shown.has(`${row}:${column}`);
}

/** Uncovers one cell; a cell outside the table or already shown leaves the state as it was. */
export function reveal(state: RevealState, row: number, column: number): RevealState {
  const inside = Number.isInteger(row) && Number.isInteger(column) && row >= 0 && column >= 0 && row < state.rows && column < state.columns;
  if (!inside || isShown(state, row, column)) return state;
  return { ...state, shown: new Set([...state.shown, `${row}:${column}`]) };
}

export function shownCount(state: RevealState): number {
  return state.shown.size;
}

export function allShown(state: RevealState): boolean {
  return state.shown.size === state.rows * state.columns;
}
