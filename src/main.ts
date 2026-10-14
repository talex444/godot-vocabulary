import './ui/kit.css';
import './ui/screens/screens.css';
import { isNativeApp } from './reminder/reminder';
import { applyHomeTheme, mountApp } from './ui/app';

// The app opens the home page. Its neutral theme goes on before anything mounts, so a cold start
// never paints another area's colours first; entering an area applies that area's token map.
applyHomeTheme();
const host = document.querySelector<HTMLElement>('#screen');
const nav = host ? mountApp(host) : undefined;

// Inside the Android package only: put the daily reminder back from the saved setting; its tap opens the home page.
if (isNativeApp()) void import('./reminder/native').then((native) => native.restoreReminder(() => nav?.home()));
