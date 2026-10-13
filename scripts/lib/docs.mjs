// Official documentation links for cards (done-criteria 36). The app only shows them; it never fetches.

export const GODOT_DOCS = 'https://docs.godotengine.org/en/4.7';
export const GITHUB_GLOSSARY = 'https://docs.github.com/en/get-started/learning-about-github/github-glossary';

/** Sphinx/docutils id: lowercase, every run of other characters becomes one hyphen, trimmed. */
export function sphinxId(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function classUrl(name) {
  return `${GODOT_DOCS}/classes/class_${name.toLowerCase()}.html`;
}

/** Member anchor as the class reference writes it; virtual methods (leading `_`) are `private_method`. */
export function memberUrl(cls, kind, member) {
  const tag = kind === 'method' && member.startsWith('_') ? 'private_method' : kind;
  return `${classUrl(cls)}#${sphinxId(`class_${cls}_${tag}_${member}`)}`;
}

/** A manual page plus an optional section heading: `tutorials/…/gdscript_basics#if/else/elif`. */
export function manualUrl(page, heading) {
  return `${GODOT_DOCS}/${page}.html${heading ? `#${sphinxId(heading)}` : ''}`;
}

/** GitHub Docs heading slug: lowercase, punctuation other than hyphens dropped, spaces become hyphens. */
export function glossaryUrl(term) {
  return `${GITHUB_GLOSSARY}#${term.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-')}`;
}
