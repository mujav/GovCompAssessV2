"use client";

import Link from "next/link";
import { AppShell, JMain } from "@/components/journey/shell";
import { Avatar, Panel, Pill } from "@/components/journey/ui";
import { fmtWhen } from "@/components/cycle/ui";
import { useAuth } from "@/lib/auth/store";
import { useScreenState } from "@/lib/journey/store";
import { initialsOf } from "@/lib/journey/people";
import { messagesFor, useMyControls } from "@/lib/cycle/use-my-controls";

// Follow-ups, deadline changes, returns and comments sent to the Control Owner.

export default function MessagesPage() {
  const { user } = useAuth();
  const mine = useMyControls();
  const list = user ? messagesFor(mine, user.name) : [];
  const [read, setRead] = useScreenState<string[]>(`messages.read.${user?.id ?? ""}`, []);
  const unread = list.filter((m) => !read.includes(m.id)).length;
  return (
    <AppShell search="Search messages" workBadge={unread ? String(unread) : undefined}>
      <JMain max={980}>
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Messages</h1>
          <p className="m-0 text-sm text-j-ink-3">Follow-ups, deadline changes and comments from your Index Owner on the controls you work on. {unread ? `${unread} unread.` : ""}</p>
        </div>
        <Panel className="flex flex-col">
          {list.map((m) => {
            const isNew = !read.includes(m.id);
            return (
              <Link
                key={m.id}
                href={m.m.href}
                onClick={() => isNew && setRead((d) => void d.push(m.id))}
                className="flex gap-3 border-b border-j-line-soft px-[22px] py-3.5 text-sm text-j-ink no-underline last:border-0 hover:bg-j-canvas hover:text-j-ink"
              >
                <Avatar initials={initialsOf(m.from)} size={32} />
                <span className="flex min-w-0 flex-auto flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <b>{m.from}</b>
                    <Pill tone={m.kind === "Return" ? "orange" : m.kind === "Deadline" ? "warn" : m.kind === "Comment" ? "gray" : "cx"}>{m.kind}</Pill>
                    <span className="text-xs text-j-muted">
                      {m.m.c.code} · {m.m.workspace} · {fmtWhen(m.at)}
                    </span>
                    {isNew && <span className="h-2 w-2 rounded-full bg-cx" aria-label="Unread" />}
                  </span>
                  <span dir="auto" className={isNew ? "font-semibold" : ""}>
                    {m.text}
                  </span>
                </span>
              </Link>
            );
          })}
          {!list.length && <p className="m-0 px-[22px] py-5 text-sm text-j-muted">No messages yet.</p>}
        </Panel>
      </JMain>
    </AppShell>
  );
}
