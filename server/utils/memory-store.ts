import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import matter from "gray-matter";

// Root memory folder. Defaults to `.memory/` at the project root; override with MEMORY_DIR.
// Memories are partitioned into per-project subfolders: `.memory/<project>/`.
const MEMORY_DIR = process.env.MEMORY_DIR
  ? path.resolve(process.env.MEMORY_DIR)
  : path.resolve(process.cwd(), ".memory");

const DEFAULT_PROJECT = "shared";

export interface MemoryMeta {
  id: string;
  title: string;
  project: string;
  projectPath?: string;
  session?: string;
  tags: string[];
  summary?: string;
  created: string;
  updated: string;
}

export interface MemoryRecord extends MemoryMeta {
  content: string;
}

export interface SaveMemoryInput {
  project?: string;
  projectPath?: string;
  title: string;
  content: string;
  tags?: string[];
  session?: string;
  summary?: string;
  id?: string;
}

export interface SearchFilter {
  tags?: string[];
  session?: string;
  limit?: number;
}

export interface ListFilter {
  session?: string;
  tag?: string;
  limit?: number;
  sort?: "recent" | "oldest";
}

export interface SearchHit extends MemoryMeta {
  snippet: string;
  score: number;
}

// --- helpers ---

// Slug for a project subfolder. Falls back to "shared" so a missing project never escapes the store.
function sanitizeProject(raw?: string): string {
  const slug = (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || DEFAULT_PROJECT;
}

// Reduce an id to a path-safe filename stem (guards against path traversal).
function sanitizeId(raw: string): string {
  return path.basename(raw).replace(/\.md$/i, "").toLowerCase().replace(/[^a-z0-9-]/g, "");
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "memory"
  );
}

function dirFor(project: string): string {
  return path.join(MEMORY_DIR, sanitizeProject(project));
}

function fileFor(project: string, id: string): string {
  return path.join(dirFor(project), `${id}.md`);
}

function toMeta(project: string, id: string, data: Record<string, unknown>): MemoryMeta {
  return {
    id,
    title: typeof data.title === "string" ? data.title : id,
    project: typeof data.project === "string" ? data.project : project,
    projectPath: typeof data.projectPath === "string" ? data.projectPath : undefined,
    session: typeof data.session === "string" ? data.session : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    summary: typeof data.summary === "string" ? data.summary : undefined,
    created: typeof data.created === "string" ? data.created : "",
    updated: typeof data.updated === "string" ? data.updated : "",
  };
}

function metaOf(r: MemoryRecord): MemoryMeta {
  return {
    id: r.id,
    title: r.title,
    project: r.project,
    projectPath: r.projectPath,
    session: r.session,
    tags: r.tags,
    summary: r.summary,
    created: r.created,
    updated: r.updated,
  };
}

async function readRecord(project: string, id: string): Promise<MemoryRecord | null> {
  const file = fileFor(project, id);
  if (!existsSync(file)) return null;
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = matter(raw);
    return { ...toMeta(project, id, parsed.data), content: parsed.content.trim() };
  } catch {
    return null; // tolerate malformed frontmatter rather than crashing a scan
  }
}

async function readAll(project: string): Promise<MemoryRecord[]> {
  const dir = dirFor(project);
  if (!existsSync(dir)) return [];
  const entries = await fs.readdir(dir);
  const ids = entries
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .map((f) => f.replace(/\.md$/i, ""));
  const records = await Promise.all(ids.map((id) => readRecord(project, id)));
  return records.filter((r): r is MemoryRecord => r !== null);
}

function byUpdated(dir: "recent" | "oldest") {
  return (a: MemoryMeta, b: MemoryMeta) => {
    const cmp = (a.updated || "").localeCompare(b.updated || "");
    return dir === "recent" ? -cmp : cmp;
  };
}

function makeSnippet(body: string, terms: string[]): string {
  const lower = body.toLowerCase();
  let idx = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1) return body.slice(0, 160).trim();
  const start = Math.max(0, idx - 60);
  const end = Math.min(body.length, idx + 100);
  return (start > 0 ? "…" : "") + body.slice(start, end).trim() + (end < body.length ? "…" : "");
}

function countOccurrences(haystack: string, terms: string[]): number {
  let score = 0;
  for (const t of terms) {
    let from = 0;
    let i = haystack.indexOf(t, from);
    while (i !== -1) {
      score++;
      from = i + t.length;
      i = haystack.indexOf(t, from);
    }
  }
  return score;
}

// --- public API (all scoped to a project subfolder) ---

export async function saveMemory(
  input: SaveMemoryInput,
): Promise<{ id: string; project: string; path: string; created: string; updated: string }> {
  const project = sanitizeProject(input.project);
  await fs.mkdir(dirFor(project), { recursive: true });
  const now = new Date().toISOString();

  let id: string;
  let created = now;

  if (input.id) {
    id = sanitizeId(input.id);
    if (!id) throw new Error(`Invalid memory id: "${input.id}"`);
    const existing = await readRecord(project, id);
    if (existing?.created) created = existing.created;
  } else {
    id = `${now.slice(0, 10)}-${slugify(input.title)}-${randomBytes(2).toString("hex")}`;
  }

  const data: Record<string, unknown> = { id, title: input.title, project, created, updated: now };
  if (input.projectPath) data.projectPath = input.projectPath;
  if (input.session) data.session = input.session;
  if (input.tags?.length) data.tags = input.tags;
  if (input.summary) data.summary = input.summary;

  const file = fileFor(project, id);
  await fs.writeFile(file, matter.stringify(`\n${input.content.trim()}\n`, data), "utf8");

  return { id, project, path: file, created, updated: now };
}

export async function getMemory(project: string, id: string): Promise<MemoryRecord | null> {
  const clean = sanitizeId(id);
  if (!clean) return null;
  return readRecord(project, clean);
}

export async function listMemories(project: string, filter: ListFilter = {}): Promise<MemoryMeta[]> {
  let records = await readAll(project);
  if (filter.session) records = records.filter((r) => r.session === filter.session);
  if (filter.tag) records = records.filter((r) => r.tags.includes(filter.tag as string));
  records.sort(byUpdated(filter.sort ?? "recent"));
  return records.slice(0, filter.limit ?? 20).map(metaOf);
}

export async function searchMemories(
  project: string,
  query: string,
  filter: SearchFilter = {},
): Promise<SearchHit[]> {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  let records = await readAll(project);
  if (filter.session) records = records.filter((r) => r.session === filter.session);
  if (filter.tags?.length) {
    records = records.filter((r) => (filter.tags as string[]).every((t) => r.tags.includes(t)));
  }

  const hits: SearchHit[] = [];
  for (const r of records) {
    const haystack = [r.title, r.summary ?? "", r.tags.join(" "), r.content].join("\n").toLowerCase();
    const score = countOccurrences(haystack, terms);
    if (terms.length === 0 || score > 0) {
      hits.push({ ...metaOf(r), snippet: makeSnippet(r.content, terms), score });
    }
  }

  hits.sort((a, b) => b.score - a.score || (b.updated || "").localeCompare(a.updated || ""));
  return hits.slice(0, filter.limit ?? 10);
}

export async function deleteMemory(project: string, id: string): Promise<{ id: string; deleted: boolean }> {
  const clean = sanitizeId(id);
  if (!clean) return { id, deleted: false };
  const file = fileFor(project, clean);
  if (!existsSync(file)) return { id: clean, deleted: false };
  await fs.unlink(file);
  return { id: clean, deleted: true };
}
