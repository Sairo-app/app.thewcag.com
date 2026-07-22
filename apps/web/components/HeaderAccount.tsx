"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImageIcon, LogInIcon, LogOutIcon } from "@/components/icons";
import { AccountMenu } from "./AccountMenu";
import { signOutFromHeader } from "./header-actions";

interface HeaderSession {
  signedIn: boolean;
  email: string | null;
  admin: boolean;
}

const ANONYMOUS_SESSION: HeaderSession = {
  signedIn: false,
  email: null,
  admin: false,
};

let sessionRequest: Promise<HeaderSession> | null = null;
let currentSession = ANONYMOUS_SESSION;

function getHeaderSession(): Promise<HeaderSession> {
  sessionRequest ??= fetch("/api/header-session", {
    credentials: "same-origin",
    cache: "no-store",
  })
    .then((response) => response.ok ? response.json() as Promise<HeaderSession> : ANONYMOUS_SESSION)
    .catch(() => ANONYMOUS_SESSION)
    .then((session) => {
      currentSession = session;
      return session;
    });
  return sessionRequest;
}

export function HeaderAccount({ mobile = false }: { mobile?: boolean }) {
  const [session, setSession] = useState(currentSession);

  function prepareSignOut() {
    currentSession = ANONYMOUS_SESSION;
    sessionRequest = null;
  }

  useEffect(() => {
    let active = true;
    void getHeaderSession().then((value) => {
      if (active) setSession(value);
    });
    return () => { active = false; };
  }, []);

  if (mobile) {
    return session.signedIn ? (
      <>
        {session.admin && <Link href="/admin" className="site-menu__link">Admin</Link>}
        <Link href="/account" className="site-menu__link">Account and devices</Link>
        <Link href="/pricing" className="site-menu__link">Plans and pricing</Link>
        <Link href="/screenshots" className="site-menu__link"><ImageIcon size={16} />My reports</Link>
        <form action={signOutFromHeader} onSubmit={prepareSignOut}>
          <button type="submit" className="site-menu__link"><LogOutIcon size={16} />Sign out</button>
        </form>
      </>
    ) : (
      <Link href="/signin" className="site-menu__link"><LogInIcon size={16} />Sign in</Link>
    );
  }

  return session.signedIn ? (
    <AccountMenu>
      <div className="account-menu__panel">
        <p>{session.email}</p>
        {session.admin && <Link href="/admin">Admin</Link>}
        <Link href="/account">Account and devices</Link>
        <Link href="/pricing">Plans and pricing</Link>
        <Link href="/screenshots"><ImageIcon size={15} />My reports</Link>
        <Link href="/brand">Report branding</Link>
        <form action={signOutFromHeader} onSubmit={prepareSignOut}>
          <button type="submit"><LogOutIcon size={15} />Sign out</button>
        </form>
      </div>
    </AccountMenu>
  ) : (
    <Link href="/signin" className="site-signin"><LogInIcon size={15} />Sign in</Link>
  );
}
