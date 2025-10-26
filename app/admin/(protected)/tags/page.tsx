import Link from "next/link";

import { TagManager } from "@/components/admin/tag-manager";
import { Button } from "@/components/ui/button";
import { listTags } from "@/lib/admin/tags";

export const metadata = {
  title: "Manage tags",
};

export default async function TagsPage() {
  const tags = await listTags();

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tags</h1>
          <p className="text-sm text-muted-foreground">Organize posts with keywords and topical labels.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/posts">Back to posts</Link>
        </Button>
      </div>
      <TagManager initialTags={tags} />
    </section>
  );
}
