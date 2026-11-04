import { mcpEndpoint } from "@/lib/mcp-client";

// The public MCP endpoint. Every check lives in createMcpEndpoint, shared with the tests.
export const POST = (request: Request) => mcpEndpoint(request);
export const GET = (request: Request) => mcpEndpoint(request);
export const DELETE = (request: Request) => mcpEndpoint(request);
