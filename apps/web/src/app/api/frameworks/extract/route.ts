import Anthropic from "@anthropic-ai/sdk";
import type { AiOutline, SourcePage } from "@/lib/engine/ai-extract";
import { runChunk, runOutline } from "@/lib/llm/framework-extract";

export const maxDuration = 300;

const MAX_CHARS = 60000;

type Body =
  | { step: "outline"; pages: SourcePage[]; total: { files: string[]; pages: number } }
  | { step: "chunk"; pages: SourcePage[]; outline: AiOutline };

// POST /api/frameworks/extract
//   { step: "outline", pages, total }  ->  { outline, model, ms, usage }
//   { step: "chunk", pages, outline }  ->  { nodes, model, ms, usage }
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !Array.isArray(body.pages) || !body.pages.length) return Response.json({ error: "pages are required" }, { status: 400 });
  const size = body.pages.reduce((a, p) => a + String(p.text ?? "").length, 0);
  if (size > MAX_CHARS) return Response.json({ error: `Too much text in one request (${size} characters, limit ${MAX_CHARS}).` }, { status: 413 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "AI extraction is not configured (ANTHROPIC_API_KEY is missing).", code: "no_key" }, { status: 503 });

  try {
    if (body.step === "outline") {
      const r = await runOutline(body.pages, body.total ?? { files: [], pages: body.pages.length });
      return Response.json({ outline: r.outline, model: r.model, ms: r.ms, usage: r.usage });
    }
    if (body.step === "chunk" && body.outline) {
      const r = await runChunk(body.outline, body.pages);
      return Response.json({ nodes: r.nodes, model: r.model, ms: r.ms, usage: r.usage });
    }
    return Response.json({ error: "step must be outline or chunk" }, { status: 400 });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Invalid ANTHROPIC_API_KEY", code: "no_key" }, { status: 500 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Rate limited, try again shortly" }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: err.message }, { status: err.status ?? 502 });
    }
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
