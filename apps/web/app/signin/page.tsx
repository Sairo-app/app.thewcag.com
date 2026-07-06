import { signIn } from "@/auth";
import { Header } from "@/components/Header";
import { MailIcon } from "@/components/icons";

export const metadata = { title: "Sign in - TheWCAG", robots: { index: false } };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = typeof sp.callbackUrl === "string" ? sp.callbackUrl : "/screenshots";

  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-6">
      <h1 className="text-xl font-bold tracking-tight">Sign in to TheWCAG</h1>
      <p className="mt-2 text-sm text-muted">
        Enter your email and we&apos;ll send you a magic link. No password needed.
      </p>
      <form
        action={async (formData) => {
          "use server";
          await signIn("resend", {
            email: String(formData.get("email")),
            redirectTo: callbackUrl,
          });
        }}
        className="mt-6 space-y-3"
      >
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <MailIcon size={16} />
          Send magic link
        </button>
      </form>
      </main>
    </>
  );
}
