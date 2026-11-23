export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="bg-ink text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14 sm:py-20">
        <p className="eyebrow text-mist">{eyebrow}</p>
        <h1 className="display text-5xl sm:text-7xl mt-3 max-w-4xl">{title}</h1>
        {children && <div className="mt-6 max-w-2xl text-lg text-mist leading-relaxed">{children}</div>}
        <div className="signature text-white/30 mt-10 max-w-md" />
      </div>
    </section>
  );
}
