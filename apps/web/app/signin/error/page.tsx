import Link from "next/link";
import { Header } from "@/components/Header";

export const metadata = { title: "Sign-in problem", robots: { index: false } };

const MESSAGES: Record<string, string> = {
  RateLimit: "Too many sign-in requests were made from this network. Please wait an hour and try again.",
  Verification: "That sign-in link could not be created or verified. Request a new link and try again.",
  AccessDenied: "This sign-in request was not allowed.",
  Configuration: "Email sign-in is temporarily unavailable. Please try again later.",
};

export default async function SignInErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = MESSAGES[error ?? ""]
    ?? "Email sign-in could not be completed. Please try again in a few minutes.";

  return (
    <>
      <Header />
      <main id="main" className="auth-page mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-6">
        <h1 className="type-title-2 font-bold ">Sign-in problem</h1>
        <p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 type-body text-amber-950">
          {message}
        </p>
        <Link className="mt-6 inline-flex justify-center rounded-lg bg-primary px-4 py-2 type-body font-semibold text-primary-foreground" href="/signin">
          Back to sign in
        </Link>
      </main>
    </>
  );
}
