import { applyTheme } from './theme/derive';

// Session 2 builds the screens; for now the shell only applies the derived theme.
applyTheme(document.documentElement);
const app = document.querySelector<HTMLElement>('#app');
if (app) app.textContent = 'Godot Vocabulary';
