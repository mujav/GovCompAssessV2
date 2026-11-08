// Conversations between a workspace's Index Owners and each of its Control Owners. One thread per
// Control Owner per workspace: messages about a control are that control's comments, so they also
// show on the review screen; general messages sit beside them; returns and deadline follow-ups
// appear in the thread as events.

import type { CycleState, FollowUp } from "./use-cycle";

export interface ChatMessage {
  id: string;
  by: string;
  role: string;
  at: string;
  text: string;
  /** The control the message is about. */
  control?: string;
  /** Set on events the workflow sent rather than a person typed. */
  event?: FollowUp["kind"];
}

export const convKey = (workspaceId: string, owner: string) => `${workspaceId}|${owner}`;

type ThreadSource = Pick<CycleState, "comments" | "followUps"> & Pick<Partial<CycleState>, "chat">;

/** Everything said between the Index Owners and one Control Owner, oldest first. */
export function threadOf(cycle: ThreadSource, owner: string, controls: string[]): ChatMessage[] {
  const about = controls.flatMap((code) => (cycle.comments[code] ?? []).map((m): ChatMessage => ({ ...m, control: code })));
  const events = cycle.followUps.filter((f) => f.to === owner).map((f): ChatMessage => ({ id: f.id, by: f.by, role: "", at: f.at, text: f.text, control: f.control, event: f.kind }));
  return [...(cycle.chat?.[owner] ?? []), ...about, ...events].sort((a, b) => a.at.localeCompare(b.at));
}

/** Messages from others since this person last read the thread. */
export const unreadIn = (thread: ChatMessage[], me: string, lastRead = "") => thread.filter((m) => m.by !== me && m.at > lastRead).length;
