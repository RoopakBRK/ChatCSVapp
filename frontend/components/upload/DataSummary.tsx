import type { FileSummary, Relationship } from "@/lib/api";
import RelationshipList from "./RelationshipList";
import TableSummary from "./TableSummary";

/** What was uploaded and what the cleaner did to each table. */
export default function DataSummary({ files, relationships }: { files: FileSummary[]; relationships: Relationship[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Your data · cleaned</h2>
      <ul className="space-y-2">
        {files.map((f) => (
          <TableSummary key={f.file_name} file={f} />
        ))}
      </ul>
      <RelationshipList relationships={relationships} />
    </section>
  );
}
