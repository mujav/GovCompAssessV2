import { describe, expect, it } from "vitest";
import { convKey, threadOf, unreadIn } from "./chat";

const m = (id: string, by: string, at: string) => ({ id, by, role: "Index Owner", at, text: id });
const cycle = {
  comments: { "5.1.1": [m("c1", "Faisal R.", "2026-10-02")], "5.2.1": [m("other", "Lama S.", "2026-10-03")] },
  chat: { "Faisal R.": [m("g1", "Sami R.", "2026-10-01")], "Lama S.": [m("g2", "Sami R.", "2026-10-01")] },
  followUps: [
    { id: "f1", control: "5.1.1", to: "Faisal R.", text: "Returned", at: "2026-10-04", by: "Sami R.", kind: "Return" as const },
    { id: "f2", control: "5.2.1", to: "Lama S.", text: "Returned", at: "2026-10-04", by: "Sami R.", kind: "Return" as const },
  ],
};

describe("chat", () => {
  it("merges one Control Owner's messages, their controls' comments and their events in order", () => {
    const t = threadOf(cycle, "Faisal R.", ["5.1.1"]);
    expect(t.map((x) => x.id)).toEqual(["g1", "c1", "f1"]);
    expect(t[1].control).toBe("5.1.1");
    expect(t[2].event).toBe("Return");
  });

  it("copes with workspaces that have no general messages yet", () => {
    expect(threadOf({ comments: {}, followUps: [] }, "Faisal R.", ["5.1.1"])).toEqual([]);
  });

  it("counts only other people's messages since the last read", () => {
    const t = threadOf(cycle, "Faisal R.", ["5.1.1"]);
    expect(unreadIn(t, "Faisal R.")).toBe(2);
    expect(unreadIn(t, "Faisal R.", "2026-10-04")).toBe(0);
    expect(unreadIn(t, "Sami R.", "2026-10-01")).toBe(1);
  });

  it("keys a conversation by workspace and Control Owner", () => {
    expect(convKey("demo-entity", "Faisal R.")).toBe("demo-entity|Faisal R.");
  });
});
