import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-6 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={26} height={26} className="h-6 w-6" />
        <Link href="/" className="text-sm font-bold tracking-tight">
          TheWCAG
        </Link>
      </div>
    </header>
  );
}
