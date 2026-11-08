"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/journey/icon";
import { AppShell, JMain } from "@/components/journey/shell";
import { Avatar, inputClass, JButton, Panel, Pill } from "@/components/journey/ui";
import { fmtWhen } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import { useAuth } from "@/lib/auth/store";
import { convKey, type ChatMessage } from "@/lib/cycle/chat";
import { useConversations, type Conversation } from "@/lib/cycle/use-chat";
import { initialsOf } from "@/lib/journey/people";
import { clientHref } from "@/lib/journey/portfolio";

// Chat between a workspace's Index Owners and its Control Owners: one conversation per Control
// Owner per workspace, with messages tagged to a control and the workflow's returns and deadlines.

export default function MessagesPage() {
  return (
    <Suspense>
      <Messages />
    </Suspense>
  );
}

function Messages() {
  const params = useSearchParams();
  const { user } = useAuth();
  const { list, send, markRead } = useConversations();
  const [picked, setPicked] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [space, setSpace] = useState("all");
  const within = params.get("w") ?? undefined;
  const linked = within && params.get("o") ? convKey(within, params.get("o")!) : null;
  const key = picked ?? linked ?? (list.find((c) => c.workspaceId === within) ?? list[0])?.key;
  const open = list.find((c) => c.key === key) ?? list[0];
  const isControl = user?.role === "control";
  const workspaces = useMemo(() => [...new Map(list.map((c) => [c.workspaceId, c.workspace])).entries()], [list]);
  const shown = list.filter((c) => (space === "all" || c.workspaceId === space) && (!q || `${c.owner} ${c.department} ${c.workspace}`.toLowerCase().includes(q.toLowerCase())));
  const last = open?.messages.at(-1)?.at;

  useEffect(() => {
    if (open && last && open.unread) markRead(open.key, last);
  }, [open, last, markRead]);

  return (
    <AppShell clientId={within} search="Search messages">
      <JMain>
        <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Messages</h1>
        <Panel className="grid min-h-[560px] grid-cols-1 overflow-hidden p-0 md:h-[calc(100vh-200px)] md:grid-cols-[340px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-b border-j-line md:border-e md:border-b-0">
            <div className="flex flex-col gap-2 border-b border-j-line-soft p-3">
              <input aria-label="Search conversations" placeholder="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} className={cx(inputClass, "h-10")} />
              {workspaces.length > 1 && (
                <select aria-label="Workspace" value={space} onChange={(e) => setSpace(e.target.value)} className={cx(inputClass, "h-10")}>
                  <option value="all">All workspaces</option>
                  {workspaces.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="max-h-[320px] min-h-0 flex-auto overflow-y-auto md:max-h-none">
              {shown.map((c) => {
                const title = isControl ? c.indexOwners.join(", ") || "Index Owner" : c.owner;
                const end = c.messages.at(-1);
                return (
                  <button key={c.key} type="button" aria-current={c.key === open?.key} onClick={() => setPicked(c.key)} className={cx("flex w-full cursor-pointer gap-2.5 border-0 border-b border-j-line-soft px-3 py-3 text-start", c.key === open?.key ? "bg-cx-tint" : "bg-white hover:bg-j-canvas")}>
                    <Avatar initials={initialsOf(title)} size={36} />
                    <span className="flex min-w-0 flex-auto flex-col gap-0.5">
                      <span className="flex items-center justify-between gap-2">
                        <b className="truncate text-sm">{title}</b>
                        {c.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cx px-1.5 text-[11px] font-semibold text-white">{c.unread}</span>}
                      </span>
                      <span className="truncate text-xs text-j-muted">{c.workspace}</span>
                      <span className={cx("truncate text-[13px]", c.unread ? "font-semibold text-j-ink" : "text-j-ink-3")} dir="auto" {...(end && { "data-no-translate": true })}>
                        {end ? end.text : "No messages yet"}
                      </span>
                    </span>
                  </button>
                );
              })}
              {!shown.length && <p className="m-0 p-4 text-sm text-j-muted">{list.length ? "No conversations match." : isControl ? "Conversations start once a control is assigned to you." : "Conversations start once controls have owners."}</p>}
            </div>
          </div>
          {open ? <Thread key={open.key} c={open} me={user?.name ?? ""} isControl={isControl} about={linked === open.key ? (params.get("c") ?? "") : ""} onSend={(text, control) => send(open, text, control)} /> : <p className="m-0 self-center p-8 text-center text-sm text-j-muted">Choose a conversation.</p>}
        </Panel>
      </JMain>
    </AppShell>
  );
}

function Thread({ c, me, isControl, about: first, onSend }: { c: Conversation; me: string; isControl: boolean; about: string; onSend: (text: string, control?: string) => void }) {
  const [text, setText] = useState("");
  const [about, setAbout] = useState(first);
  const end = useRef<HTMLDivElement>(null);
  const count = c.messages.length;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [count]);
  const submit = () => {
    if (!text.trim()) return;
    onSend(text, about || undefined);
    setText("");
  };
  const link = (code: string) => clientHref(c.workspaceId, isControl ? `/controls/${encodeURIComponent(code)}` : `/review/${encodeURIComponent(code)}`);

  return (
    <div className="flex min-h-[420px] min-w-0 flex-col md:min-h-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-j-line-soft px-[22px] py-3">
        <b className="text-[15px]">{isControl ? c.indexOwners.join(", ") || "Index Owner" : c.owner}</b>
        <span className="text-[13px] text-j-muted">
          {isControl ? "Index Owner" : `Control Owner · ${c.department}`} · {c.workspace} · {c.controls.length} control{c.controls.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex min-h-0 flex-auto flex-col gap-3 overflow-y-auto bg-j-canvas px-[22px] py-4" aria-live="polite">
        {c.messages.map((m) => (m.event ? <EventCard key={m.id} m={m} link={link} /> : <Bubble key={m.id} m={m} mine={m.by === me} link={link} />))}
        {!count && <p className="m-auto text-sm text-j-muted">No messages yet. Say hello or ask about a control.</p>}
        <div ref={end} />
      </div>
      {c.closed ? (
        <p className="m-0 border-t border-j-line-soft px-[22px] py-3 text-sm text-j-muted">This workspace is closed. The conversation is read-only.</p>
      ) : (
        <div className="flex flex-col gap-2 border-t border-j-line-soft px-[22px] py-3">
          <select aria-label="About a control" value={about} onChange={(e) => setAbout(e.target.value)} className={cx(inputClass, "h-9 self-start text-[13px]")}>
            <option value="">General message</option>
            {c.controls.map((x) => (
              <option key={x.code} value={x.code}>
                {x.code} · {x.title.length > 60 ? `${x.title.slice(0, 59)}…` : x.title}
              </option>
            ))}
          </select>
          <div className="flex items-end gap-2">
            <textarea
              aria-label="Message"
              rows={2}
              value={text}
              dir="auto"
              placeholder="Write a message"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              className="min-w-0 flex-auto resize-none rounded-xl border border-j-line p-2.5 font-sans text-sm"
            />
            <JButton variant="primary" disabled={!text.trim()} onClick={submit}>
              <Icon name="send" size={15} />
              Send
            </JButton>
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({ m, mine, link }: { m: ChatMessage; mine: boolean; link: (code: string) => string }) {
  return (
    <div className={cx("flex max-w-[78%] gap-2", mine ? "flex-row-reverse self-end" : "self-start")}>
      {!mine && <Avatar initials={initialsOf(m.by)} size={28} />}
      <div className={cx("flex min-w-0 flex-col gap-1 rounded-2xl px-3.5 py-2.5 text-sm", mine ? "bg-cx-tint" : "border border-j-line bg-white")}>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-j-muted">
          {!mine && <b className="text-j-ink">{m.by}</b>}
          {!mine && m.role && <span>{m.role}</span>}
          <span>{fmtWhen(m.at)}</span>
          {m.control && (
            <Link href={link(m.control)} className="font-mono font-semibold text-cx">
              {m.control}
            </Link>
          )}
        </span>
        <span className="whitespace-pre-wrap" dir="auto" data-no-translate>
          {m.text}
        </span>
      </div>
    </div>
  );
}

function EventCard({ m, link }: { m: ChatMessage; link: (code: string) => string }) {
  return (
    <div className="flex max-w-[88%] flex-col gap-1 self-center rounded-xl border border-dashed border-j-line bg-white px-3.5 py-2 text-[13px]">
      <span className="flex flex-wrap items-center gap-2 text-xs text-j-muted">
        <Pill tone={m.event === "Return" ? "orange" : m.event === "Deadline" ? "warn" : "cx"}>{m.event}</Pill>
        <span>
          {m.by} · {fmtWhen(m.at)}
        </span>
        {m.control && (
          <Link href={link(m.control)} className="font-mono font-semibold text-cx">
            {m.control}
          </Link>
        )}
      </span>
      <span dir="auto" data-no-translate>
        {m.text}
      </span>
    </div>
  );
}
