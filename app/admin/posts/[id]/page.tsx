import { notFound } from "next/navigation";

import { getPostById } from "@/lib/posts";

import { PostEditor } from "../_components/post-editor";

type EditPostPageProps = {
  params: {
    id: string;
  };
};

const parsePostId = (value: string): number | null => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

export default async function EditPostPage({ params }: EditPostPageProps) {
  const postId = parsePostId(params.id);

  if (!postId) {
    notFound();
  }

  const post = await getPostById(postId);

  if (!post) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Edit post</h2>
        <p className="text-sm text-muted-foreground">Update the content and tags for this post.</p>
      </div>
      <PostEditor mode="edit" postId={postId} initialPost={post} />
    </div>
  );
}
