export function changedRows(result: unknown) {
  return (result as { changes?: number }).changes ?? 0;
}
