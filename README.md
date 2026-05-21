# LLM Observability

A self-hosted observability dashboard for LLM applications, powered by [Langfuse](https://langfuse.com/) API with multi-project management and interactive trace visualization.

## Features

- **Multi-Project Dashboard** — Connect to multiple Langfuse instances, monitor all LLM applications in one place
- **Trace Explorer** — Browse, search, and filter traces with pagination and time-range filters
- **Trace Detail View** — Split-view with Span Tree and Detail Panel, formatted rendering for LLM inputs/outputs (Markdown, JSON, tool calls)
- **Observation Inspection** — Drill into individual spans, generations, and events with token usage and latency metrics
- **Self-Hosted** — Local SQLite storage for project configs, proxy Langfuse API from your own server

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Styling**: Tailwind CSS v4
- **State**: Zustand + TanStack Query
- **Database**: better-sqlite3 (local, zero-config)
- **Validation**: Zod
- **Monorepo**: pnpm workspaces

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9

### Install

```bash
git clone https://github.com/Kyronis/llm-observability.git
cd llm-observability
pnpm install
```

### Configure

Copy the example env file and fill in your Langfuse credentials per project (configured via the Settings UI):

```bash
cp .env.example .env
```

### Run

```bash
# Development
pnpm dev

# Or use Make
make dev
```

The app runs at `http://localhost:5090`.

### Build

```bash
pnpm build
```

## Project Structure

```
llm-observability/
├── apps/
│   └── web/                  # Next.js application
│       └── src/
│           ├── app/           # App Router pages & API routes
│           │   ├── api/       # Langfuse proxy + project CRUD
│           │   ├── settings/  # Project configuration
│           │   └── traces/    # Trace explorer & detail
│           ├── components/    # Shared UI components
│           └── lib/           # DB & API helpers
├── packages/
│   └── shared/               # Shared schemas & types (Zod)
├── package.json
├── pnpm-workspace.yaml
└── Makefile
```

## Available Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start dev server (port 5090) |
| `make build` | Build all packages |
| `make test` | Run tests |
| `make lint` | Lint all packages |
| `make format` | Format with Prettier |
| `make clean` | Remove build artifacts |

## License

MIT
