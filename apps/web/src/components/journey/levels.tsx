import type { LevelCell } from "@/lib/journey/levels";

/** One index level in a table cell: its code, then its name on up to two lines. */
export function LevelCellView({ cell }: { cell: LevelCell }) {
  if (!cell.code && !cell.name) return <span className="text-xs text-j-muted">–</span>;
  return (
    <span className="flex min-w-0 flex-col" title={cell.below?.join(", ") || cell.name || undefined}>
      {cell.code && <b className="truncate font-mono text-xs font-semibold">{cell.code}</b>}
      {cell.name && (
        <span className="line-clamp-2 text-xs text-j-ink-3" dir="auto">
          {cell.name}
        </span>
      )}
    </span>
  );
}
