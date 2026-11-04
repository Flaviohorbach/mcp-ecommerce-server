import { Playground } from "@/components/playground";

const STDIO_CONFIG = `{
  "mcpServers": {
    "loja": {
      "command": "npx",
      "args": ["-y", "mcp-ecommerce-server"]
    }
  }
}`;

const HTTP_EXAMPLE = `curl -X POST https://mcp-ecommerce-server.vercel.app/api/mcp \\
  -H "Authorization: Bearer demo-catalog-only" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header>
        <p className="font-display text-sm font-semibold tracking-wide text-accent">Servidor MCP de e-commerce</p>
        <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">Uma loja que qualquer agente de IA consegue consultar</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Catálogo, estoque e pedidos numa API simulada no formato da VTEX, expostos pelo Model Context Protocol. Troque de token e veja o mesmo agente ganhar ou perder ferramentas. Tudo aqui é dado fictício.
        </p>
      </header>

      <Playground />

      <section aria-labelledby="connect" className="mt-10">
        <h2 id="connect" className="font-display text-xl font-semibold">Conecte o seu agente</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">Local (Claude Desktop, Claude Code, Cursor)</h3>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface p-3 font-mono text-xs">{STDIO_CONFIG}</pre>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium">Pela web, com token</h3>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface p-3 font-mono text-xs">{HTTP_EXAMPLE}</pre>
            <p className="mt-2 text-xs text-muted">O endpoint fica em <code className="font-mono">/api/mcp</code> deste site. Os tokens de demonstração são públicos porque só alcançam dados fictícios.</p>
          </div>
        </div>
      </section>

      <footer className="mt-12 border-t border-line pt-4 text-xs text-muted">
        Projeto de portfólio. Pessoas, endereços e pedidos são fictícios; produtos e fotos: <a className="underline" href="https://dummyjson.com">DummyJSON</a>. Não é um produto da VTEX nem tem vínculo com ela.
      </footer>
    </main>
  );
}
