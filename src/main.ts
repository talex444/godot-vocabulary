import './ui/kit.css';
import './ui/screens/screens.css';
import { isNativeApp } from './reminder/reminder';
import { mountApp } from './ui/app';

// The app opens the Godot area's start screen; entering it applies the area's token map before
// the first paint (the stylesheets read its custom properties; the font faces load with them).
const host = document.querySelector<HTMLElement>('#screen');
if (host) mountApp(host);

// Inside the Android package only: put the daily reminder back from the saved setting.
if (isNativeApp()) void import('./reminder/native').then((native) => native.restoreReminder());
