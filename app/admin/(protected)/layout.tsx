import { ReactNode } from "react";
import { redirect } from "next/navigation";

import AdminNav from "@/components/admin/AdminNav";
import { auth } from "@/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const userLabel = session.user.name ?? session.user.email ?? "Signed in";

  return (
    <div className="flex min-h-screen bg-muted/30">
      <AdminNav userLabel={userLabel} />
      <main className="flex-1 overflow-auto bg-background">
        <div className="mx-auto h-full w-full max-w-5xl p-8">{children}</div>
      </main>
    </div>
  );
}
