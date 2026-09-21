import { defineHandler } from "nitro";
import * as path from "node:path";
import { searchMemories, listMemories } from "../../../utils/memory-store";

// Called by the SessionStart and UserPromptSubmit Claude Code hooks. Returns
// `hookSpecificOutput.additionalContext` for Claude to inject, scoped to the
// project derived from the hook's cwd. Always fail-open (never blocks a prompt).

const SCORE_THRESHOLD = 1;
const MAX_HITS = 4;

function projectFromCwd(cwd?: string): string {
  if (typeof cwd !== "string") return "shared";
  return path.basename(cwd.replace(/[\\/]+$/, "")) || "shared";
}

export default defineHandler(async (event) => {
  try {
    const body = (await event.req.json().catch(() => ({}))) as {
      hook_event_name?: string;
      cwd?: string;
      prompt?: string;
    };

    const eventName = body.hook_event_name ?? "UserPromptSubmit";
    const project = projectFromCwd(body.cwd);
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    let lines: string[];
    let header: string;

    if (prompt) {
      const hits = (await searchMemories(project, prompt, { limit: MAX_HITS })).filter(
        (h) => h.score >= SCORE_THRESHOLD,
      );
      lines = hits.map((h) => `- **${h.title}** (${(h.updated || "").slice(0, 10)}) — ${h.snippet}`);
      header = `🧠 Relevant memory (project: ${project}) — recalled automatically:`;
    } else {
      const recent = await listMemories(project, { sort: "recent", limit: 5 });
      lines = recent.map(
        (m) => `- **${m.title}** (${(m.updated || "").slice(0, 10)})${m.summary ? " — " + m.summary : ""}`,
      );
      header = `🧠 Recent memory for this project (${project}):`;
    }

    if (lines.length === 0) return {};

    return {
      hookSpecificOutput: {
        hookEventName: eventName,
        additionalContext: [header, ...lines].join("\n"),
      },
    };
  } catch {
    return {}; // fail-open
  }
});
