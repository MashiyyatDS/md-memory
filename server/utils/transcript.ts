import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";

const MAX_MESSAGES = 60; // how many recent messages to render
const MAX_TEXT = 1200; // per-message cap
const MAX_DIGEST = 20000; // overall digest cap

export interface DigestResult {
  title: string;
  summary: string;
  content: string;
}

// Claude Code wrapper tags / injected reminders that aren't real conversation.
function isNoise(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return (
    t.startsWith("<local-command-") ||
    t.startsWith("<command-name>") ||
    t.startsWith("<command-message>") ||
    t.startsWith("<command-args>") ||
    t.startsWith("<system-reminder>")
  );
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b): b is { type: string; text: string } => {
        const bl = b as { type?: string; text?: unknown };
        return bl?.type === "text" && typeof bl.text === "string";
      })
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

// Reads a Claude Code transcript (JSONL) and renders a compact User/Assistant digest.
// Fully defensive: unreadable/odd lines are skipped and we fall back to the last
// assistant message so the caller can always produce *something*.
export async function buildSessionDigest(
  transcriptPath?: string,
  fallbackAssistant?: string,
): Promise<DigestResult> {
  let lines: string[] = [];
  try {
    if (transcriptPath && existsSync(transcriptPath)) {
      lines = (await fs.readFile(transcriptPath, "utf8")).split(/\r?\n/).filter(Boolean);
    }
  } catch {
    lines = [];
  }

  const turns: { role: "user" | "assistant"; text: string }[] = [];
  for (const line of lines) {
    let obj: { type?: string; message?: { role?: string; content?: unknown } };
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj?.type !== "user" && obj?.type !== "assistant") continue;
    const role = obj?.message?.role;
    if (role !== "user" && role !== "assistant") continue;
    let t = extractText(obj?.message?.content).trim();
    if (!t || isNoise(t)) continue;
    if (t.length > MAX_TEXT) t = t.slice(0, MAX_TEXT) + "…";
    turns.push({ role, text: t });
  }

  const firstUser = turns.find((x) => x.role === "user")?.text ?? "";
  const title = (firstUser.split("\n")[0] || "Session").slice(0, 80);
  const summary = firstUser.slice(0, 160);

  let content = turns
    .slice(-MAX_MESSAGES)
    .map((x) => `**${x.role === "user" ? "User" : "Assistant"}:** ${x.text}`)
    .join("\n\n");

  if (!content && fallbackAssistant) content = `**Assistant:** ${fallbackAssistant}`;
  if (content.length > MAX_DIGEST) content = content.slice(0, MAX_DIGEST) + "\n\n…(truncated)";

  return { title: title || "Session", summary, content: content || "(no conversation captured)" };
}
