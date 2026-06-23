#!/usr/bin/env node
// create-abzed-app — scaffold a new React + Vite project from the bundled template.
//
//   npm create abzed-app@latest my-app
//   npm create abzed-app@latest my-app -- --no-install
//   npm create abzed-app@latest my-app -- --template /path/to/local/template   (local dir)
//   npm create abzed-app@latest my-app -- --template abzed-app@3.0.0           (npm spec)
//   npm create abzed-app@latest my-app -- --template git@github.com:you/repo.git
//
// The template ships INSIDE this package (./template), so the default path needs
// no network/git. Zero runtime dependencies — uses Node fs (+ npm/tar/git only
// for the optional --template overrides).

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED_TEMPLATE = path.join(HERE, 'template');
const SIBLING_DEV_REPO = path.resolve(HERE, '..', 'abzed-app');
const dirExists = (p) => {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
};
// Default to the bundled template (published package). When running from source
// before `npm run sync`, fall back to the sibling abzed-app dev repo.
const DEFAULT_TEMPLATE = dirExists(BUNDLED_TEMPLATE)
    ? BUNDLED_TEMPLATE
    : dirExists(SIBLING_DEV_REPO)
      ? SIBLING_DEV_REPO
      : BUNDLED_TEMPLATE; // error clearly later if neither exists
const DEFAULT_BRANCH = 'master'; // only used for git templates

// Files/dirs never copied from a local-path template.
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

const c = {
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
};

function parseArgs(argv) {
    const opts = { name: '', template: DEFAULT_TEMPLATE, branch: DEFAULT_BRANCH, install: true, git: true };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--no-install') opts.install = false;
        else if (a === '--no-git') opts.git = false;
        else if (a === '--template') opts.template = argv[++i];
        else if (a === '--branch') opts.branch = argv[++i];
        else if (!a.startsWith('-') && !opts.name) opts.name = a;
    }
    return opts;
}

const toSlug = (name) =>
    name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const toTitle = (slug) =>
    slug
        .split('-')
        .filter(Boolean)
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ');

function die(msg) {
    console.error(`\n${c.red('✗')} ${msg}\n`);
    process.exit(1);
}

const isGitUrl = (t) =>
    t.startsWith('git@') || t.startsWith('git+') || /^(https?|ssh|git):\/\/.+\.git/.test(t) || t.endsWith('.git');

function fetchTemplate(template, branch, target) {
    if (dirExists(template)) {
        fs.cpSync(template, target, {
            recursive: true,
            filter: (src) => !IGNORE.has(path.basename(src)),
        });
        return;
    }

    if (isGitUrl(template)) {
        execSync(`git clone --depth 1 --branch ${branch} ${template} "${target}"`, { stdio: 'inherit' });
        fs.rmSync(path.join(target, '.git'), { recursive: true, force: true });
        return;
    }

    // npm package spec — download the tarball and extract it.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'create-abzed-app-'));
    try {
        const out = execSync(`npm pack ${template} --pack-destination "${tmp}" --json`, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'inherit'],
        });
        const filename = JSON.parse(out)[0].filename;
        // Run tar from within tmp with a RELATIVE filename — a `C:\…` path in the
        // args makes tar read the drive letter as a remote `host:path`.
        execSync(`tar -xzf "${filename}"`, { cwd: tmp, stdio: 'ignore' });
        fs.cpSync(path.join(tmp, 'package'), target, { recursive: true });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function replaceInFile(file, replacers) {
    if (!fs.existsSync(file)) return;
    let txt = fs.readFileSync(file, 'utf8');
    for (const [from, to] of replacers) txt = txt.split(from).join(to);
    fs.writeFileSync(file, txt);
}

function scaffold(target, slug, title) {
    // package.json — rename, reset version, keep it private.
    const pkgPath = path.join(target, 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.name = slug;
        pkg.version = '0.1.0';
        pkg.private = true;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');
    }

    // index.html <title> (match whatever the template currently uses).
    const indexHtml = path.join(target, 'index.html');
    if (fs.existsSync(indexHtml)) {
        const html = fs
            .readFileSync(indexHtml, 'utf8')
            .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
        fs.writeFileSync(indexHtml, html);
    }

    // README first heading.
    const readme = path.join(target, 'README.md');
    if (fs.existsSync(readme)) {
        const lines = fs.readFileSync(readme, 'utf8').split('\n');
        const i = lines.findIndex((l) => l.startsWith('# '));
        if (i !== -1) lines[i] = `# ${title}`;
        fs.writeFileSync(readme, lines.join('\n'));
    }

    // Pipeline identity defaults (.env.example + .gitlab-ci.yml share these tokens).
    const identity = [
        ['app-frontend', `${slug}-frontend`],
        ['app-net', `${slug}-net`],
        ['App Frontend', `${title} Frontend`],
    ];
    replaceInFile(path.join(target, '.env.example'), identity);
    replaceInFile(path.join(target, '.gitlab-ci.yml'), identity);

    // Seed .env.local from the (now project-named) example.
    const example = path.join(target, '.env.example');
    if (fs.existsSync(example)) {
        fs.copyFileSync(example, path.join(target, '.env.local'));
    }
}

const args = parseArgs(process.argv.slice(2));

async function main() {
    let name = args.name;
    if (!name) {
        const rl = readline.createInterface({ input: stdin, output: stdout });
        name = (await rl.question(c.cyan('Project name: '))).trim();
        rl.close();
    }
    if (!name) die('A project name is required.');

    const slug = toSlug(name);
    if (!slug) die(`"${name}" has no usable characters for a project name.`);
    const title = toTitle(slug);
    const target = path.resolve(process.cwd(), slug);

    if (fs.existsSync(target)) die(`Directory "${slug}" already exists.`);

    console.log(`\n${c.bold('create-abzed-app')} ${c.dim('→')} ${c.green(slug)}\n`);

    const label = args.template === BUNDLED_TEMPLATE ? 'bundled' : args.template;
    console.log(`${c.cyan('•')} Preparing template ${c.dim(`(${label})`)}…`);
    try {
        fetchTemplate(args.template, args.branch, target);
    } catch (err) {
        fs.rmSync(target, { recursive: true, force: true });
        die(`Could not prepare the template: ${err?.message ?? err}`);
    }

    console.log(`${c.cyan('•')} Personalising project…`);
    scaffold(target, slug, title);

    if (args.git) {
        console.log(`${c.cyan('•')} Initialising git…`);
        try {
            execSync('git init -q && git add -A && git commit -q -m "Initial commit from abzed-app"', {
                cwd: target,
                stdio: 'ignore',
            });
        } catch {
            console.log(`  ${c.dim('(skipped — git not available)')}`);
        }
    }

    if (args.install) {
        console.log(`${c.cyan('•')} Installing dependencies…`);
        execSync('npm install --no-audit --no-fund', { cwd: target, stdio: 'inherit' });
    }

    console.log(`\n${c.green('✓')} ${c.bold(slug)} is ready.\n`);
    console.log('Next steps:');
    console.log(c.dim(`  cd ${slug}`));
    if (!args.install) console.log(c.dim('  npm install'));
    console.log(c.dim('  npm run dev'));
    console.log(
        c.dim('\nEdit .env.local for app + deploy config (VITE_* / VITE_CI_*). See docs/deployment.md.\n')
    );
}

main().catch((err) => die(err?.message ?? String(err)));
