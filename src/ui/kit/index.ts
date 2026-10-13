import { tokenize, type TokenKind } from './gdscript';

/**
 * The component kit: plain DOM factories styled by `src/ui/kit.css`, which reads only the
 * `--…` properties `applyTheme` writes. Every control is a native element with an accessible name.
 */

type Child = Node | string | null | undefined | false;

interface ElOptions {
  class?: string;
  text?: string;
  attrs?: Record<string, string>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElOptions = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.class) node.className = options.class;
  if (options.text !== undefined) node.textContent = options.text;
  for (const [name, value] of Object.entries(options.attrs ?? {})) node.setAttribute(name, value);
  for (const child of children) if (child) node.append(child);
  return node;
}

/** Files under `public/`, resolved against the site's base path. */
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

export type ButtonVariant = 'primary' | 'secondary' | 'flat';

export interface ButtonOptions {
  variant?: ButtonVariant;
  onClick?: (event: MouseEvent) => void;
  disabled?: boolean;
  /** Only when the visible label is not the whole name. */
  ariaLabel?: string;
  describedBy?: string;
}

export function button(label: string, options: ButtonOptions = {}): HTMLButtonElement {
  const node = el('button', { class: `gv-button gv-button--${options.variant ?? 'secondary'}`, text: label, attrs: { type: 'button' } });
  if (options.onClick) node.addEventListener('click', options.onClick);
  if (options.disabled) node.disabled = true;
  if (options.ariaLabel) node.setAttribute('aria-label', options.ariaLabel);
  if (options.describedBy) node.setAttribute('aria-describedby', options.describedBy);
  return node;
}

/** A flat Godot panel: `dark_color_1`, corner radius, no border. */
export function panel(children: readonly Child[], options: { label?: string; class?: string } = {}): HTMLElement {
  const node = el('section', { class: ['gv-panel', options.class].filter(Boolean).join(' ') }, children);
  if (options.label) node.setAttribute('aria-label', options.label);
  return node;
}

/** Accent-blue heading, like "Description" in the class help panel. */
export function heading(text: string, level: 1 | 2 | 3 = 2, options: { class?: string } = {}): HTMLHeadingElement {
  return el(`h${level}`, { class: ['gv-heading', options.class].filter(Boolean).join(' '), text });
}

/** A class icon from `public/icons/`, 24 px; decorative because the label beside it names it. */
export function icon(path: string): HTMLImageElement {
  const img = el('img', { class: 'gv-icon', attrs: { src: asset(path), alt: '', width: '24', height: '24', decoding: 'async' } });
  img.addEventListener('error', () => img.remove());
  return img;
}

export type ChoiceState = 'idle' | 'chosen-right' | 'chosen-wrong' | 'revealed-right' | 'disabled';

const CHOICE_NOTE: Partial<Record<ChoiceState, string>> = {
  'chosen-right': 'Right',
  'chosen-wrong': 'Your answer',
  'revealed-right': 'Correct answer',
};

/** One answer as a tree-row-like button: optional class icon, then the label. */
export function choiceRow(label: string, options: { icon?: string; onChoose: () => void }): HTMLButtonElement {
  const node = el('button', { class: 'gv-choice', attrs: { type: 'button', 'data-state': 'idle' } }, [
    options.icon ? icon(options.icon) : null,
    el('span', { class: 'gv-choice__text' }, [
      el('span', { class: 'gv-choice__label', text: label }),
      el('span', { class: 'gv-choice__note' }),
    ]),
  ]);
  node.addEventListener('click', options.onChoose);
  return node;
}

export function setChoiceState(row: HTMLButtonElement, state: ChoiceState): void {
  row.dataset.state = state;
  row.disabled = state !== 'idle';
  const note = row.querySelector('.gv-choice__note');
  if (note) note.textContent = CHOICE_NOTE[state] ?? '';
}

let fieldCount = 0;

/** Godot's LineEdit: dark field, accent border on focus, optional leading search icon. */
export function textField(options: {
  label: string;
  value?: string;
  placeholder?: string;
  search?: boolean;
  multiline?: boolean;
}): { root: HTMLElement; input: HTMLInputElement | HTMLTextAreaElement } {
  const id = `gv-field-${++fieldCount}`;
  const input = options.multiline ? el('textarea', { attrs: { rows: '3' } }) : el('input', { attrs: { type: options.search ? 'search' : 'text' } });
  input.id = id;
  input.className = 'gv-field__input';
  if (options.value) input.value = options.value;
  if (options.placeholder) input.placeholder = options.placeholder;
  const box = el('div', { class: `gv-field__box${options.search ? ' gv-field__box--search' : ''}` }, [
    options.search ? searchGlyph() : null,
    input,
  ]);
  const root = el('div', { class: 'gv-field' }, [el('label', { class: 'gv-field__label', text: options.label, attrs: { for: id } }), box]);
  return { root, input };
}

