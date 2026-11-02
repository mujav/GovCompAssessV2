// Server-only Claude client. The API key is read from ANTHROPIC_API_KEY (apps/web/.env)
// and must never be imported into a client component.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

let client: Anthropic | null = null;

export function getClaude(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export type AskOptions = {
  system?: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
};

// Single-turn helper: send a prompt, get the text back. Uses the server-side
// refusal fallback so a safety-classifier decline is retried on another model.
export async function askClaude(prompt: string, opts: AskOptions = {}): Promise<string> {
  const response = await getClaude().beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    output_config: { effort: opts.effort ?? "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined to answer this request.");
  }

  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}
