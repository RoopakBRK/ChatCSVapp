"use client";

import { useEffect, useRef, useState } from "react";
import ResultChart from "@/components/charts/ResultChart";
import { downloadCsv } from "@/components/charts/exportChart";
import type { ChartKind } from "@/components/charts/chartKinds";
import type { ChatItem } from "@/hooks/useChat";
import type { FileSummary, Relationship } from "@/lib/api";
import RelationshipList from "@/components/upload/RelationshipList";
import TableSummary from "@/components/upload/TableSummary";
import BigStat, { singleNumber } from "./BigStat";
import DataTable from "./DataTable";

type AnswerItem = Extract<ChatItem, { kind: "answer" }>;
type Tab = "chart" | "table" | "sql";

type Props = {
  /** Below 1280px the panel is shown only when open; on desktop it is always there. */
  open: boolean;
  onClose: () => void;
  answers: AnswerItem[]; // every result of the current chat, oldest first
  shownId: string | null; // highlighted (its chip in the chat is highlighted too)
  focus: { id: string; n: number } | null; // scroll this card into view (a chip was clicked)
  tablesOpen: boolean;
  onTables: (open: boolean) => void;
  files: FileSummary[];
  relationships: Relationship[];
  onRemoveFile: (name: string) => Promise<void>;
  views: Record<string, ChartKind>;
  onKind: (id: string, kind: ChartKind) => void;
  fraction: number; // desktop width, as a share of the chat + results area
};

const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

/**
 * Results: a thread of every chart, table and query of the current chat, newest at the bottom.
 * "Tables" switches to the cleaned tables (columns, cleaning steps, links).
 *  - 1280px and up: always open on the right, width set by dragging its left edge.
 *  - 768–1279px: slides over the chat when opened from the header.
 *  - Phones: fills the screen under the header when "Results" is picked in the switch.
 */
export default function ResultsPanel(p: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const newest = p.answers.at(-1)?.id;

  // A new result: show it (the thread scrolls to the bottom).
  useEffect(() => {
    const el = scroller.current;
    if (el && newest) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [newest]);

  // A chip was clicked in the chat: bring its card into view.
  useEffect(() => {
    if (p.focus) document.getElementById(`result-${p.focus.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [p.focus]);

  const seg = (on: boolean) => `rounded px-2 text-ui transition-colors ${on ? "bg-hover font-medium text-foreground" : "text-muted hover:text-foreground"}`;

  return (
    <>
      {p.open && <button aria-label="Close results" onClick={p.onClose} className="fixed inset-0 z-30 hidden bg-scrim md:block xl:hidden" />}
      <aside
        aria-label="Results"
        style={{ "--results-w": `${(p.fraction * 100).toFixed(1)}%` } as React.CSSProperties}
        className={`surface-results ${p.open ? "flex" : "hidden"} fixed inset-x-0 bottom-0 top-12 z-30 flex-col md:inset-x-auto md:right-0 md:top-0 md:z-40 md:w-[min(560px,92vw)] md:border-l md:border-border md:depth-2 md:slide-in xl:static xl:z-auto xl:flex xl:w-auto xl:min-w-[320px] xl:shrink xl:grow-0 xl:basis-[var(--results-w)] xl:animate-none xl:shadow-none`}
      >
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <h2 className="text-head">Results</h2>
          {p.answers.length > 0 && <span className="font-mono text-ui text-muted">{p.answers.length}</span>}
          <div className="flex-1" />
          {p.files.length > 0 && (
            <div role="group" aria-label="Show" className="flex rounded-lg border border-border p-1">
              <button onClick={() => p.onTables(false)} aria-pressed={!p.tablesOpen} className={seg(!p.tablesOpen)}>
                Answers
              </button>
              <button onClick={() => p.onTables(true)} aria-pressed={p.tablesOpen} className={seg(p.tablesOpen)}>
                Tables <span className="font-mono">{p.files.length}</span>
              </button>
            </div>
          )}
          <button onClick={p.onClose} aria-label="Close results" title="Close (Esc)" className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-foreground md:flex xl:hidden">
            <Icon d="M6 6l12 12M18 6L6 18" />
          </button>
        </header>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto p-4">
          {p.tablesOpen ? (
            <div className="space-y-4">
              <ul className="space-y-2">
                {p.files.map((f) => (
                  <TableSummary key={f.file_name} file={f} onRemove={() => p.onRemoveFile(f.file_name)} />
                ))}
              </ul>
              <RelationshipList relationships={p.relationships} />
            </div>
          ) : p.answers.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="max-w-64 text-center text-ui text-muted">Charts and tables for your answers will show here.</p>
            </div>
          ) : (
            <ol className="space-y-6">
              {p.answers.map((a) => (
                <ResultCard key={a.id} item={a} active={a.id === p.shownId} kind={p.views[a.id]} onKind={(k) => p.onKind(a.id, k)} />
              ))}
            </ol>
          )}
        </div>
      </aside>
    </>
  );
}

type CardProps = { item: AnswerItem; active: boolean; kind?: ChartKind; onKind: (kind: ChartKind) => void };

/** One result in the thread: the question, then Chart / Table / SQL. */
function ResultCard({ item, active, kind, onKind }: CardProps) {
  const { answer, question } = item;
  const stat = singleNumber(answer);
  const hasChart = !!stat || (!!answer.chart && answer.rows.length > 0);
  const [tab, setTab] = useState<Tab>(hasChart ? "chart" : "table");

  return (
    <li
      id={`result-${item.id}`}
      className={`scroll-mt-4 rounded-lg border bg-card p-3 transition-colors ${active ? "border-accent" : "border-border"}`}
    >
      <div className="mb-2 flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-ui font-semibold">{question}</h3>
        <div role="tablist" aria-label="Result views" className="flex shrink-0 gap-1">
          {(["chart", "table", "sql"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-2 text-ui transition-colors ${tab === t ? "bg-hover font-medium text-foreground" : "text-muted hover:text-foreground"}`}
            >
              {t === "sql" ? "SQL" : t === "chart" ? "Chart" : "Table"}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel">
        {tab === "chart" &&
          (answer.rows.length === 0 ? (
            <p className="text-ui text-muted">No rows matched.</p>
          ) : stat ? (
            <BigStat column={stat.column} value={stat.value} />
          ) : answer.chart ? (
            <ResultChart answer={answer} kind={kind} onKind={onKind} />
          ) : (
            <p className="text-ui text-muted">No chart for this answer. The Table tab has the data.</p>
          ))}
        {tab === "table" && (
          <>
            <DataTable answer={answer} />
            {answer.rows.length > 0 && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => downloadCsv(answer.columns, answer.rows, answer.chart?.title ?? question)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 text-ui text-muted hover:bg-hover hover:text-foreground"
                >
                  <Icon d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" /> CSV
                </button>
              </div>
            )}
          </>
        )}
        {tab === "sql" && <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-hover p-3 font-mono text-ui">{answer.sql}</pre>}
      </div>
    </li>
  );
}
