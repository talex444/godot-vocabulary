import './ui/kit.css';
import './ui/screens/screens.css';
import { isNativeApp } from './reminder/reminder';
import { applyTokens, godotTokens } from './theme/tokens';
import { mountApp } from './ui/app';

// Theme first (the stylesheets read its custom properties; the font faces load with them), then the Start screen.
applyTokens(document.documentElement, godotTokens(), 'godot');
const host = document.querySelector<HTMLElement>('#screen');
if (host) mountApp(host);

// Inside the Android package only: put the daily reminder back from the saved setting.
if (isNativeApp()) void import('./reminder/native').then((native) => native.restoreReminder());
