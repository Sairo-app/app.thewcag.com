"use client";

import { useActionState } from "react";
import { deleteOwnAccount, type DeleteAccountState } from "./actions";

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(
    deleteOwnAccount,
    null,
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="block text-sm font-medium" htmlFor="delete-confirmation">
        Enter <strong>DELETE MY ACCOUNT</strong> to confirm
      </label>
      <input
        id="delete-confirmation"
        name="confirmation"
        required
        autoComplete="off"
        aria-describedby={state?.error ? "delete-account-error" : undefined}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
      />
      {state?.error ? <p id="delete-account-error" role="alert" className="text-sm text-red-700">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Deleting account…" : "Permanently delete account"}
      </button>
    </form>
  );
}
