import { connectAs } from "@/lib/mcp-client";
import { isPersonaId } from "@/lib/personas";

/** What a persona's token really gets from the server, so the panel never hardcodes it. */
export async function GET(request: Request) {
  const persona = new URL(request.url).searchParams.get("persona");
  if (!isPersonaId(persona)) return new Response("Perfil inválido.", { status: 400 });
  const client = await connectAs(persona);
  try {
    const { tools } = await client.listTools();
    return Response.json({ tools: tools.map((t) => t.name) });
  } finally {
    await client.close();
  }
}
