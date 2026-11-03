import Section from "./Section";

const FEATURES = [
  {
    title: "Careful cleaning",
    text: "Numbers, dates and text are detected, spaces trimmed and duplicate rows removed. Missing values stay missing and outliers are flagged, never deleted.",
    icon: "M4 6h16M7 12h10M10 18h4",
  },
  {
    title: "Tables linked for you",
    text: "Columns like order_id or customer_id are matched across files, with how well they line up, so questions can span several tables.",
    icon: "M8 7h8M8 17h8M6 9v6M18 9v6",
  },
  {
    title: "Plain-English questions",
    text: "Ask the way you would ask a colleague. If a question is too vague, CSVChat asks you what you meant instead of guessing.",
    icon: "M4 5h16v10H8l-4 4V5z",
  },
  {
    title: "Charts that fit the data",
    text: "Bars, lines, donuts, treemaps, box plots and isometric 3D views, offered only when they suit the result. Download any chart as PNG or the data as CSV.",
    icon: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  },
  {
    title: "Nothing hidden",
    text: "Every answer shows the SQL it ran and the table it got back, so you can check the working.",
    icon: "M9 18l-6-6 6-6M15 6l6 6-6 6",
  },
  {
    title: "Pick up where you left off",
    text: "Past chats stay in the history sidebar. Reopen one and its charts are drawn again from the saved query.",
    icon: "M12 8v5l3 2M21 12a9 9 0 1 1-3-6.7",
  },
];

export default function Features() {
  return (
    <Section id="features" eyebrow="Features" title="Built to be trusted, not just clever">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className="depth rounded-2xl border border-border bg-white p-6">
            <span className="bg-gradient-brand flex h-10 w-10 items-center justify-center rounded-xl text-white" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d={f.icon} />
              </svg>
            </span>
            <h3 className="mt-4 font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{f.text}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
