"use client";

import { useState } from "react";
import type { FileSummary } from "@/lib/api";
import { cleaningHeadline, formatCount } from "@/lib/format";
import CleaningSteps from "./CleaningSteps";
import ColumnList from "./ColumnList";
import SampleTable from "./SampleTable";

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-1 font-semibold uppercase tracking-wide text-muted">{children}</h3>
);

export default function TableSummary({ file }: { file: FileSummary }) {
  const [open, setOpen] = useState(false);
  const removed = file.rows_read - file.row_count;
  const changes = file.cleaning_steps.filter((s) => s.changes_data).length;

  return (
    <li className="rounded-xl border border-border bg-glass-strong text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold" title={file.file_name}>
            {file.table_name}
          </span>
          <span className="block text-xs text-muted">
            {formatCount(file.row_count)} rows · {file.column_count} columns
            {file.missing_total > 0 && ` · ${formatCount(file.missing_total)} missing`}
          </span>
          <span className="mt-0.5 block text-xs text-indigo-600">{cleaningHeadline(file.cleaning_steps)}</span>
        </span>
        <span className="mt-1 text-xs text-muted">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3 text-xs">
          <p className="text-muted">
            From <span className="font-mono">{file.file_name}</span>
            {removed > 0 && ` · ${formatCount(removed)} of ${formatCount(file.rows_read)} rows removed during cleaning`}
          </p>
          <section>
            <Heading>Columns</Heading>
            <ColumnList columns={file.columns} />
          </section>
          <section>
            <Heading>Cleaning ({changes} change{changes === 1 ? "" : "s"})</Heading>
            <CleaningSteps steps={file.cleaning_steps} />
          </section>
          {file.sample_rows.length > 0 && (
            <section>
              <Heading>Sample rows</Heading>
              <SampleTable columns={file.columns} rows={file.sample_rows} />
            </section>
          )}
        </div>
      )}
    </li>
  );
}
