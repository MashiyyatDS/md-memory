import { defineHandler } from "nitro";
import * as path from "node:path";
import { saveMemory } from "../../../utils/memory-store";
import { buildSessionDigest } from "../../../utils/transcript";

// Called by the Stop Claude Code hook. Rebuilds a per-session transcript digest
// and upserts it as one file per session, filed under the cwd's project.
// Always fail-open (returns 200 {} even on error) so a turn never blocks.

function projectFromCwd(cwd?: string): string {
  if (typeof cwd !== "string") return "shared";
  return path.basename(cwd.replace(/[\\/]+$/, "")) || "shared";
}

function sessionSlug(sessionId?: string): string {
  const s = (sessionId ?? "").replace(/[^a-z0-9-]/gi, "");
  return s.slice(0, 24) || "unknown";
}

export default defineHandler(async (event) => {
  try {
    const body = (await event.req.json().catch(() => ({}))) as {
      cwd?: string;
      session_id?: string;
      transcript_path?: string;
      last_assistant_message?: string;
    };

    const project = projectFromCwd(body.cwd);
    const digest = await buildSessionDigest(body.transcript_path, body.last_assistant_message);

    await saveMemory({
      project,
      projectPath: typeof body.cwd === "string" ? body.cwd : undefined,
      id: `session-${sessionSlug(body.session_id)}`,
      session: body.session_id || undefined,
      title: digest.title,
      summary: digest.summary,
      tags: ["session"],
      content: digest.content,
    });

    return {};
  } catch {
    return {}; // fail-open
  }
});
