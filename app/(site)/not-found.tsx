import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-4 text-6xl font-bold">404</h1>
      <h2 className="mb-4 text-2xl font-semibold">Post Not Found</h2>
      <p className="mb-8 text-muted-foreground">
        Sorry, we couldn&apos;t find the post you&apos;re looking for. It may have been moved or deleted.
      </p>
      <div className="flex gap-4">
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Go Home
        </Link>
        <Link href="/search" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Search Posts
        </Link>
      </div>
    </div>
  );
}
