# AI log: what the agent got wrong

Built with a coding agent (Claude Code), as in [project 5](https://github.com/Flaviohorbach/legacy-storefront-refactor). These happened while building this project.

### 1. Starting on the old SDK line

The first check of the package found `@modelcontextprotocol/sdk` 1.32, and the plan assumed it. Its README says v1 is now the maintenance line, and that the 2026-07-28 spec only ships in v2, under new package names. **Caught by:** reading the README before writing code. **Fix:** built on `@modelcontextprotocol/server` and `client` 2.x, which also answer clients on the 2025 protocol.

### 2. A request with no Host header

18 of the first 30 tests failed with "Missing Host header". They call the endpoint directly, without a network, so the header a real HTTP client adds was absent, and the DNS-rebinding check rejected every call. The check was right; the tests and the in-process client were wrong. **Caught by:** the tests. **Fix:** the in-process fetch sets `Host`, like a real request.

### 3. A broken path, written twice

The dev server entry was written through a shell script, and the backslashes of the Windows path disappeared. The rewrite, also through the shell, lost them again. The server "started" but never listened. **Caught by:** the server log, after requests got no response at all. **Fix:** forward slashes, which need no escaping.

### 4. An error message that claimed too much

The panel said "today's free quota is over" on any 429. The logs showed otherwise: one model overloaded, one out of daily quota and one rate-limited at that moment. A visitor would have been told to come back tomorrow when a minute could have been enough. **Caught by:** checking each model's real error before believing the message. **Fix:** the message now only says the limit was reached, and a fourth model joined the fallback chain.

### 5. Checks that pass over a wrong answer

The evaluation scored 12 of 12, but the rules only look for tools and words. One passing answer promises to forward a refund request to the human team, and the agent has no tool for that. **Caught by:** reading the answers instead of stopping at the score. **Fix:** the README reports both. The prompt was not changed to chase this, because that needs a new run on quota, and a real fix belongs with the next project's actions.

## What needed a human

- Choosing to host the server as well as run it locally, which is what makes tokens and rate limits real rather than decorative.
- Asking for a panel that shows each protocol call, so someone can see the project working without installing anything.
