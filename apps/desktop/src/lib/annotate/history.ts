export function appendUndoSnapshot<T>(
  history: T[],
  snapshot: T,
  continuingEdit: boolean,
  limit = 40,
): T[] {
  if (continuingEdit) return history;
  return [...history.slice(-(limit - 1)), snapshot];
}
