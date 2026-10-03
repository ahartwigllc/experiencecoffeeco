export function statusBadge(status: string) {
  const cls = status === "paid" ? "green" : status === "cancelled" || status === "refunded" ? "red" : status === "pending" ? "amber" : "";
  return <span className={`badge ${cls}`}>{status.replace("_", " ")}</span>;
}
