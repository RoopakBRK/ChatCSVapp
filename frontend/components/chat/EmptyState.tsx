import UploadZone from "@/components/upload/UploadZone";

type Props = { uploading: boolean; onFiles: (files: File[]) => void; onSample: () => void };

/** No files yet: a heading, the drop zone, and sample data. */
export default function EmptyState({ uploading, onFiles, onSample }: Props) {
  return (
    <div className="msg-in mx-auto mt-6 w-full space-y-4 text-center">
      <h2 className="text-head">
        Ask your <span className="text-gradient-accent">data</span> anything
      </h2>
      <UploadZone onFiles={onFiles} uploading={uploading} />
      <button onClick={onSample} disabled={uploading} className="btn-ghost rounded-lg px-4 py-2 text-ui font-medium">
        Try sample data
      </button>
    </div>
  );
}
