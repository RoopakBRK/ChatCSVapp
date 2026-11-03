import type { ChatAnswer, FileSummary } from "@/lib/api";

/** A suggested next question. Other chart types are offered separately, under the chart. */
export type FollowUp = { label: string; text: string };

const PERSONAL = ["name", "email", "address", "phone"]; // people, not categories worth splitting by
const words = (name: string) => name.replace(/_/g, " ");
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Two or three suggested next questions after an answer, based on the tables its SQL used. */
export function followUps(answer: ChatAnswer, files: FileSummary[]): FollowUp[] {
  const sql = answer.sql.toLowerCase();
  const used = files.filter((f) => new RegExp(`\\b${escapeRegExp(f.table_name)}\\b`, "i").test(answer.sql));
  const resultColumns = new Set(answer.columns.map((c) => c.toLowerCase()));
  const out: FollowUp[] = [];

  // Split the result by a category the question did not already use.
  const category = used
    .flatMap((f) => f.columns)
    .find(
      (c) =>
        c.type === "VARCHAR" &&
        (c.distinct_values?.length ?? 0) >= 2 &&
        !PERSONAL.some((w) => c.name.includes(w)) &&
        !resultColumns.has(c.name) &&
        !sql.includes(c.name),
    );
  if (category) out.push({ label: `Break down by ${words(category.name)}`, text: `Break this down by ${words(category.name)}` });

  // Look at it over time, if there is a date to use and the answer is not already a time series.
  const hasDate = used.some((f) => f.columns.some((c) => c.type === "DATE" || c.type === "TIMESTAMP"));
  if (hasDate && answer.chart?.type !== "line" && !/month|year|week|date_trunc|strftime/.test(sql)) {
    out.push({ label: "Show by month", text: "Show this by month" });
  }

  // Narrow a long list down to the leaders.
  if (answer.rows.length > 5 && !/limit\s+[1-5]\b/.test(sql)) {
    out.push({ label: "Only the top 5", text: "Show only the top 5" });
  }

  // Turn values into shares, when they add up (totals and counts, not averages).
  const y = answer.chart?.y ?? "";
  if (answer.rows.length >= 2 && answer.chart && !/avg|average|mean|median|min|max|rate|ratio|pct|percent/i.test(y)) {
    out.push({ label: "As a % of the total", text: "Show each as a percentage of the total" });
  }

  // A single number invites the obvious next question: where does it come from?
  if (answer.rows.length === 1 && out.length === 0) {
    const firstCategory = used.flatMap((f) => f.columns).find((c) => c.type === "VARCHAR" && (c.distinct_values?.length ?? 0) >= 2);
    if (firstCategory) out.push({ label: `Split by ${words(firstCategory.name)}`, text: `Break this down by ${words(firstCategory.name)}` });
    if (hasDate) out.push({ label: "How has it changed?", text: "Show how this changed by month" });
  }
  return out.slice(0, 3);
}
