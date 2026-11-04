import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { DEMO_TOKENS, loadPrincipals } from "../mcp/auth";
import { createMcpEndpoint, deploymentHostnames } from "../mcp/http";
import { simulatedVtex } from "../mcp/simulated-vtex";
import type { PersonaId } from "./personas";

export const mcpEndpoint = createMcpEndpoint({
  vtex: simulatedVtex,
  principals: loadPrincipals(),
  allowedHostnames: deploymentHostnames(),
});

/**
 * The panel's agent is an ordinary MCP client: same token, same checks and same
 * protocol as anyone outside. Only the network hop is skipped, so a demo request
 * does not start a second serverless function.
 */
export async function connectAs(persona: PersonaId): Promise<Client> {
  const client = new Client({ name: "demo-panel", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
    requestInit: { headers: { authorization: `Bearer ${DEMO_TOKENS[persona]}` } },
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("host", "localhost");
      return mcpEndpoint(new Request(input, { ...init, headers }));
    },
  });
  await client.connect(transport);
  return client;
}
