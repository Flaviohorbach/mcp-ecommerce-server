import { createMcpHandler, hostHeaderValidationResponse, originValidationResponse } from "@modelcontextprotocol/server";
import { createRateLimiter } from "../lib/rate-limit";
import { verifyBearer, type Principal } from "./auth";
import { createStoreServer } from "./server";
import type { VtexClient } from "./vtex-types";

export interface EndpointOptions {
  vtex: VtexClient;
  principals: Record<string, Principal>;
  allowedHostnames: string[];
  /** Calls per minute for one token. */
  rateLimit?: number;
  /** Failed logins per minute for one address, which is what makes guessing tokens slow. */
  authFailureLimit?: number;
}

const json = (status: number, error: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json", ...headers } });

/**
 * The hosted endpoint, in the order the checks must run: where the request came
 * from, who is calling, how often, and only then the protocol. Works in Next.js
 * and in tests, because it takes a Request and returns a Response.
 */
export function createMcpEndpoint({ vtex, principals, allowedHostnames, rateLimit = 60, authFailureLimit = 20 }: EndpointOptions) {
  const handler = createMcpHandler(
    ({ authInfo }) => createStoreServer(vtex, authInfo!.extra!.principal as Principal),
    { maxRequestBodySize: 64 * 1024, responseMode: "json" },
  );
  const callLimiter = createRateLimiter({ limit: rateLimit, windowMs: 60_000 });
  const failureLimiter = createRateLimiter({ limit: authFailureLimit, windowMs: 60_000 });

  return async function handle(request: Request): Promise<Response> {
    // The handler trusts its caller. These two stop DNS rebinding and calls from other sites' pages.
    const rejected = hostHeaderValidationResponse(request, allowedHostnames) ?? originValidationResponse(request, allowedHostnames);
    if (rejected) return rejected;

    const principal = verifyBearer(request.headers.get("authorization"), principals);
    if (!principal) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
      const { allowed, retryAfterMs } = failureLimiter(ip);
      if (!allowed) return json(429, "Too many failed attempts.", { "retry-after": String(Math.ceil(retryAfterMs / 1000)) });
      return json(401, "Missing or invalid bearer token.", { "www-authenticate": "Bearer" });
    }

    const { allowed, retryAfterMs } = callLimiter(principal.clientId);
    if (!allowed) return json(429, "Rate limit exceeded.", { "retry-after": String(Math.ceil(retryAfterMs / 1000)) });

    return handler.fetch(request, { authInfo: { token: "", clientId: principal.clientId, scopes: principal.scopes, extra: { principal } } });
  };
}

/** The hostnames this deployment answers on. */
export function deploymentHostnames(env: NodeJS.ProcessEnv = process.env): string[] {
  const urls = [env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_URL, env.VERCEL_BRANCH_URL].filter(Boolean) as string[];
  return [...new Set([...urls.map((url) => url.split(":")[0]!), "localhost", "127.0.0.1"])];
}
