#!/usr/bin/env node
// Sync the abzed-app dev repo into ./template (the bundled template shipped with
// the CLI). Runs automatically on `npm pack` / `npm publish` via the `prepack`
// hook, or manually with `npm run sync`.
//
// Source resolution (first that exists wins):
//   1. $ABZED_APP_SRC
//   2. ../abzed-app  (sibling of this package, the default layout)

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = path.join(PKG_ROOT, 'template');

// Never copy these from the dev repo into the bundled template.
const IGNORE = new Set([
    'node_modules',
    '.git',
    'dist',
    'coverage',
    '.vite',
    '.cache',
    'package-lock.json',
    '.env',
    '.env.local',
    '.env.production',
    '.env.local.build-stashed',
]);

const candidates = [
    process.env.ABZED_APP_SRC,
    path.resolve(PKG_ROOT, '..', 'abzed-app'),
].filter(Boolean);

const src = candidates.find((p) => {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
});

if (!src) {
    console.error(
        `✗ Could not find the abzed-app source.\n  Looked in: ${candidates.join(', ')}\n` +
            `  Set ABZED_APP_SRC=/path/to/abzed-app and retry.`
    );
    process.exit(1);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.cpSync(src, DEST, {
    recursive: true,
    filter: (from) => !IGNORE.has(path.basename(from)),
});

const count = fs.readdirSync(DEST).length;
console.log(`✓ Synced template from ${src} → template/ (${count} top-level entries)`);
