# NLC

NLC is an AI terminal assistant for natural-language development workflows.

Use it to run tasks, modify code, and handle terminal workflows with minimal friction.

## Requirements

- Node.js 20+
- OpenAI API key

You can provide the key via:

- `OPENAI_API_KEY` environment variable, or
- `nlc config`

## Installation

```bash
npm install -g nlc
```

## Quick Start

```bash
nlc config
nlc chat
nlc do "find all TODO comments in this repo and summarize them"
```

## Commands

### `nlc chat`

Starts an interactive multi-turn session.

Options:

- `-m, --max-steps <number>` (default: `15`)
- `--dangerously-accept` (skip confirmation prompts)

### `nlc do <request...>`

Runs a one-shot request.

Options:

- `--dangerously-accept` (skip confirmation prompts)

### `nlc config`

Configures persistent OpenAI settings.

Examples:

```bash
nlc config
nlc config show
nlc config key sk-...
nlc config key --clear
nlc config model gpt-5.3-codex
nlc config reset
```

## Safety

By default, NLC asks before executing commands or editing files.

Use `--dangerously-accept` only in trusted environments.

## Development

```bash
pnpm install
pnpm run dev
pnpm run build
```

## License

MIT. See [LICENSE](./LICENSE).
