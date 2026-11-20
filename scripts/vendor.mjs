#!/usr/bin/env node
/**
 * Copies the MediaPipe Tasks Vision runtime from node_modules into /vendor so
 * the app has zero runtime CDN dependencies.
 *
 * Usage:
 *   npm install
 *   npm run vendor
 *
 * Optionally downloads the Hand Landmarker model when it is missing:
 *   npm run vendor -- --model
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = join(root, 'node_modules', '@mediapipe', 'tasks-vision');
const outDir = join(root, 'vendor', 'mediapipe', 'tasks-vision');

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';
const MODEL_PATH = join(root, 'models', 'hand_landmarker.task');

if (!existsSync(pkgDir)) {
  console.error('✗ @mediapipe/tasks-vision is not installed. Run `npm install` first.');
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, 'wasm'), { recursive: true });

const files = [
  ['vision_bundle.mjs', 'vision_bundle.mjs'],
  ['wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.js'],
  ['wasm/vision_wasm_internal.wasm', 'wasm/vision_wasm_internal.wasm'],
];
for (const [from, to] of files) {
  cpSync(join(pkgDir, from), join(outDir, to));
  const kb = (statSync(join(outDir, to)).size / 1024).toFixed(0);
  console.log(`✓ vendor/mediapipe/tasks-vision/${to} (${kb} KB)`);
}

writeFileSync(
  join(outDir, 'VERSION.txt'),
  `@mediapipe/tasks-vision ${version}\n` +
    'Source: https://www.npmjs.com/package/@mediapipe/tasks-vision\n' +
    'License: Apache-2.0 (https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE)\n',
);
console.log(`✓ MediaPipe Tasks Vision ${version} vendored.`);

if (process.argv.includes('--model')) {
  if (existsSync(MODEL_PATH)) {
    console.log('✓ models/hand_landmarker.task already present.');
  } else {
    console.log(`… downloading model from ${MODEL_URL}`);
    const res = await fetch(MODEL_URL);
    if (!res.ok) {
      console.error(`✗ Model download failed: HTTP ${res.status}`);
      process.exit(1);
    }
    mkdirSync(dirname(MODEL_PATH), { recursive: true });
    writeFileSync(MODEL_PATH, Buffer.from(await res.arrayBuffer()));
    console.log('✓ models/hand_landmarker.task downloaded.');
  }
}
