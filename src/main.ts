import './ui/kit.css';
import './ui/screens/screens.css';
import { applyTheme } from './theme/derive';
import { mountApp } from './ui/app';

// Theme first (the stylesheets read its custom properties; the font faces load with them), then the Start screen.
applyTheme(document.documentElement);
const host = document.querySelector<HTMLElement>('#screen');
if (host) mountApp(host);
