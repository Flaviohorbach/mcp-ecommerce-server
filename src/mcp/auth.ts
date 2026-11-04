import { createHash, timingSafeEqual } from "node:crypto";

export type Scope = "catalog:read" | "inventory:read" | "orders:read:own" | "orders:read:all";

/** Who is calling and what they may do. The tools a client can even see are built from this. */
export interface Principal {
  clientId: string;
  scopes: Scope[];
  /** Whose orders `orders:read:own` covers. */
  customerEmail?: string;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Public on purpose: they only reach fake data, and they let anyone try the
 * hosted server. A real deployment replaces them by setting MCP_TOKENS.
 */
export const DEMO_TOKENS = {
  customer: "demo-customer-ana",
  support: "demo-support-agent",
  catalog: "demo-catalog-only",
} as const;

const DEMO_PRINCIPALS: Record<string, Principal> = {
  [hashToken(DEMO_TOKENS.customer)]: { clientId: "demo-customer", scopes: ["catalog:read", "orders:read:own"], customerEmail: "ana.souza@example.com" },
  [hashToken(DEMO_TOKENS.support)]: { clientId: "demo-support", scopes: ["catalog:read", "inventory:read", "orders:read:all"] },
  [hashToken(DEMO_TOKENS.catalog)]: { clientId: "demo-catalog", scopes: ["catalog:read"] },
};

/** MCP_TOKENS holds a JSON object of sha256(token) → principal, so the environment never stores a usable token. */
export function loadPrincipals(raw = process.env.MCP_TOKENS): Record<string, Principal> {
  return raw ? (JSON.parse(raw) as Record<string, Principal>) : DEMO_PRINCIPALS;
}

/** Compares hashes in constant time, so response timing reveals nothing about a token. */
export function verifyBearer(header: string | null, principals: Record<string, Principal>): Principal | null {
  const token = /^Bearer\s+(\S+)$/i.exec(header ?? "")?.[1];
  if (!token) return null;
  const hash = Buffer.from(hashToken(token));
  for (const [known, principal] of Object.entries(principals)) {
    const candidate = Buffer.from(known);
    if (candidate.length === hash.length && timingSafeEqual(candidate, hash)) return principal;
  }
  return null;
}

/** Local stdio has no network caller: whoever runs the process already has the machine. */
export const LOCAL_PRINCIPAL: Principal = { clientId: "local-stdio", scopes: ["catalog:read", "inventory:read", "orders:read:all"] };
