import { Footer } from "./Footer";
import { Header } from "./Header";

function LoadingBody({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-5">
        <div className="h-8 w-56 rounded bg-card-2" />
        <div className="h-4 max-w-xl rounded bg-card-2" />
        <div className="grid gap-4 pt-4 sm:grid-cols-2">
          <div className="h-40 rounded-xl border border-border bg-card" />
          <div className="h-40 rounded-xl border border-border bg-card" />
        </div>
        <div className="h-24 rounded-xl border border-border bg-card" />
      </div>
    </div>
  );
}

export function AppPageLoading({
  label = "Loading page",
  shell = true,
}: {
  label?: string;
  shell?: boolean;
}) {
  if (!shell) return <LoadingBody label={label} />;
  return (
    <>
      <Header />
      <main id="main" className="app-page mx-auto min-h-[60vh] max-w-5xl px-6 py-10">
        <LoadingBody label={label} />
      </main>
      <Footer />
    </>
  );
}
