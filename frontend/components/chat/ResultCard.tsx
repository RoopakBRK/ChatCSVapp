import type { ChatAnswer } from "@/lib/api";
import { formatCount } from "@/lib/format";
import ResultChart from "@/components/charts/ResultChart";
import type { ChartKind } from "@/components/charts/chartKinds";
import Collapsible from "./Collapsible";
import DataTable from "./DataTable";

type Props = {
  id: string;
  question: string;
  answer: ChatAnswer;
  focused: boolean;
  kind?: ChartKind;
  onKind: (kind: ChartKind) => void;
  onFocus: () => void;
};

/** One answer in the results thread. Only the focused card draws its chart, and asks about other chart types. */
export default function ResultCard({ id, question, answer, focused, kind, onKind, onFocus }: Props) {
  return (
    <article
      id={`result-${id}`}
      className={`depth space-y-3 rounded-2xl border bg-white p-3 transition-shadow ${focused ? "border-pink-300" : "border-border"}`}
    >
      <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-medium">{question}</p>
      {answer.chart &&
        (focused ? (
          <ResultChart answer={answer} kind={kind} onKind={onKind} variant="card" />
        ) : (
          <button
            onClick={onFocus}
            className="w-full rounded-xl border border-dashed border-sky-200 py-3 text-xs font-semibold text-sky-700 hover:border-pink-300 hover:bg-pink-50"
          >
            Show chart
          </button>
        ))}
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
