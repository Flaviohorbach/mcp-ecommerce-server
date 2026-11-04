import type { Metadata } from "next";
import { Figtree, JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";

const body = Figtree({ variable: "--font-body", subsets: ["latin"] });
const display = Outfit({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Servidor MCP de e-commerce",
  description: "Catálogo, estoque e pedidos de uma loja simulada para qualquer agente de IA, com tokens, escopos e um painel que mostra cada chamada.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${display.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
