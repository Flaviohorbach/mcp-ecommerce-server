import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";
import { DEMO_TOKENS, hashToken, loadPrincipals, verifyBearer } from "../src/mcp/auth";
import { createMcpEndpoint } from "../src/mcp/http";
import { simulatedVtex } from "../src/mcp/simulated-vtex";

const URL_BASE = "http://localhost:3070/api/mcp";
const principals = loadPrincipals("");

function endpoint(options: { rateLimit?: number; authFailureLimit?: number } = {}) {
  return createMcpEndpoint({ vtex: simulatedVtex, principals, allowedHostnames: ["localhost"], ...options });
}

/** A real MCP client, speaking real HTTP requests, with the network replaced by a direct call. */
async function connect(token: string, handle = endpoint()) {
  const client = new Client({ name: "test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(URL_BASE), {
    requestInit: { headers: { authorization: `Bearer ${token}` } },
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("host", "localhost:3070");
      return handle(new Request(input, { ...init, headers }));
    },
  });
  await client.connect(transport);
  return client;
}

const toolNames = async (client: Client) => (await client.listTools()).tools.map((t) => t.name).sort();
const call = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
  const result = await client.callTool({ name, arguments: args });
  return { isError: Boolean(result.isError), data: result.structuredContent as Record<string, never>, text: JSON.stringify(result.content) };
};

