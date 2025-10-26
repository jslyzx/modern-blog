import { notFound } from "next/navigation";

import { PostForm } from "@/components/admin/PostForm";
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

  const [post, tags] = await Promise.all([getPostById(postId), getAllTags()]);

  if (!post) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">编辑文章</h1>
        <p className="text-muted-foreground">更新文章内容、元数据与相关设置。</p>
      </header>

      <PostForm
        postId={post.id}
        initialData={{
          title: post.title,
          slug: post.slug,
          summary: post.summary,
          content: post.content,
          coverImageUrl: post.coverImageUrl,
          status: post.status,
          featured: post.featured,
          allowComments: post.allowComments,
          tags: post.tags.map((t) => t.id),
        }}
        availableTags={tags}
      />
    </section>
  );
}
