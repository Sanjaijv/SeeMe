export default function Home() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-5xl flex-col justify-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
        Workspace ready
      </p>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
        See how your codebase fits together.
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
        Your team workspace is ready. Repository mapping will appear here in
        the next phase.
      </p>
    </section>
  );
}
