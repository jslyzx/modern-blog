import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-muted to-background px-6 py-24">
      <div className="mx-auto max-w-xl text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Modern Blog Admin</h1>
        <p className="text-base text-muted-foreground">
          This project provides a secure administrative interface backed by credentials-based authentication built with NextAuth.js.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/admin/login" className={buttonVariants({ size: "lg" })}>
            Admin Login
          </Link>
        </div>
      </div>
    </main>
  );
}
