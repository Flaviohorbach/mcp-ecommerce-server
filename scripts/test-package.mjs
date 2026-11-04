// Starts the built package the way an MCP host does and lists its tools over stdio.
// Unit tests run the source: this catches a bundle that is broken or prints to stdout.
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { strict as assert } from "node:assert";

const client = new Client({ name: "package-test", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: ["dist/stdio.js"] }));

const { tools } = await client.listTools();
assert.deepEqual(tools.map((t) => t.name).sort(), ["check_inventory", "get_order", "get_product", "list_orders", "search_products"]);

const order = await client.callTool({ name: "get_order", arguments: { orderId: "v502101lvtx-01" } });
assert.equal(order.structuredContent.orderId, "v502101lvtx-01");

await client.close();
console.log(`stdio package OK: ${tools.length} tools`);
