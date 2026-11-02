// Server-only half of AI framework extraction: one structured-output call to Claude per
// outline or page chunk. Prompts, schemas and merging live in src/lib/engine/ai-extract.ts.
import "server-only";
import { CLAUDE_MODEL, getClaude } from "@/lib/llm/claude";
import {
  buildChunkPrompt,
  buildOutlinePrompt,
  CHUNK_SCHEMA,
  CHUNK_SYSTEM,
  OUTLINE_SCHEMA,
  OUTLINE_SYSTEM,
  type AiNode,
  type AiOutline,
  type SourcePage,
} from "@/lib/engine/ai-extract";

export interface CallStats {
  model: string;
  ms: number;
  usage: { input: number; output: number };
}

async function structured<T>(system: string, prompt: string, schema: { [key: string]: unknown }, maxTokens: number): Promise<{ data: T } & CallStats> {
  const started = Date.now();
  // Streamed because a large chunk can run past the SDK's non-streaming time limit.
  const response = await getClaude()
    .beta.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      // Transcription with light structuring: low effort keeps a 150-page document to minutes.
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: prompt }],
    })
    .finalMessage();

  if (response.stop_reason === "refusal") throw new Error("Claude declined to read these pages.");
  if (response.stop_reason === "max_tokens") throw new Error("The extraction was cut off before it finished. Try a smaller file.");

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { data: JSON.parse(text) as T, model: response.model, ms: Date.now() - started, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens } };
}

export async function runOutline(pages: SourcePage[], total: { files: string[]; pages: number }) {
  const r = await structured<AiOutline>(OUTLINE_SYSTEM, buildOutlinePrompt(pages, total), OUTLINE_SCHEMA, 16000);
  return { ...r, outline: r.data };
}

export async function runChunk(outline: AiOutline, pages: SourcePage[]) {
  const r = await structured<{ nodes: AiNode[] }>(CHUNK_SYSTEM, buildChunkPrompt(outline, pages), CHUNK_SCHEMA, 48000);
  return { ...r, nodes: r.data.nodes };
}
