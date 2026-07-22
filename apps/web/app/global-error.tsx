"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><main style={{ maxWidth: 560, margin: "15vh auto", padding: 24, fontFamily: "system-ui", textAlign: "center" }}><h1>TheWCAG could not start</h1><p>Reload the application. If the problem continues, use the repository support link.</p><button onClick={reset}>Reload</button></main></body></html>;
}
