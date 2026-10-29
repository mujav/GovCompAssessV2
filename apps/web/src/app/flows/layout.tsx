import Link from "next/link";
import { FLOWS } from "@/lib/flows";

export default function FlowsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-8 py-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="text-[13px] text-muted">
            <Link href="/command-center">Workspace</Link> / Flows &amp; architecture
          </div>
          <h1 className="m-0 text-2xl leading-8 font-bold">How work moves through the platform</h1>
        </div>
        <nav aria-label="Flows" className="flex flex-wrap gap-1.5">
          {FLOWS.map((f) => (
            <Link
              key={f.slug}
              href={`/flows/${f.slug}`}
              className="inline-flex h-10 items-center rounded-full border border-field bg-white px-3 text-[13px] text-ink no-underline hover:bg-surface-2 hover:text-ink"
            >
              <span className="mr-1.5 font-mono text-xs text-muted">{f.code}</span>
              {f.title}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
