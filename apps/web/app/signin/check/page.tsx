import Link from "next/link";
import { Header } from "@/components/Header";
import { MailIcon } from "@/components/icons";

export const metadata = { title: "Check your email", robots: { index: false } };

export default function CheckEmailPage() {
  return (
    <>
      <Header />
      <main id="main" className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-6 text-center">
        <MailIcon size={32} />
        <h1 className="mt-4 text-xl font-bold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          We sent you a magic link. Open it on this device to finish signing in and return to the app.
        </p>
        <p className="mt-6 text-sm text-muted">
          Wrong address, or nothing after a minute?{" "}
          <Link href="/signin" className="font-medium text-foreground underline">
            Send a new link
          </Link>
          .
        </p>
      </main>
    </>
  );
}
