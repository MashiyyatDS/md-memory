# md-mcp

A file-based, project-partitioned **memory server for Claude Code**, built on [Vite](https://vite.dev/) + [Nitro](https://nitro.build/). Memories are plain markdown files with frontmatter — easy to read, grep, and commit.

## How it works

md-mcp exposes two interfaces over the same store:

- **MCP tools** (`POST /md-mcp`) — for *manual curation*. Claude can save, search, get, list, and delete high-signal memories on demand.
- **Hook endpoints** (`POST /api/memory/hooks/*`) — for *automatic* memory. Claude Code hooks recall relevant context at the start of a turn and capture a transcript digest when a turn ends.

Every memory is a markdown file at `.memory/<project>/<id>.md`. The `project` is the working directory's folder name, so each repo gets its own isolated bucket (falling back to `shared`).

## Getting started

```bash
npm install
npm run dev
```

The server runs on **port 9000** — the MCP endpoint is `http://localhost:9000/md-mcp`.

## Register the MCP server

```bash
claude mcp add --transport http md-mcp http://localhost:9000/md-mcp
```

This makes five tools available to Claude:

| Tool | Purpose |
| --- | --- |
| `save_memory` | Save a durable memory as a markdown file, filed under `project`. Pass an existing `id` to update in place. |
| `search_memory` | Keyword search across a project's memories (title, tags, summary, body), with optional tag/session filters. |
| `get_memory` | Retrieve a single memory's full content and metadata by `id`. |
| `list_memories` | List a project's memories (metadata only), most recent first. |
| `delete_memory` | Permanently delete a memory by `id`. |

## Automatic memory via hooks

Two endpoints are designed to be driven by [Claude Code hooks](https://docs.claude.com/en/docs/claude-code/hooks). Both **fail open** — they never block a turn, even on error.

- `POST /api/memory/hooks/recall` — for `SessionStart` and `UserPromptSubmit`. Given the hook's `cwd` and `prompt`, it returns `hookSpecificOutput.additionalContext` with the most relevant memories (or the most recent ones when there's no prompt) for Claude to inject.
- `POST /api/memory/hooks/save` — for `Stop`. Given `cwd`, `session_id`, and `transcript_path`, it builds a compact digest of the session and upserts it as a single per-session memory.

Claude Code hooks run shell commands and receive the event JSON on stdin, so a hook simply `curl`s that payload to the endpoint. Illustrative `settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command",
        "command": "curl -s -X POST http://localhost:9000/api/memory/hooks/recall -H 'content-type: application/json' -d @-" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command",
        "command": "curl -s -X POST http://localhost:9000/api/memory/hooks/save -H 'content-type: application/json' -d @-" }] }
    ]
  }
}
```

## Memory file format

Each file is markdown with a gray-matter frontmatter block:

```markdown
---
id: 2026-09-21-postgres-choice-a1b2
title: Use Postgres for the primary store
project: md-mcp
tags:
  - decision
  - database
summary: Chose Postgres over SQLite for concurrent writes.
created: 2026-09-21T10:00:00.000Z
updated: 2026-09-21T10:00:00.000Z
---

We evaluated SQLite but expect concurrent writers, so the primary
store is Postgres. Revisit if the deployment stays single-node.
```

## Configuration

- **`MEMORY_DIR`** — root folder for the store. Defaults to `.memory/` at the project root.
- **Port** — set in `vite.config.ts` (`9000` for both `dev` and `preview`).
- **Projects** — partitioned automatically by working-directory name; omit `project` to use the `shared` bucket.

## Deploying

```bash
npm run build
npm run preview
```

Then check out the [Nitro deployment docs](https://nitro.build/deploy) for the different deployment presets.