function searchGlyph(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'gv-field__glyph');
  svg.setAttribute('aria-hidden', 'true');
  const circle = document.createElementNS(ns, 'circle');
  circle.setAttribute('cx', '6.5');
  circle.setAttribute('cy', '6.5');
  circle.setAttribute('r', '4.5');
  const line = document.createElementNS(ns, 'path');
  line.setAttribute('d', 'M10 10l4 4');
  svg.append(circle, line);
  return svg;
}

/** Godot's CheckButton: label on the left, a switch on the right. */
export function toggle(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLButtonElement {
  const node = el('button', { class: 'gv-toggle', attrs: { type: 'button', role: 'switch', 'aria-checked': String(checked) } }, [
    el('span', { class: 'gv-toggle__label', text: label }),
    el('span', { class: 'gv-toggle__track', attrs: { 'aria-hidden': 'true' } }, [el('span', { class: 'gv-toggle__thumb' })]),
  ]);
  node.addEventListener('click', () => {
    const next = node.getAttribute('aria-checked') !== 'true';
    node.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  return node;
}

/** A number between − and + buttons, each a 44 px target. */
export function stepper(
  label: string,
  value: number,
  options: { min?: number; max?: number; step?: number; onChange: (value: number) => void },
): HTMLElement {
  const { min = 0, max = 999, step = 1 } = options;
  let current = value;
  const output = el('output', { class: 'gv-stepper__value', text: String(current), attrs: { 'aria-live': 'polite' } });
  const update = (next: number) => {
    current = Math.min(max, Math.max(min, next));
    output.textContent = String(current);
    less.disabled = current <= min;
    more.disabled = current >= max;
    options.onChange(current);
  };
  const less = button('−', { variant: 'secondary', ariaLabel: `Fewer: ${label}`, onClick: () => update(current - step) });
  const more = button('+', { variant: 'secondary', ariaLabel: `More: ${label}`, onClick: () => update(current + step) });
  less.disabled = current <= min;
  more.disabled = current >= max;
  return el('div', { class: 'gv-stepper', attrs: { role: 'group', 'aria-label': label } }, [
    el('span', { class: 'gv-stepper__label', text: label, attrs: { 'aria-hidden': 'true' } }),
    el('span', { class: 'gv-stepper__controls' }, [less, output, more]),
  ]);
}

/** A label and its value, e.g. "Due" 12. */
export function stat(label: string, value: number | string): HTMLElement {
  return el('div', { class: 'gv-stat' }, [
    el('dt', { class: 'gv-stat__label', text: label }),
    el('dd', { class: 'gv-stat__value', text: String(value) }),
  ]);
}

/** The `____` gap in a prompt or snippet: a selection-coloured slot, read out as "blank". */
export function blank(): HTMLElement {
  return el('span', { class: 'gv-blank' }, [el('span', { class: 'gv-visually-hidden', text: 'blank' })]);
}

/** Text with `____` gaps turned into slots. */
function withBlanks(text: string): Node[] {
  return text.split(/(_{4,})/).filter(Boolean).map((part) => (/^_{4,}$/.test(part) ? blank() : document.createTextNode(part)));
}

/** GDScript in JetBrains Mono on the script background, with line numbers and editor colours. */
export function codeBlock(code: string, options: { label?: string } = {}): HTMLElement {
  const lines = tokenize(code.replace(/\n+$/, '')).map((tokens, index) =>
    el('span', { class: 'gv-code__line' }, [
      el('span', { class: 'gv-code__number', text: String(index + 1), attrs: { 'aria-hidden': 'true' } }),
      el(
        'span',
        { class: 'gv-code__text' },
        tokens.length === 0 ? [' '] : tokens.flatMap((t) => (t.kind === 'blank' ? [blank()] : tokenNodes(t.kind, t.text))),
      ),
    ]),
  );
  return el('pre', { class: 'gv-code', attrs: { 'aria-label': options.label ?? 'GDScript code', role: 'group' } }, [
    el('code', {}, lines),
  ]);
}

/** A coloured token; after `.`, `(` and `,` a line may wrap, so long calls break there and not mid-name. */
function tokenNodes(kind: TokenKind, text: string): Node[] {
  const node = kind === 'text' ? document.createTextNode(text) : el('span', { class: `tok-${kind}`, text });
  return kind === 'symbol' && /^[.(,]$/.test(text) ? [node, el('wbr')] : [node];
}

/** Card text: `inline code` in JetBrains Mono, ``` fenced blocks as code blocks, `____` as slots. */
export function richText(text: string, tag: 'p' | 'div' = 'p', options: { class?: string } = {}): HTMLElement {
  const root = el('div', { class: ['gv-rich', options.class].filter(Boolean).join(' ') });
  const parts = text.split(/```(?:gdscript)?\n?([\s\S]*?)```/);
  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      root.append(codeBlock(part));
      return;
    }
    if (!part.trim()) return;
    const para = el(tag);
    part.trim().split(/(`[^`]+`)/).forEach((piece) => {
      if (/^`[^`]+`$/.test(piece)) para.append(el('code', { class: 'gv-inline-code' }, withBlanks(piece.slice(1, -1))));
      else para.append(...withBlanks(piece));
    });
    root.append(para);
  });
  return root;
}
