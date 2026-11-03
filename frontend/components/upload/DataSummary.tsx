import type { FileSummary, Relationship } from "@/lib/api";
import RelationshipList from "./RelationshipList";
import TableSummary from "./TableSummary";

/** What was uploaded and what the cleaner did to each table. */
type Props = { files: FileSummary[]; relationships: Relationship[]; onRemove: (fileName: string) => Promise<void> };

export default function DataSummary({ files, relationships, onRemove }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Your data · cleaned</h2>
      <ul className="space-y-2">
        {files.map((f) => (
          <TableSummary key={f.file_name} file={f} onRemove={() => onRemove(f.file_name)} />
        ))}
      </ul>
      <RelationshipList relationships={relationships} />
    </section>
  );
}
