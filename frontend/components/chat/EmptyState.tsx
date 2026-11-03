import UploadZone from "@/components/upload/UploadZone";

type Props = { uploading: boolean; onFiles: (files: File[]) => void; onSample: () => void };

/** First thing you see with no files: a serif headline, a glowing drop zone, and sample data. */
export default function EmptyState({ uploading, onFiles, onSample }: Props) {
  return (
    <div className="msg-in mx-auto mt-10 w-full space-y-6 text-center">
      <div>
        <h2 className="text-5xl leading-tight">
          Ask your <span className="text-gradient-accent italic">data</span> anything
        </h2>
        <p className="mt-3 text-sm text-muted">Add one or more CSV files, then ask questions in plain English.</p>
      </div>
      <UploadZone onFiles={onFiles} uploading={uploading} />
      <div className="flex items-center justify-center gap-3 text-xs text-muted">
        <span className="h-px w-10 bg-border-strong" aria-hidden />
        no files to hand?
        <span className="h-px w-10 bg-border-strong" aria-hidden />
      </div>
      <button onClick={onSample} disabled={uploading} className="btn-ghost inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4" />
        </svg>
        Try sample data
        <span className="text-muted">· Online Shop, 8 tables</span>
      </button>
    </div>
  );
}
