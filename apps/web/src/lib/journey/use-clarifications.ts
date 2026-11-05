"use client";

import type { WsRequirement } from "@/lib/workspace/data";
import type { useWorkspace } from "@/lib/workspace/store";
import type { EntityFramework } from "./frameworks";
import { useScreenState } from "./store";

export type ClarificationStatus = "ans" | "sub" | "draft" | "done";

/** A question to the regulator, the requirements it touches and, once answered, what it means. */
export interface Clarification {
  id: string;
  status: ClarificationStatus;
  q: string;
  affects: string[];
  when: string;
  said?: string;
  meaning?: string;
  /** Requirements the answer has been applied to one by one, from their own page. */
  appliedTo?: string[];
}

const under = (reqs: WsRequirement[], prefix: string) => reqs.filter((r) => r.code.startsWith(prefix)).map((r) => r.code);

/** Questions an entity would put to DGA on Qiyas V5.0, each on the requirements it concerns. */
function qiyasSeed(reqs: WsRequirement[], base: { id: string; title: string; affects: string[] } | undefined): Clarification[] {
  return [
    ...(base
      ? [
          {
            id: base.id,
            status: "ans" as const,
            q: "Is a sample from the last cycle valid when the system has not changed since?",
            affects: base.affects,
            when: "24 Oct",
            said: "يجب أن يكون النموذج التطبيقي من الدورة الحالية، ولا يُقبل نموذج الدورة السابقة.",
            meaning: `${base.title}, even for unchanged systems.`,
          },
        ]
      : []),
    { id: "CL-015", status: "sub", q: "The digital transformation strategy was approved 40 months ago and refreshed by a board resolution last year. Does the resolution meet the 36-month window in 5.1.1?", affects: under(reqs, "5.1.1-"), when: "8 days waiting" },
    { id: "CL-016", status: "draft", q: "Is 5.21.1 (website reliability and security) applicable when the parent ministry hosts and secures the entity's website?", affects: under(reqs, "5.21.1-"), when: "AI draft" },
    { id: "CL-012", status: "done", q: "Who must approve the cloud computing adoption plan in 5.13.2?", affects: under(reqs, "5.13.2-"), when: "2 Oct", said: "تكفي موافقة رئيس الجهة أو من يفوضه.", meaning: "Approval by the head of the entity, or their delegate, is enough." },
  ];
}

/** Questions an entity would put to the NCA on ECC-2:2024. */
function eccSeed(reqs: WsRequirement[]): Clarification[] {
  return [
    { id: "CL-021", status: "ans", q: "Does the cloud provider's independent audit report count as evidence for the hosting controls in 4-2?", affects: under(reqs, "4-2-"), when: "21 Oct", said: "The provider's report is accepted for the provider's responsibilities only; the entity must evidence its own configuration and contract terms.", meaning: "Attach the provider's report and the entity's own configuration and contract evidence." },
    { id: "CL-022", status: "sub", q: "Is an annual penetration test of internet-facing systems enough for 2-11, or must internal systems be tested too?", affects: under(reqs, "2-11-"), when: "5 days waiting" },
    { id: "CL-023", status: "draft", q: "Is 2-6 (mobile devices security) applicable when staff can only use entity-issued devices?", affects: under(reqs, "2-6-"), when: "AI draft" },
    { id: "CL-020", status: "done", q: "Can the Authorized Official's delegate approve the cybersecurity strategy in 1-1-1?", affects: under(reqs, "1-1-1"), when: "29 Sep", said: "Yes, when the delegation is documented and current.", meaning: "A delegate may approve; attach the delegation letter with the strategy." },
  ];
}

/** The entity's clarifications for one framework: one list, read by the Clarifications page and each requirement. */
export function useClarifications(clientId: string, framework: EntityFramework | undefined, workspace: boolean, reqs: WsRequirement[], ws: ReturnType<typeof useWorkspace>) {
  // The demo records come with questions on their own standard; library frameworks start with none.
  const seed: Clarification[] = !workspace ? [] : framework?.id === "fw-nca" ? eccSeed(reqs) : qiyasSeed(reqs, ws.ctx.clarifications[0]);
  return useScreenState<{ list: Clarification[]; sel: number }>(workspace || !framework ? `clar.${clientId}` : `clar.${clientId}.${framework.id}`, { list: seed, sel: 0 });
}

/** Next free clarification number. */
export function nextClarificationId(list: Clarification[]) {
  const n = Math.max(16, ...list.map((c) => Number(c.id.replace(/\D/g, "")) || 0));
  return `CL-${String(n + 1).padStart(3, "0")}`;
}
