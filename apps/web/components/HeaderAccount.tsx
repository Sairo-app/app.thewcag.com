"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ImageIcon, LogInIcon, LogOutIcon } from "@/components/icons";
import { AccountMenu } from "./AccountMenu";
import { signOutFromHeader } from "./header-actions";

interface HeaderSession {
  signedIn: boolean;
  email: string | null;
  admin: boolean;
}

let sessionRequest: Promise<HeaderSession> | null = null;
let currentSession: HeaderSession | null = null;

function parseHeaderSession(value: unknown): HeaderSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid header session response");
  }
  const session = value as Partial<HeaderSession>;
  if (
    typeof session.signedIn !== "boolean" ||
    typeof session.admin !== "boolean" ||
    !(typeof session.email === "string" || session.email === null)
  ) {
    throw new Error("Invalid header session response");
  }
  return {
    signedIn: session.signedIn,
    email: session.email,
    admin: session.admin,
  };
}

function getHeaderSession(): Promise<HeaderSession> {
  sessionRequest ??= fetch("/api/header-session", {
    credentials: "same-origin",
    cache: "no-store",
  }).then(async (response) => {
    if (!response.ok) throw new Error("Header session unavailable");
    return parseHeaderSession(await response.json());
  }).then((session) => {
      currentSession = session;
      return session;
    });
  const request = sessionRequest;
  void request.then(
    () => { if (sessionRequest === request) sessionRequest = null; },
    () => { if (sessionRequest === request) sessionRequest = null; },
  );
  return sessionRequest;
}

export function HeaderAccount({ mobile = false }: { mobile?: boolean }) {
  const [session, setSession] = useState(currentSession);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    void getHeaderSession().then((value) => {
      if (active) {
        setSession(value);
        setUnavailable(false);
      }
    }).catch(() => {
      if (active) setUnavailable(true);
    });
    return () => { active = false; };
  }, []);

  if (!session) {
    return (
      <span
        className={`header-account-skeleton ${mobile ? "header-account-skeleton--mobile" : "header-account-skeleton--desktop"}`}
        role="status"
        aria-live="polite"
        aria-label={unavailable ? "Account status unavailable" : "Loading account status"}
        aria-busy={!unavailable}
        data-unavailable={unavailable || undefined}
      />
    );
  }

  if (mobile) {
    return session.signedIn ? (
      <>
        {session.admin && <Link href="/admin" className="site-menu__link">Admin</Link>}
        <Link href="/account" className="site-menu__link">Account and devices</Link>
        <Link href="/pricing" className="site-menu__link">Plans and pricing</Link>
        <Link href="/screenshots" className="site-menu__link"><ImageIcon size={20} />My reports</Link>
        <Link href="/brand" className="site-menu__link">Report branding</Link>
        <form action={signOutFromHeader}>
          <button type="submit" className="site-menu__link"><LogOutIcon size={20} />Sign out</button>
        </form>
      </>
    ) : (
      <Link href="/signin" className="site-menu__link"><LogInIcon size={20} />Sign in</Link>
    );
  }

  return session.signedIn ? (
    <AccountMenu>
      <div className="account-menu__panel">
        <p>{session.email}</p>
        {session.admin && <Link href="/admin">Admin</Link>}
        <Link href="/account">Account and devices</Link>
        <Link href="/pricing">Plans and pricing</Link>
        <Link href="/screenshots"><ImageIcon size={20} />My reports</Link>
        <Link href="/brand">Report branding</Link>
        <form action={signOutFromHeader}>
          <button type="submit"><LogOutIcon size={20} />Sign out</button>
        </form>
      </div>
    </AccountMenu>
  ) : (
    <Link href="/signin" className="site-signin"><LogInIcon size={20} />Sign in</Link>
  );
}
