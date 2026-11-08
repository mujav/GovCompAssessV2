import Anthropic from "@anthropic-ai/sdk";
import { runTranscribe } from "@/lib/llm/framework-extract";

export const maxDuration = 120;

// The API takes images up to 5 MB, which is this many base64 characters.
const MAX_IMAGE = 6_990_000;

// POST /api/frameworks/transcribe
//   { image, tier }  ->  { text, model, ms, usage }: the text of one scanned page or picture (JPEG, base64).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { image?: unknown; tier?: unknown } | null;
  if (!body || typeof body.image !== "string" || !body.image) return Response.json({ error: "image is required" }, { status: 400 });
  if (body.image.length > MAX_IMAGE) return Response.json({ error: "The page image is too large." }, { status: 413 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "AI extraction is not configured (ANTHROPIC_API_KEY is missing).", code: "no_key" }, { status: 503 });

  try {
    return Response.json(await runTranscribe(body.image, body.tier === "Fast" ? "Fast" : "Standard"));
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return Response.json({ error: "Invalid ANTHROPIC_API_KEY", code: "no_key" }, { status: 500 });
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "Rate limited, try again shortly" }, { status: 429 });
    if (err instanceof Anthropic.APIError) return Response.json({ error: err.message }, { status: err.status ?? 502 });
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
