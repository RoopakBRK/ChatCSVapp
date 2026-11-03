"use client";

import { useState } from "react";
import ResultChart from "@/components/charts/ResultChart";
import { downloadCsv } from "@/components/charts/exportChart";
import type { ChatAnswer } from "@/lib/api";
import AnswerActions from "./AnswerActions";
import BigStat, { singleNumber } from "./BigStat";
import { useChatUI } from "./ChatUIContext";
import DataTable from "./DataTable";
import LazyMount from "./LazyMount";
import RevealText from "./RevealText";

type Props = { id: string; question: string; answer: ChatAnswer; fresh: boolean };

/** One answer: the explanation, then a big number, a chart or a friendly "nothing matched", then actions. */
export default function AnswerCard({ id, question, answer, fresh }: Props) {
  const ui = useChatUI();
  const [sqlOpen, setSqlOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const stat = singleNumber(answer);
  const empty = answer.rows.length === 0;
  const pinned = ui.isPinned(answer, question);

  return (
    <div className="card depth w-full space-y-3 rounded-2xl rounded-bl-lg px-4 py-3">
      <RevealText text={answer.explanation} animate={fresh} className="whitespace-pre-line text-[15px] leading-7" />

      {empty ? (
        <div className="chart-stage rounded-2xl px-5 py-6 text-center">
          <p className="font-display text-xl">Nothing matched</p>
          <p className="mt-1 text-sm text-muted">No rows fit that question. Try a wider date range, fewer filters, or a different table.</p>
        </div>
      ) : stat ? (
        <BigStat column={stat.column} value={stat.value} />
      ) : answer.chart ? (
        <LazyMount height={360}>
          <ResultChart answer={answer} kind={ui.views[id]} onKind={(k) => ui.setKind(id, k)} variant="inline" />
        </LazyMount>
      ) : null}

      {sqlOpen && (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-border bg-panel/60 p-3 font-mono text-xs leading-5">{answer.sql}</pre>
      )}
      {tableOpen && (
        <div className="rounded-xl border border-border bg-panel/60 p-2">
          <DataTable answer={answer} />
        </div>
      )}

      <AnswerActions
        sqlOpen={sqlOpen}
        tableOpen={tableOpen}
        pinned={pinned}
        onCopy={() => navigator.clipboard.writeText(answer.explanation)}
        onSql={() => setSqlOpen(!sqlOpen)}
        onTable={() => setTableOpen(!tableOpen)}
        onCsv={() => downloadCsv(answer.columns, answer.rows, answer.chart?.title ?? question)}
        onPin={() => ui.togglePin(id, answer, question)}
      />
    </div>
  );
}
