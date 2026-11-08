// Server-only half of the AI assessor: one structured-output call to Claude per requirement.
import "server-only";
import { getClaude, tierParams } from "@/lib/llm/claude";
import { policyBlock, policyTag, type AgentPolicy } from "./policy";
import { buildPrompt, checkOutput, OUTPUT_SCHEMA, PROMPT_VERSION, SYSTEM_PROMPT, type AssessInput, type AssessResult } from "./assessor";

export interface AssessRun extends AssessResult {
  runId: string;
  model: string;
  promptVersion: string;
  ms: number;
  usage: { input: number; output: number };
}

export async function runAssessment(input: AssessInput, policy: AgentPolicy = {}): Promise<AssessRun> {
  const started = Date.now();
  // Streamed: several uploaded files can run past the SDK's non-streaming time limit.
  const response = await getClaude()
    .beta.messages.stream({
    ...tierParams(policy.tier),
    max_tokens: 16000,
    system: SYSTEM_PROMPT + policyBlock(policy),
    // Assessment is intelligence-sensitive; Opus 5.5 defaults to medium.
    output_config: { effort: "high", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{ role: "user", content: buildPrompt(input) }],
  })
    .finalMessage();

  if (response.stop_reason === "refusal") throw new Error("Claude declined to assess this requirement.");
  if (response.stop_reason === "max_tokens") throw new Error("Assessment was cut off before it finished.");

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    ...checkOutput(input, JSON.parse(text)),
    runId: `MR-${response.id.slice(-5).toUpperCase()}`,
    model: response.model,
    promptVersion: PROMPT_VERSION + policyTag(policy),
    ms: Date.now() - started,
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
  };
}
