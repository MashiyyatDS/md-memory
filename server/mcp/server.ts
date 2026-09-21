import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  saveMemory,
  searchMemories,
  getMemory,
  listMemories,
  deleteMemory,
} from "../utils/memory-store";
import {
  saveMemoryShape,
  searchMemoryShape,
  getMemoryShape,
  listMemoriesShape,
  deleteMemoryShape,
} from "../requests/memory.request";

const DEFAULT_PROJECT = "shared";

// Guidance surfaced to the model on `initialize`. The automatic (hook) layer already
// recalls context and captures the raw conversation, so the tools are for *curation*.
const INSTRUCTIONS = [
  "This server is an automatic, project-partitioned memory. Relevant past context is",
  "injected into your context automatically at session start and on each user prompt —",
  "you do NOT need to search on the user's behalf, and the user will never save or recall",
  "memories manually. The raw conversation is also captured automatically per session.",
  "",
  "Use the tools only to CURATE high-signal memory:",
  "- Call `save_memory` when a durable decision, preference, constraint, or fact emerges.",
  "  Pass a concise `summary`, useful `tags`, and set `project` to the current working",
  "  directory name so it is filed with the right project.",
  "- Call `search_memory`/`get_memory` only for a deliberate deep lookup beyond what was",
  "  already injected.",
].join("\n");

// Wrap any JSON-serializable result as an MCP text content block.
function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// Builds a fresh MCP server with the memory tools registered. Called once per
// request (stateless transport), so it must stay cheap to construct.
export function buildMcpServer(): McpServer {
  const server = new McpServer(
    { name: "md-mcp", version: "0.2.0" },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "save_memory",
    {
      title: "Save memory",
      description:
        "Curate a durable memory (decision, preference, fact) as a markdown file, filed under `project`. Pass an existing `id` to update in place. Note: raw conversation is already captured automatically — use this for high-signal highlights.",
      inputSchema: saveMemoryShape,
    },
    async (args) => text(await saveMemory(args)),
  );

  server.registerTool(
    "search_memory",
    {
      title: "Search memories",
      description:
        "Keyword search across this project's saved memories (title, tags, summary, body), with optional tag/session filters. Scoped to `project`.",
      inputSchema: searchMemoryShape,
    },
    async ({ project, query, ...filter }) =>
      text(await searchMemories(project ?? DEFAULT_PROJECT, query, filter)),
  );

  server.registerTool(
    "get_memory",
    {
      title: "Get memory",
      description: "Retrieve a single memory's full content and metadata by its id, within `project`.",
      inputSchema: getMemoryShape,
    },
    async ({ project, id }) => {
      const record = await getMemory(project ?? DEFAULT_PROJECT, id);
      return record ? text(record) : text({ error: `No memory found with id "${id}"` });
    },
  );

  server.registerTool(
    "list_memories",
    {
      title: "List memories",
      description:
        "List this project's saved memories (metadata only, no body), most recent first. Optional session/tag filters. Scoped to `project`.",
      inputSchema: listMemoriesShape,
    },
    async ({ project, ...filter }) => text(await listMemories(project ?? DEFAULT_PROJECT, filter)),
  );

  server.registerTool(
    "delete_memory",
    {
      title: "Delete memory",
      description: "Permanently delete a memory by its id, within `project`.",
      inputSchema: deleteMemoryShape,
    },
    async ({ project, id }) => text(await deleteMemory(project ?? DEFAULT_PROJECT, id)),
  );

  return server;
}
