// Runs the Android project's Gradle wrapper with the given tasks: `node scripts/gradle.mjs assembleDebug`.
// Same command on Windows (gradlew.bat) and Linux CI (./gradlew). When JAVA_HOME or ANDROID_HOME is not set,
// it falls back to Android Studio's bundled JDK and the default SDK folder on Windows; CI sets both itself.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/io.mjs';

const windows = process.platform === 'win32';
const env = { ...process.env };

if (windows && !env.JAVA_HOME) {
  const jbr = join(env.ProgramFiles ?? 'C:\\Program Files', 'Android', 'Android Studio', 'jbr');
  if (existsSync(jbr)) env.JAVA_HOME = jbr;
}
if (windows && !env.ANDROID_HOME && !existsSync(join(ROOT, 'android', 'local.properties')) && env.LOCALAPPDATA) {
  const sdk = join(env.LOCALAPPDATA, 'Android', 'Sdk');
  if (existsSync(sdk)) env.ANDROID_HOME = sdk;
}

// No daemon: nothing keeps running after the build.
const args = ['--no-daemon', ...process.argv.slice(2)];
const cwd = join(ROOT, 'android');
const result = windows
  ? spawnSync(`"${join(cwd, 'gradlew.bat')}"`, args, { cwd, env, stdio: 'inherit', shell: true })
  : spawnSync('sh', ['./gradlew', ...args], { cwd, env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