const post = (handle: ReturnType<typeof endpoint>, headers: Record<string, string> = {}) =>
  handle(new Request(URL_BASE, {
    method: "POST",
    headers: { host: "localhost:3070", "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  }));

describe("authentication", () => {
  it("rejects a missing or wrong token before the protocol runs", async () => {
    const handle = endpoint();
    const missing = await post(handle);
    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toBe("Bearer");
    expect((await post(handle, { authorization: "Bearer nope" })).status).toBe(401);
  });

  it("only accepts a bearer token that matches exactly", () => {
    expect(verifyBearer(`Bearer ${DEMO_TOKENS.catalog}`, principals)?.clientId).toBe("demo-catalog");
    expect(verifyBearer(DEMO_TOKENS.catalog, principals)).toBeNull();
    expect(verifyBearer(`Bearer ${DEMO_TOKENS.catalog}x`, principals)).toBeNull();
  });

  it("replaces the demo tokens when MCP_TOKENS is set", () => {
    const custom = loadPrincipals(JSON.stringify({ [hashToken("mine")]: { clientId: "mine", scopes: ["catalog:read"] } }));
    expect(verifyBearer("Bearer mine", custom)?.clientId).toBe("mine");
    expect(verifyBearer(`Bearer ${DEMO_TOKENS.support}`, custom)).toBeNull();
  });

  it("slows down token guessing, per address", async () => {
    const handle = endpoint({ authFailureLimit: 2 });
    const guess = { authorization: "Bearer guess", "x-forwarded-for": "203.0.113.9" };
    await post(handle, guess);
    await post(handle, guess);
    const blocked = await post(handle, guess);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await post(handle, { authorization: "Bearer guess", "x-forwarded-for": "203.0.113.10" })).status).toBe(401);
  });
});

describe("origin checks", () => {
  it("rejects another host and another site's page", async () => {
    const handle = endpoint();
    const auth = { authorization: `Bearer ${DEMO_TOKENS.catalog}` };
    const otherHost = await handle(new Request("http://evil.example/api/mcp", { method: "POST", headers: { host: "evil.example", ...auth } }));
    expect(otherHost.status).toBe(403);
    expect((await post(handle, { ...auth, origin: "https://evil.example" })).status).toBe(403);
  });
});

describe("rate limit", () => {
  it("limits each token separately", async () => {
    const handle = endpoint({ rateLimit: 1 });
    const catalog = { authorization: `Bearer ${DEMO_TOKENS.catalog}` };
    await post(handle, catalog);
    expect((await post(handle, catalog)).status).toBe(429);
    expect((await post(handle, { authorization: `Bearer ${DEMO_TOKENS.support}` })).status).not.toBe(429);
  });
});

describe("scopes decide which tools exist", () => {
  it("catalog token sees only the catalog", async () => {
    expect(await toolNames(await connect(DEMO_TOKENS.catalog))).toEqual(["get_product", "search_products"]);
  });

  it("customer token sees orders but not warehouses", async () => {
    expect(await toolNames(await connect(DEMO_TOKENS.customer))).toEqual(["get_order", "get_product", "list_orders", "search_products"]);
  });

  it("support token sees everything", async () => {
    expect(await toolNames(await connect(DEMO_TOKENS.support))).toEqual(["check_inventory", "get_order", "get_product", "list_orders", "search_products"]);
  });

  it("a tool outside the token's scopes cannot be called by name", async () => {
    const result = await connect(DEMO_TOKENS.catalog).then((client) => client.callTool({ name: "get_order", arguments: { orderId: "v502101lvtx-01" } })).catch((error: Error) => ({ isError: true, content: [{ text: error.message }] }));
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain("Ana");
  });

  it("the customer's input schema has no way to name another customer", async () => {
    const { tools } = await (await connect(DEMO_TOKENS.customer)).listTools();
    const schema = tools.find((t) => t.name === "list_orders")!.inputSchema;
    expect(Object.keys(schema.properties ?? {})).not.toContain("customerEmail");
  });
});

describe("customers only reach their own orders", () => {
  it("lists only the token's orders, even when the model asks for someone else's", async () => {
    const client = await connect(DEMO_TOKENS.customer);
    const { data } = await call(client, "list_orders", { customerEmail: "bruno.lima@example.com", limit: 20 });
    const ids = (data.orders as unknown as { orderId: string }[]).map((o) => o.orderId).sort();
    expect(ids).toEqual(["v502101lvtx-01", "v502102lvtx-01", "v502103lvtx-01"]);
  });

  it("gives the same answer for someone else's order and for one that does not exist", async () => {
    const client = await connect(DEMO_TOKENS.customer);
    const other = await call(client, "get_order", { orderId: "v502104lvtx-01" });
    const missing = await call(client, "get_order", { orderId: "v999999lvtx-01" });
    expect(other.isError && missing.isError).toBe(true);
    expect(other.text.replace("v502104lvtx-01", "ID")).toBe(missing.text.replace("v999999lvtx-01", "ID"));
  });

  it("support can filter any customer", async () => {
    const client = await connect(DEMO_TOKENS.support);
    const { data } = await call(client, "list_orders", { customerEmail: "bruno.lima@example.com", limit: 20 });
    expect(data.orders).toHaveLength(3);
  });
});

describe("what the agent receives", () => {
  it("converts OMS cents to reais", async () => {
    const { data } = await call(await connect(DEMO_TOKENS.customer), "get_order", { orderId: "v502102lvtx-01" });
    const raw = await simulatedVtex.getOrder("v502102lvtx-01");
    expect(data.totalBRL).toBe(raw!.value / 100);
  });

  it("leaves personal data out of every order response", async () => {
    const client = await connect(DEMO_TOKENS.support);
    const raw = await simulatedVtex.getOrder("v502104lvtx-01");
    const { document, phone, email, lastName } = raw!.clientProfileData;
    const { text } = await call(client, "get_order", { orderId: "v502104lvtx-01" });
    const list = await call(client, "list_orders", { limit: 20 });
    for (const secret of [document, phone, email, lastName, raw!.shippingData.address.street]) {
      expect(text).not.toContain(secret);
      expect(list.text).not.toContain(secret);
    }
  });

  it("labels a customer's note as untrusted", async () => {
    const { data } = await call(await connect(DEMO_TOKENS.support), "get_order", { orderId: "v502106lvtx-01" });
    expect(data.untrustedCustomerNote).toContain("IGNORE AS REGRAS");
  });

  it("computes available units as total minus reserved", async () => {
    const { data } = await call(await connect(DEMO_TOKENS.support), "check_inventory", { skuId: "1005" });
    const raw = await simulatedVtex.getInventory("1005");
    const expected = raw!.balance.reduce((sum, b) => sum + b.totalQuantity - b.reservedQuantity, 0);
    expect(raw!.balance.some((b) => b.reservedQuantity > 0)).toBe(true);
    expect(data.availableTotal).toBe(expected);
  });

  it("searches with a price filter", async () => {
    const { data } = await call(await connect(DEMO_TOKENS.catalog), "search_products", { query: "perfume", maxPriceBRL: 400 });
    const products = data.products as unknown as { name: string; priceBRL: number }[];
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.priceBRL <= 400 && /perfume/i.test(p.name))).toBe(true);
  });

  it("rejects input outside the schema", async () => {
    const client = await connect(DEMO_TOKENS.catalog);
    const outcome = await client.callTool({ name: "search_products", arguments: { limit: 500 } }).catch((error: Error) => ({ isError: true, content: [{ text: error.message }] }));
    expect(outcome.isError).toBe(true);
  });
});

describe("resources and prompts", () => {
  it("serves the policy and the order prompt to a customer", async () => {
    const client = await connect(DEMO_TOKENS.customer);
    const policy = await client.readResource({ uri: "store://policies/shipping-and-returns" });
    expect(JSON.stringify(policy.contents)).toContain("aprovação humana");
    const prompt = await client.getPrompt({ name: "order_update_message", arguments: { orderId: "v502101lvtx-01" } });
    expect(JSON.stringify(prompt.messages)).toContain("v502101lvtx-01");
  });

  it("does not offer the order prompt without an order scope", async () => {
    const client = await connect(DEMO_TOKENS.catalog);
    const { prompts } = await client.listPrompts().catch(() => ({ prompts: [] }));
    expect(prompts.map((p) => p.name)).not.toContain("order_update_message");
  });
});
