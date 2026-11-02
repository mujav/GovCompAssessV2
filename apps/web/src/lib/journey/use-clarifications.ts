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

/** The entity's clarifications for one framework: one list, read by the Clarifications page and each requirement. */
export function useClarifications(clientId: string, framework: EntityFramework | undefined, workspace: boolean, reqs: WsRequirement[], ws: ReturnType<typeof useWorkspace>) {
  const base = ws.ctx.clarifications[0];
  const pick = (n: number, from: number) => reqs.slice(from, from + n).map((r) => r.code);
  // The seeded questions are DGA (Qiyas) clarifications; other frameworks start with none.
  const seed: Clarification[] =
    !workspace || !base
      ? []
      : [
          {
            id: base.id,
            status: "ans",
            q: "Is a prior-cycle sample valid for unchanged integrations?",
            affects: base.affects,
            when: "24 Oct",
            said: "يجب أن يكون النموذج التطبيقي من الدورة الحالية، ولا يُقبل نموذج الدورة السابقة.",
            meaning: base.title + ", even for unchanged systems.",
          },
          { id: "CL-015", status: "sub", q: "Does a staging transaction count?", affects: pick(2, 40), when: "8 days waiting" },
          { id: "CL-016", status: "draft", q: "Is 5.7.1 not applicable for shared hosting?", affects: pick(1, 120), when: "AI draft" },
          { id: "CL-012", status: "done", q: "Approval level for the data policy", affects: pick(3, 200), when: "2 Oct", said: "تكفي موافقة رئيس الجهة.", meaning: "Approval by the head of the entity is enough." },
        ];
  return useScreenState<{ list: Clarification[]; sel: number }>(workspace || !framework ? `clar.${clientId}` : `clar.${clientId}.${framework.id}`, { list: seed, sel: 0 });
}

/** Next free clarification number. */
export function nextClarificationId(list: Clarification[]) {
  const n = Math.max(16, ...list.map((c) => Number(c.id.replace(/\D/g, "")) || 0));
  return `CL-${String(n + 1).padStart(3, "0")}`;
}
