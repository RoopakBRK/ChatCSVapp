import { Fragment, type ReactNode } from "react";

/**
 * Simple markdown for the AI's messages, with no library: **bold**, *italic*, `code`, "- " and "1. "
 * lists, paragraphs (blank lines) and line breaks. It only builds React elements, so text from the
 * model or a file can never become HTML.
 */
export default function Markdown({ text, className }: { text: string; className?: string }) {
  return <div className={className}>{blocks(text)}</div>;
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

function blocks(text: string): ReactNode[] {
  const out: Block[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const last = out[out.length - 1];
    if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      const item = (bullet ?? numbered)![1];
      if (last?.kind === kind) last.items.push(item);
      else out.push({ kind, items: [item] });
    } else if (!line.trim()) {
      out.push({ kind: "p", lines: [] }); // a blank line ends the paragraph (empty ones are skipped below)
    } else if (last?.kind === "p") {
      last.lines.push(line);
    } else {
      out.push({ kind: "p", lines: [line] });
    }
  }

  return out.map((b, i) => {
    if (b.kind === "p") {
      if (!b.lines.length) return null;
      return (
        <p key={i}>
          {b.lines.map((l, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {inline(l)}
            </Fragment>
          ))}
        </p>
      );
    }
    const List = b.kind;
    return (
      <List key={i} className={b.kind === "ul" ? "list-disc pl-6" : "list-decimal pl-6"}>
        {b.items.map((item, j) => (
          <li key={j}>{inline(item)}</li>
        ))}
      </List>
    );
  });
}

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\s][^*\n]*\*)/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return <code key={i} className="rounded bg-hover px-1 font-mono text-[0.92em]">{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}
