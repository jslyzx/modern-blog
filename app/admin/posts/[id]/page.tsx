import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getPostById } from "@/lib/posts";

import { PostForm } from "../_components/post-form";

type EditPostPageProps = {
  params: { id: string };
};

const parseId = (raw: string): number | null => {
  const value = Number.parseInt(raw, 10);
  return Number.isNaN(value) ? null : value;
};

export default async function EditPostPage({ params }: EditPostPageProps) {
  const id = parseId(params.id);

  if (id === null) {
    notFound();
  }

  const post = await getPostById(id);

  if (!post) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Post #{post.id}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Edit post</h1>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/posts">Back to posts</Link>
        </Button>
      </div>
      <PostForm mode="edit" initialPost={post} />
    </div>
  );
}
