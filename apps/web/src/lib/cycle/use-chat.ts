"use client";

import { useCallback, useMemo } from "react";
import { ROLE_OF } from "@/lib/auth/accounts";
import { useAuth } from "@/lib/auth/store";
import { useJourney, useScreenState } from "@/lib/journey/store";
import { useWorkplacesWork } from "@/lib/journey/use-work";
import { useMyWorkplaces } from "@/lib/journey/use-workplaces";
import { workplaceLabel } from "@/lib/journey/workplaces";
import { convKey, threadOf, unreadIn, type ChatMessage } from "./chat";
import { workspaceCycle } from "./periods";
import { controlsOf, cycleKey, entityMeta, seededCycle, usePlatform, type CycleControl, type CycleState } from "./use-cycle";

export interface Conversation {
  key: string;
  workspaceId: string;
  workspace: string;
  /** The Control Owner this thread is with. */
  owner: string;
  department: string;
  indexOwners: string[];
  controls: { code: string; title: string }[];
  messages: ChatMessage[];
  unread: number;
  /** A closed year can be read but not added to. */
  closed: boolean;
}

/** The signed-in Index Owner's or Control Owner's conversations, most recent first. */
export function useConversations() {
  const { user } = useAuth();
  const views = useMyWorkplaces();
  const chats = user?.role === "owner" || user?.role === "control";
  const work = useWorkplacesWork(chats ? views : NO_VIEWS);
  const { state, update } = useJourney();
  const { platform } = usePlatform();
  const [read, setRead] = useScreenState<Record<string, string>>(`chat.read.${user?.id ?? ""}`, NOTHING_READ);

  const list = useMemo(() => {
    if (!user) return [] as Conversation[];
    const out = work.flatMap((w) => {
      const cycle = (state.screens[cycleKey(w.client.id)] as CycleState | undefined) ?? seededCycle();
      const annex = entityMeta(platform, { id: w.entity.id, sub: w.entity.sub }).annex;
      const controls = (controlsOf(w.reqs, w.overlay, cycle, w.framework?.live.requirements, annex) as CycleControl[]).filter((c) => c.applicable && c.owner && (user.role !== "control" || c.owner === user.name));
      const closed = workspaceCycle(state.screens[cycleKey(w.client.id)], w.framework?.live.cycles).closed;
      return [...new Set(controls.map((c) => c.owner))].map((owner): Conversation => {
        const own = controls.filter((c) => c.owner === owner);
        const key = convKey(w.client.id, owner);
        const messages = threadOf(cycle, owner, own.map((c) => c.code));
        return {
          key,
          workspaceId: w.client.id,
          workspace: `${w.entity.name} · ${workplaceLabel(w.framework?.name ?? w.client.frameworks[0] ?? "", w.workplace.year)}`,
          owner,
          department: own[0].department,
          indexOwners: w.owners.map((o) => o.name),
          controls: own.map((c) => ({ code: c.code, title: c.title })),
          messages,
          unread: unreadIn(messages, user.name, read[key]),
          closed,
        };
      });
    });
    return out.sort((a, b) => (b.messages.at(-1)?.at ?? "").localeCompare(a.messages.at(-1)?.at ?? "") || a.owner.localeCompare(b.owner));
  }, [user, work, state.screens, platform, read]);

  /** Adds a message: one about a control goes on that control's thread, the rest on the conversation. */
  const send = useCallback(
    (c: Conversation, text: string, control?: string) => {
      if (!user || c.closed || !text.trim()) return;
      const at = new Date().toISOString();
      const m = { id: `m-${Date.now()}`, by: user.name, role: ROLE_OF[user.role].label, at, text: text.trim() };
      update((s) => {
        const cy = (s.screens[cycleKey(c.workspaceId)] ??= seededCycle()) as CycleState;
        if (control) (cy.comments[control] ??= []).push(m);
        else ((cy.chat ??= {})[c.owner] ??= []).push(m);
      });
    },
    [user, update],
  );

  const markRead = useCallback((key: string, at: string) => setRead((d) => void (d[key] = at)), [setRead]);

  return { list, send, markRead, unread: list.reduce((a, c) => a + c.unread, 0) };
}

// Stable empties, so the list above is only rebuilt when something changed.
const NO_VIEWS: ReturnType<typeof useMyWorkplaces> = [];
const NOTHING_READ: Record<string, string> = {};
