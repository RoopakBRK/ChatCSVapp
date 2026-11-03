import type { ChatAnswer } from "@/lib/api";
import { formatCount } from "@/lib/format";
import ResultChart from "@/components/charts/ResultChart";
import Collapsible from "./Collapsible";
import DataTable from "./DataTable";

type Props = { id: string; question: string; answer: ChatAnswer; highlighted: boolean };

/** One answer in the results thread: its question, the chart, and the SQL and data behind it. */
export default function ResultCard({ id, question, answer, highlighted }: Props) {
  return (
    <article
      id={`result-${id}`}
      className={`space-y-3 rounded-2xl border bg-white p-3 transition-shadow ${
        highlighted ? "border-pink-300 shadow-lg shadow-pink-100" : "border-border"
      }`}
    >
      <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-medium">{question}</p>
      <ResultChart answer={answer} />
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
