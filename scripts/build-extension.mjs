import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import esbuild from 'esbuild';

const ROOT_DIR = process.cwd();
const EXTENSION_DIR = path.join(ROOT_DIR, 'extension');
const DIST_DIR = path.join(EXTENSION_DIR, 'dist');
const DOWNLOADS_DIR = path.join(ROOT_DIR, 'public', 'downloads');
const ZIP_PATH = path.join(DOWNLOADS_DIR, 'veritext-chrome-extension.zip');

console.log('⚡ Building Veritext Manifest V3 Chrome Extension...');

// 1. Ensure dist and public/downloads directories exist
fs.mkdirSync(DIST_DIR, { recursive: true });
fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

// 2. Build TypeScript entry points with esbuild
await esbuild.build({
  entryPoints: [
    path.join(EXTENSION_DIR, 'src', 'background.ts'),
    path.join(EXTENSION_DIR, 'src', 'content.ts'),
    path.join(EXTENSION_DIR, 'src', 'popup.ts'),
  ],
  outdir: DIST_DIR,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome100'],
  minify: true,
  sourcemap: false,
});

// 3. Copy static manifest.json and popup.html
fs.copyFileSync(
  path.join(EXTENSION_DIR, 'manifest.json'),
  path.join(DIST_DIR, 'manifest.json')
);
fs.copyFileSync(
  path.join(EXTENSION_DIR, 'src', 'popup.html'),
  path.join(DIST_DIR, 'popup.html')
);

// 4. Create zip bundle in public/downloads/
if (fs.existsSync(ZIP_PATH)) {
  fs.unlinkSync(ZIP_PATH);
}

execSync(`cd "${DIST_DIR}" && zip -q -r "${ZIP_PATH}" .`);

const zipStats = fs.statSync(ZIP_PATH);
console.log(`✅ Chrome Extension bundled successfully:`);
console.log(`   - Output folder: ${DIST_DIR}`);
console.log(`   - Packaged Zip:  ${ZIP_PATH} (${(zipStats.size / 1024).toFixed(1)} kB)`);
