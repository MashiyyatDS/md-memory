import { defineHandler } from "nitro";
import { fromNodeHandler } from "nitro/h3";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "../mcp/server";

// MCP endpoint served at /md-mcp. Register with:
//   claude mcp add --transport http nuxt-ui http://localhost:9000/md-mcp
//
// Uses the official SDK's Streamable-HTTP transport in stateless mode: a fresh
// server + transport is built per POST and torn down when the response closes.
export default defineHandler(async (event) => {
  if (event.req.method !== "POST") {
    // GET (server->client SSE) and DELETE (session teardown) aren't used in
    // stateless mode. Reply with a JSON-RPC-shaped 405.
    event.res.status = 405;
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: "Method Not Allowed. MCP uses HTTP POST." },
    };
  }

  // Parse the JSON-RPC body from the web Request and hand it to the SDK, so it
  // doesn't try to re-read the already-consumed Node stream.
  const body = await event.req.json().catch(() => undefined);

  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no per-session state to persist
    enableJsonResponse: true, // respond with application/json instead of SSE
  });

  // fromNodeHandler bridges the SDK's (req, res) handler into h3 and resolves
  // once the raw Node response has finished, so h3 won't try to double-send.
  return fromNodeHandler(async (req, res) => {
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  })(event);
});
