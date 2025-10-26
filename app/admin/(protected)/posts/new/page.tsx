import Link from "next/link";

import { PostForm } from "@/components/admin/post-form";
import { Button } from "@/components/ui/button";
import { listTagOptions } from "@/lib/admin/tags";

export const metadata = {
  title: "Create new post",
};

export default async function NewPostPage() {
  const tags = await listTagOptions();

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create a new post</h1>
          <p className="text-sm text-muted-foreground">Draft an article and publish it to your blog.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/posts">Back to posts</Link>
        </Button>
      </div>
      <PostForm mode="create" tags={tags} />
    </section>
  );
}
