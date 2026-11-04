// Who the visitor can act as. Safe for the browser: the tokens stay on the server.
export type PersonaId = "customer" | "support" | "catalog";

export interface Persona {
  id: PersonaId;
  label: string;
  description: string;
  scopes: string[];
  examples: string[];
}

export const PERSONAS: Persona[] = [
  {
    id: "customer",
    label: "Cliente (Ana)",
    description: "Vê o catálogo e só os próprios pedidos. Não vê estoque por depósito.",
    scopes: ["catalog:read", "orders:read:own"],
    examples: ["Quais são os meus pedidos?", "Onde está o pedido v502102lvtx-01?", "Mostre o pedido v502104lvtx-01", "Qual o prazo para devolver por arrependimento?"],
  },
  {
    id: "support",
    label: "Atendente",
    description: "Vê o catálogo, o estoque e os pedidos de todos os clientes.",
    scopes: ["catalog:read", "inventory:read", "orders:read:all"],
    examples: ["Temos estoque do Perfume Chanel Coco Noir?", "Quais pedidos do bruno.lima@example.com?", "Resuma o pedido v502106lvtx-01", "Quais pedidos estão com pagamento pendente?"],
  },
  {
    id: "catalog",
    label: "Só catálogo",
    description: "Integração que só consulta produtos. Para ela, pedidos não existem.",
    scopes: ["catalog:read"],
    examples: ["Tem perfume até 400 reais?", "Onde está o pedido v502101lvtx-01?"],
  },
];

export const isPersonaId = (value: unknown): value is PersonaId => PERSONAS.some((p) => p.id === value);

/** Every tool the server has, so the panel can show the ones a token does not get. */
export const ALL_TOOLS = ["search_products", "get_product", "check_inventory", "list_orders", "get_order"];
