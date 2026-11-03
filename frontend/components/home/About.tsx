import Section from "./Section";

const FACTS = [
  { value: "Several files", label: "at once, up to 50 MB each, linked to each other automatically" },
  { value: "Every change", label: "the cleaner makes is listed, so nothing changes your answers quietly" },
  { value: "Every answer", label: "comes with the SQL that produced it and the rows it used" },
];

export default function About() {
  return (
    <Section
      id="about"
      eyebrow="About"
      title="What is CSVChat?"
      intro="CSVChat turns a folder of CSV exports into something you can talk to. It loads each file into its own table, works out how the tables connect, and uses an AI model to turn your question into a database query. The answer comes back in words and as a chart you can change."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {FACTS.map((f) => (
          <div key={f.value} className="depth rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-gradient-accent text-2xl font-bold">{f.value}</p>
            <p className="mt-2 text-sm text-muted">{f.label}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
