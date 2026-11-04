import { APICallError, convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { z } from "zod";
import { buildAgentTools, buildSystemPrompt, readPolicy } from "@/lib/agent";
import { clientIp } from "@/lib/client-ip";
import { connectAs } from "@/lib/mcp-client";
import { createShopModel, ModelTimeoutError } from "@/lib/model";
import { isPersonaId } from "@/lib/personas";
import { createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

const BodySchema = z.object({
  persona: z.string().refine(isPersonaId),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), parts: z.array(z.object({ type: z.string() }).loose()) }).loose()).min(1).max(12),
});

function friendlyError(error: unknown): string {
  if (error instanceof ModelTimeoutError) return "O modelo demorou demais para responder. Tente de novo.";
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) return "O limite gratuito do modelo foi atingido. Tente de novo mais tarde; o servidor MCP continua no ar.";
    if (error.statusCode === 400 || error.statusCode === 403) return "O serviço de IA recusou a chave de acesso. Avise quem mantém este site.";
    return "O modelo está sobrecarregado no momento. Tente de novo em instantes.";
  }
  return "Não foi possível responder agora. Tente de novo.";
}

export async function POST(request: Request) {
  const { allowed, retryAfterMs } = limiter(clientIp(request));
  if (!allowed) {
    return new Response("Muitas perguntas em pouco tempo. Tente de novo em alguns minutos.", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
    });
  }
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return new Response("Requisição inválida.", { status: 400 });
  const persona = body.data.persona as Parameters<typeof connectAs>[0];

  const client = await connectAs(persona);
  const today = new Date().toISOString().slice(0, 10);
  const tools = await buildAgentTools(client);
  const result = streamText({
    model: createShopModel(),
    system: buildSystemPrompt(persona, await readPolicy(client), today),
    messages: await convertToModelMessages(body.data.messages as unknown as UIMessage[], { tools }),
    tools,
    stopWhen: stepCountIs(5), // A loop guard: a stuck agent must not spend the whole free quota.
    maxRetries: 0, // the fallback chain already moves to another model
    temperature: 0.2,
    onFinish: () => client.close(),
    onError: () => client.close(),
    onAbort: () => client.close(),
  });
  return result.toUIMessageStreamResponse({ onError: friendlyError });
}
