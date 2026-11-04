import { defineConfig } from "tsup";

// The npm package is only this file: JSON fixtures are inlined, and Next.js, React
// and the AI SDK (the demo panel) stay out of what people install.
export default defineConfig({
  entry: ["src/mcp/stdio.ts"],
  format: "esm",
  target: "node20",
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
