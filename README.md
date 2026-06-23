# create-abzed-app

Scaffold a new React + Vite project from the **abzed-app** template
(abzed-utils + Redux + TanStack Query + AntD 6 + Tailwind v4, with the full
CI/CD pipeline). The template ships **inside** this package — one install, no
network/git needed.

## Usage

```bash
npm create abzed-app@latest my-app
cd my-app
npm run dev
```

## What it does

1. Copies the bundled template into `my-app/`.
2. Renames `package.json`, README title, `index.html` `<title>`, and the pipeline
   identity defaults (`VITE_CI_APP_NAME`, `…_DEPLOY_NETWORK`,
   `…_SONAR_PROJECT_KEY/NAME`) to your project name; sets it `private`.
3. Seeds `.env.local` from `.env.example`.
4. `git init` + initial commit.
5. `npm install`.

## Options

```bash
npm create abzed-app@latest my-app -- --no-install                 # skip npm install
npm create abzed-app@latest my-app -- --no-git                     # skip git init
npm create abzed-app@latest my-app -- --template /path/to/template # local dir override
npm create abzed-app@latest my-app -- --template abzed-app@3.0.0   # npm spec override
npm create abzed-app@latest my-app -- --template git@github.com:you/repo.git --branch develop
```

`--template` overrides the bundled default with a local directory, an npm spec,
or a git URL.

## Maintaining the template

The bundled `template/` is generated from the dev repo at `../abzed-app`:

```bash
npm run sync     # copy ../abzed-app → ./template (also runs automatically on publish)
```

Workflow: develop + test in `../abzed-app`, then `npm publish` here — the
`prepack` hook re-syncs `template/` so the published package always carries the
latest template. Set `ABZED_APP_SRC` to point the sync at a different source.
