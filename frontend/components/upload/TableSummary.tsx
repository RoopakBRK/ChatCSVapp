"use client";

import { useState } from "react";
import type { FileSummary } from "@/lib/api";
import { cleaningHeadline, formatCount } from "@/lib/format";
import CleaningSteps from "./CleaningSteps";
import ColumnList from "./ColumnList";
import SampleTable from "./SampleTable";

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-sans mb-1 font-semibold uppercase tracking-wide text-muted">{children}</h3>
);

export default function TableSummary({ file, onRemove }: { file: FileSummary; onRemove: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const removed = file.rows_read - file.row_count;
  const changes = file.cleaning_steps.filter((s) => s.changes_data).length;

  return (
    <li className="card rounded-xl text-sm">
      <div className="flex items-start">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-w-0 flex-1 items-start justify-between gap-2 py-2.5 pl-3 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold" title={file.file_name}>
            {file.table_name}
          </span>
          <span className="block text-xs text-muted">
            <span className="font-mono">{formatCount(file.row_count)}</span> rows · <span className="font-mono">{file.column_count}</span> columns
            {file.missing_total > 0 && ` · ${formatCount(file.missing_total)} missing`}
          </span>
          <span className="mt-0.5 block text-xs text-teal">{cleaningHeadline(file.cleaning_steps)}</span>
        </span>
        <span className="mt-1 text-xs text-muted">{open ? "▾" : "▸"}</span>
      </button>
      <button
        onClick={() => setConfirming(true)}
        aria-label={`Remove ${file.file_name}`}
        title="Remove this file"
        className="m-1.5 rounded-lg p-1.5 text-muted transition-colors hover:bg-error-soft hover:text-error-ink"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
        </svg>
      </button>
      </div>

      {confirming && (
        <div role="alertdialog" aria-label="Confirm removal" className="mx-3 mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-error-soft px-3 py-2 text-xs text-error-ink">
          <span>
            Remove <b>{file.file_name}</b>? Its table and the CSV are deleted from this chat.
          </span>
          <span className="flex gap-1.5">
            <button onClick={() => setConfirming(false)} className="rounded-full px-2.5 py-1 font-semibold hover:bg-card">
              Cancel
            </button>
            <button
              disabled={removing}
              onClick={async () => {
                setRemoving(true);
                await onRemove();
                setRemoving(false);
                setConfirming(false);
              }}
              className="rounded-full bg-error px-3 py-1 font-semibold text-panel disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          </span>
        </div>
      )}

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
