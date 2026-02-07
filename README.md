# RDE Env Setup

A VS Code extension for **Repository Parsing/Explaining** with an interactive graph visualizer and AI summaries, plus a starter **Environment Configuration Tool** workflow.

## Features

- Repository Visualizer: interactive graph of files and dependencies
- Search, filter, and click‑to‑open files directly from the graph
- Optional AI summaries (file + directory) via Gemini
- Environment Configuration Tool (one‑click wizard prototype)

## Commands

- `RDE: Repository Visualizer` (`rde.openVisualizer`)
- `RDE: One-Click Setup` (`rde.oneClickSetup`)
- `About Forge RDE` (`rde.about`)

## Extension Settings

- `rde.geminiApiKey`: Gemini API key for AI summaries
- `rde.ttcApiKey`: The Token Company (TTC) key for prompt compression (optional)

## Setup

### Install dependencies

```bash
cd /Users/mehdihdev/mehdihdev-temp/rde-env
pnpm install --no-frozen-lockfile
```

### Build the webview

```bash
pnpm build:webview
```

### Build the extension

```bash
pnpm compile
```

## Run in VS Code

1. Open `/Users/mehdihdev/mehdihdev-temp/rde-env` in VS Code
2. Press `F5` to launch the Extension Host
3. In the Extension Host window, open any repo folder
4. Run `RDE: Repository Visualizer`

## Notes

- AI summaries require a valid Gemini API key.
- If Gemini returns rate‑limit or overload errors, the UI shows **Retry** and **Set API Key**.

## Known Issues

- Lint warnings exist in `src/visualizer-core` for imported third‑party code style.
