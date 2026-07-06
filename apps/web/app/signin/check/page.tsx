export const metadata = { title: "Check your email - TheWCAG", robots: { index: false } };

export default function CheckEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 text-center">
      <h1 className="text-xl font-bold tracking-tight">Check your email</h1>
      <p className="mt-2 text-sm text-muted">
        We sent you a magic link. Open it on this device to finish signing in and return to the app.
      </p>
    </main>
  );
}
