type Props = { id: string; eyebrow: string; title: string; intro?: string; children: React.ReactNode };

/** A page section with an anchor (for the navbar links) and a consistent heading. */
export default function Section({ id, eyebrow, title, intro, children }: Props) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-pink-600">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
        {intro && <p className="mt-4 text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}
