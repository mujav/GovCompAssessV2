import { CLAUDE_MODEL, getClaude } from "@/lib/llm/claude";

// GET /api/ai/status  ->  { configured, model, fastModel, ok?, ms?, error? }
// "Test connection" in AI settings: looks the model up (no tokens are spent) and times it.
export async function GET() {
  const fastModel = process.env.ANTHROPIC_FAST_MODEL ?? "claude-haiku-5-5";
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ configured: false, model: CLAUDE_MODEL, fastModel });
  const started = Date.now();
  try {
    await getClaude().models.retrieve(CLAUDE_MODEL);
    return Response.json({ configured: true, model: CLAUDE_MODEL, fastModel, ok: true, ms: Date.now() - started });
  } catch (err) {
    return Response.json({ configured: true, model: CLAUDE_MODEL, fastModel, ok: false, error: (err as Error).message });
  }
}
