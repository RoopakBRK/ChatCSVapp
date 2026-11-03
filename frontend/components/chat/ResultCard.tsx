import type { ChatAnswer } from "@/lib/api";
import { formatCount } from "@/lib/format";
import ResultChart from "@/components/charts/ResultChart";
import type { ChartKind } from "@/components/charts/chartKinds";
import BigStat, { singleNumber } from "./BigStat";
import Collapsible from "./Collapsible";
import DataTable from "./DataTable";

type Props = {
  id: string;
  question: string;
  answer: ChatAnswer;
  highlighted: boolean;
  kind?: ChartKind;
  onKind: (kind: ChartKind) => void;
  onUnpin: () => void;
};

/** A pinned answer in the canvas: its question, chart (or number), SQL and data. */
export default function ResultCard({ id, question, answer, highlighted, kind, onKind, onUnpin }: Props) {
  const stat = singleNumber(answer);
  return (
    <article id={`result-${id}`} className={`card depth space-y-3 rounded-2xl p-3 transition-colors ${highlighted ? "!border-accent" : ""}`}>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 border-l-2 border-accent pl-3 text-sm font-medium">{question}</p>
        <button onClick={onUnpin} className="btn-ghost shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium" title="Remove from canvas">
          Unpin
        </button>
      </div>
      {answer.rows.length === 0 ? (
        <p className="rounded-xl bg-panel/60 px-3 py-4 text-center text-sm text-muted">Nothing matched this question.</p>
      ) : stat ? (
        <BigStat column={stat.column} value={stat.value} />
      ) : answer.chart ? (
        <ResultChart answer={answer} kind={kind} onKind={onKind} variant="card" />
      ) : null}
      <div className="space-y-2">
        <Collapsible title="View SQL">
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-5">{answer.sql}</pre>
        </Collapsible>
        <Collapsible title={`View data table (${formatCount(answer.row_count)}${answer.truncated ? "+" : ""} rows)`}>
          <DataTable answer={answer} />
        </Collapsible>
      </div>
    </article>
  );
}
