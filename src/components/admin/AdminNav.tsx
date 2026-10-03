"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const OWNER_LINKS: ([string, string] | "hr")[] = [
  ["/admin", "Dashboard"],
  ["/admin/orders", "Orders"],
  ["/admin/products", "Products"],
  ["/admin/customers", "Customers"],
  ["/admin/subscriptions", "Subscriptions"],
  ["/admin/coupons", "Coupons"],
  "hr",
  ["/admin/finance", "Profit and taxes"],
  ["/admin/expenses", "Expenses"],
  ["/admin/timeclock", "Time clock"],
  "hr",
  ["/admin/marketing", "Email marketing"],
  ["/admin/messages", "Messages"],
  "hr",
  ["/admin/staff", "Team"],
  ["/admin/settings", "Settings"],
];

export function AdminNav({ role }: { role: "owner" | "staff" }) {
  const path = usePathname();
  const links = role === "owner" ? OWNER_LINKS : ([["/admin/timeclock", "Time clock"]] as [string, string][]);
  return (
    <nav className="admin-nav" aria-label="Admin">
      {links.map((l, i) =>
        l === "hr" ? (
          <hr key={`hr${i}`} />
        ) : (
          <Link key={l[0]} href={l[0]} aria-current={(l[0] === "/admin" ? path === "/admin" : path.startsWith(l[0])) ? "page" : undefined}>
            {l[1]}
          </Link>
        ),
      )}
    </nav>
  );
}
