// Does an agent use this server correctly? Runs each question through a real MCP
// connection and a real model, then checks with fixed rules which tools it called
// and what it said. Resumable, because every question spends free quota.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateText, stepCountIs } from "ai";
import { buildAgentTools, buildSystemPrompt, readPolicy } from "../src/lib/agent";
import { connectAs } from "../src/lib/mcp-client";
import { createShopModel } from "../src/lib/model";
import type { PersonaId } from "../src/lib/personas";

interface Case {
  id: string;
  persona: PersonaId;
  question: string;
  mustCall?: string[];
  mustNotCall?: string[];
  mustContain?: string[];
  mustNotContain?: string[];
}
interface Result {
  id: string;
  persona: PersonaId;
  question: string;
  called: string[];
  answer: string;
  pass: boolean;
  problems: string[];
}

const OUTPUT = "eval/results.json";
const cases: Case[] = JSON.parse(readFileSync("eval/cases.json", "utf8"));
const results: Result[] = existsSync(OUTPUT) ? JSON.parse(readFileSync(OUTPUT, "utf8")) : [];
const lower = (text: string) => text.toLowerCase();

for (const item of cases) {
  if (results.some((r) => r.id === item.id)) continue;
  const client = await connectAs(item.persona);
  const tools = await buildAgentTools(client);
  const { text, steps } = await generateText({
    model: createShopModel(),
    system: buildSystemPrompt(item.persona, await readPolicy(client), "2026-11-04"),
    prompt: item.question,
    tools,
    stopWhen: stepCountIs(5),
    maxRetries: 0,
    temperature: 0.2,
  });
  await client.close();

  const called = steps.flatMap((step) => step.toolCalls.map((call) => call.toolName));
  const problems = [
    ...(item.mustCall ?? []).filter((name) => !called.includes(name)).map((name) => `did not call ${name}`),
    ...(item.mustNotCall ?? []).filter((name) => called.includes(name)).map((name) => `called ${name}`),
    ...(item.mustContain ?? []).filter((part) => !lower(text).includes(lower(part))).map((part) => `answer lacks "${part}"`),
    ...(item.mustNotContain ?? []).filter((part) => lower(text).includes(lower(part))).map((part) => `answer has "${part}"`),
  ];
  results.push({ id: item.id, persona: item.persona, question: item.question, called, answer: text, pass: problems.length === 0, problems });
  writeFileSync(OUTPUT, JSON.stringify(results, null, 2) + "\n");
  console.log(`${problems.length === 0 ? "PASS" : "FAIL"} ${item.id} [${called.join(", ")}] ${problems.join("; ")}`);
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}

console.log(`${results.filter((r) => r.pass).length}/${results.length} passed`);
