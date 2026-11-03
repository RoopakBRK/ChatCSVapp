import Section from "./Section";

const FAQS = [
  {
    q: "What files can I use?",
    a: "CSV files up to 50 MB each, several at a time. Commas, semicolons, tabs and pipes are all recognised. You can upload from your computer, from a direct link, or from a Google Drive, Google Sheets, Dropbox or GitHub share link that anyone with the link can open.",
  },
  {
    q: "Does CSVChat change my data?",
    a: "Your original file is kept as uploaded. The table CSVChat queries is a cleaned copy: types detected, spaces trimmed, empty and exact duplicate rows removed. Missing values stay missing rather than being guessed, and unusual values are flagged rather than deleted. Every step is listed under the table in the results panel.",
  },
  {
    q: "Where does my data go?",
    a: "Your files are stored on the server that runs CSVChat, in a folder for your chat. To answer a question, CSVChat sends Groq's AI service your question, the table structure (column names, types, short lists of category values and value ranges) and up to 30 rows of the query result, so it can write the explanation. Whole files are never sent.",
  },
  {
    q: "What happens if my question is unclear?",
    a: "CSVChat asks you a short follow-up question instead of guessing. If a question can't be answered from your tables, it says so.",
  },
  {
    q: "Can I check how an answer was worked out?",
    a: "Yes. Every answer has a View SQL section with the exact query, a data table with the rows it returned, and a CSV download.",
  },
  {
    q: "Can I remove a file I uploaded?",
    a: "Yes. Open the results panel and use the bin icon on the table's card. Its table and the CSV are deleted from that chat.",
  },
  {
    q: "How long does an answer take?",
    a: "Usually a few seconds. Each question has a one-minute limit, and you can press Stop at any point.",
  },
  {
    q: "Do I need an account?",
    a: "Not at the moment. Accounts are planned; until then your chats are kept on this server and listed in the history sidebar.",
  },
];

export default function Faq() {
  return (
    <Section id="faq" eyebrow="FAQ" title="Questions people ask">
      <div className="mx-auto max-w-3xl space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="depth group rounded-2xl border border-border bg-card px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {f.q}
              <span className="text-accent-ink transition-transform group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-6 text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
