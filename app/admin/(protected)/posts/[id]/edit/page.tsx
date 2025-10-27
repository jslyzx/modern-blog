import Link from "next/link";
import { notFound } from "next/navigation";

import { PostForm } from "@/components/admin/post-form";
import { Button } from "@/components/ui/button";
import { getPostById } from "@/lib/admin/posts";
import { listTagOptions } from "@/lib/admin/tags";

interface EditPostPageProps {
  params: {
    id: string;
  };
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const postId = Number(params.id);

  if (!Number.isFinite(postId)) {
    notFound();
  }

  const [post, tags] = await Promise.all([getPostById(postId), listTagOptions()]);

  if (!post) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Edit post</h1>
          <p className="text-sm text-muted-foreground">Update the content, metadata, and publishing status.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/posts">Back to posts</Link>
        </Button>
      </div>
      <PostForm mode="edit" post={post} tags={tags} />
    </section>
  );
}
