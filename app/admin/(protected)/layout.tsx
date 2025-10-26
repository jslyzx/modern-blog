import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { auth } from "@/auth";

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const userLabel = session.user.name ?? session.user.email ?? "Signed in";

  return (
    <div className="min-h-screen bg-muted/30 lg:flex">
      <AdminNav userLabel={userLabel} />
      <main className="flex-1">
        <div className="px-4 pb-12 pt-6 sm:px-6 lg:px-10 lg:py-12">
          <div className="mx-auto w-full max-w-6xl space-y-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
