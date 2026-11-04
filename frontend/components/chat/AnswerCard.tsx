"use client";

import { downloadCsv } from "@/components/charts/exportChart";
import type { ChatAnswer } from "@/lib/api";
import AnswerActions from "./AnswerActions";
import BigStat, { singleNumber } from "./BigStat";
import { useChatUI } from "./ChatUIContext";
import ResultChip from "./ResultChip";
import RevealText from "./RevealText";

type Props = { id: string; question: string; answer: ChatAnswer; fresh: boolean };

/** One answer in the chat: the text, a big number when it is one, and a chip that opens it in results. */
export default function AnswerCard({ id, question, answer, fresh }: Props) {
  const ui = useChatUI();
  const stat = singleNumber(answer);

  return (
    <div className="group space-y-3">
      <RevealText text={answer.explanation} animate={fresh} className="whitespace-pre-line text-msg" />
      {stat && <BigStat column={stat.column} value={stat.value} />}
      <div className="flex flex-wrap items-center gap-2">
        {answer.rows.length === 0 ? (
          <p className="text-ui text-muted">No rows matched.</p>
        ) : (
          <ResultChip answer={answer} kind={ui.views[id]} stat={!!stat} active={ui.shownId === id} onClick={() => ui.showInResults(id)} />
        )}
        <AnswerActions
          onCopy={() => navigator.clipboard.writeText(answer.explanation)}
          onCsv={answer.rows.length > 0 ? () => downloadCsv(answer.columns, answer.rows, answer.chart?.title ?? question) : undefined}
        />
      </div>
    </div>
  );
}
