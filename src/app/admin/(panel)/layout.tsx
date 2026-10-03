import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireStaff } from "@/lib/auth";
import { signOut } from "../actions/auth";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  return (
    <div className="admin">
      <aside className="admin-side">
        <Link href="/admin" className="wordmark">
          Experience Coffee
        </Link>
        <AdminNav role={me.role} />
        <div className="admin-user">
          {me.name}
          <br />
          <Link href="/" style={{ color: "inherit" }}>
            View store
          </Link>
          <form action={signOut}>
            <button className="link-button" style={{ color: "inherit" }} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
