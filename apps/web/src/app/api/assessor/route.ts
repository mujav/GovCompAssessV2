import Anthropic from "@anthropic-ai/sdk";
import type { AssessInput } from "@/lib/assessor/assessor";
import { runAssessment } from "@/lib/assessor/run";

export const maxDuration = 300;

const MAX_CHARS = 150000;

// POST /api/assessor  { input: AssessInput }  ->  AssessRun
// The input carries one requirement, its criteria and the text of the uploaded evidence.
export async function POST(req: Request) {
  const { input } = (await req.json().catch(() => ({}))) as { input?: AssessInput };
  if (!input?.code || !Array.isArray(input.criteria) || !input.criteria.length) return Response.json({ error: "A requirement with criteria is required." }, { status: 400 });
  if (!Array.isArray(input.evidence) || !input.evidence.some((d) => d.pages?.some((p) => p.text?.trim()))) return Response.json({ error: "No readable evidence text to assess." }, { status: 400 });
  const size = input.evidence.reduce((a, d) => a + d.pages.reduce((b, p) => b + (p.text?.length ?? 0), 0), 0);
  if (size > MAX_CHARS) return Response.json({ error: `The evidence is too long to assess in one go (${size} characters, limit ${MAX_CHARS}). Upload the relevant pages.` }, { status: 413 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "The AI assessor is not configured (ANTHROPIC_API_KEY is missing).", code: "no_key" }, { status: 503 });

  try {
    return Response.json(await runAssessment(input));
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return Response.json({ error: "Invalid ANTHROPIC_API_KEY", code: "no_key" }, { status: 500 });
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "Rate limited, try again shortly" }, { status: 429 });
    if (err instanceof Anthropic.APIError) return Response.json({ error: err.message }, { status: err.status ?? 502 });
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
