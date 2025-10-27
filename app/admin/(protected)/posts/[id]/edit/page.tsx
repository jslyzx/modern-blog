import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PostForm, PostFormSkeleton } from "@/components/admin/PostForm";
import { getAllTags, getPostById } from "@/lib/admin/posts";

type EditPostPageProps = {
  params: {
    id: string;
  };
};

export default async function EditPostPage({ params }: EditPostPageProps) {
  const postId = parseInt(params.id, 10);

  if (!Number.isFinite(postId) || postId <= 0) {
    notFound();
  }

  const [post, availableTags] = await Promise.all([getPostById(postId), getAllTags()]);

  if (!post) {
    notFound();
  }

  const initialData = {
    title: post.title,
    slug: post.slug,
    summary: post.summary,
    contentHtml: post.contentHtml,
    coverImageUrl: post.coverImageUrl,
    status: post.status,
    isFeatured: post.isFeatured,
    allowComments: post.allowComments,
    tagIds: post.tags.map((tag) => tag.id),
  };

  return (
    <section className="space-y-6">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">编辑文章</h1>
        <p className="text-muted-foreground">更新文章内容、元数据与相关设置。</p>
      </header>

      <Suspense fallback={<PostFormSkeleton />}>
        <PostForm postId={post.id} initialData={initialData} initialTags={availableTags} />
      </Suspense>
    </section>
  );
}
