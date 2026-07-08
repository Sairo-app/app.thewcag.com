import { auth } from "@/auth";

/** Comma-separated admin emails from the environment (unset = no admins). */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && adminEmails().includes(email.toLowerCase()));
}

/** Session + admin check for pages and server actions. Returns the session
 *  user id when the caller is an admin, null otherwise. */
export async function requireAdmin(): Promise<{ userId: string; email: string } | null> {
  const session = await auth();
  const email = session?.user?.email;
  const userId = session?.user?.id;
  if (!userId || !isAdminEmail(email)) return null;
  return { userId, email: email! };
}
