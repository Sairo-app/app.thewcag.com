export type AdminActionResult =
  | { ok: true }
  | { ok: false; reason: string };
