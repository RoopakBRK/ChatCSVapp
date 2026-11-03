import Section from "./Section";

const STEPS = [
  { title: "Add your files", text: "Drop CSVs from your computer, or paste a link: a direct URL, or a Google Drive, Google Sheets, Dropbox or GitHub share link." },
  { title: "Ask a question", text: "Try one of the suggested questions or write your own. You can see each step while the answer is worked out, and stop it at any time." },
  { title: "Explore the result", text: "Read the answer in the chat and open the results panel for the chart, the SQL and the data. Pick another chart type if you want one." },
];

export default function HowItWorks() {
  return (
    <Section id="how" eyebrow="How it works" title="From file to answer in three steps">
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="depth relative rounded-2xl border border-border bg-card p-6">
            <span className="btn-accent flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold">{i + 1}</span>
            <h3 className="mt-4 font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
