import { z } from "zod";

// Raw Zod shapes are passed straight to the MCP SDK's `registerTool({ inputSchema })`,
// where they double as argument validation and the advertised JSON input schema.

// Memories are partitioned per project. `project` is the working directory name
// (e.g. the current repo folder); omit to use the shared bucket.
const project = z.string().optional().describe("Project the memory belongs to (the working directory name); omit for the shared bucket");

export const saveMemoryShape = {
  project,
  title: z.string().min(1).describe("Short human-readable title for this memory"),
  content: z.string().min(1).describe("The full markdown context/notes to remember"),
  tags: z.array(z.string()).optional().describe("Topic keywords for later search/filtering"),
  session: z.string().optional().describe("Optional session/conversation id to group memories"),
  summary: z.string().optional().describe("One-line recap shown in search/list results"),
  id: z.string().optional().describe("Existing memory id to update in place; omit to create a new one"),
};

export const searchMemoryShape = {
  project,
  query: z.string().min(1).describe("Keywords to match across title, tags, summary and body"),
  tags: z.array(z.string()).optional().describe("Only include memories that have all of these tags"),
  session: z.string().optional().describe("Only include memories from this session"),
  limit: z.number().int().positive().max(50).optional().describe("Max results to return (default 10)"),
};

export const getMemoryShape = {
  project,
  id: z.string().min(1).describe("The memory id (filename stem) to retrieve"),
};

export const listMemoriesShape = {
  project,
  session: z.string().optional().describe("Only list memories from this session"),
  tag: z.string().optional().describe("Only list memories carrying this tag"),
  limit: z.number().int().positive().max(100).optional().describe("Max items to return (default 20)"),
  sort: z.enum(["recent", "oldest"]).optional().describe("Order by last-updated time (default recent)"),
};

export const deleteMemoryShape = {
  project,
  id: z.string().min(1).describe("The memory id (filename stem) to delete"),
};
