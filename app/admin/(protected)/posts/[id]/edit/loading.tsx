import { PostFormSkeleton } from "@/components/admin/PostForm";

export default function EditPostLoading() {
  return (
    <section className="space-y-6">
      <header className="border-b pb-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
      </header>

      <PostFormSkeleton />
    </section>
  );
}
