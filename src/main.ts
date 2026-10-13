import './ui/kit.css';
import { applyTheme } from './theme/derive';

// The screens arrive with the session flow; for now the shell applies the theme and the fonts.
applyTheme(document.documentElement);
