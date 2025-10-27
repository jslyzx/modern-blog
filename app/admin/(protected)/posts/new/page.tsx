import { PostForm } from "@/components/admin/PostForm";
import { getAllTags } from "@/lib/admin/posts";

export default async function NewPostPage() {
  const tags = await getAllTags();

  return (
    <section className="space-y-6">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">新建文章</h1>
        <p className="text-muted-foreground">使用富文本与公式编辑能力创建一篇新的博客文章。</p>
      </header>

      <PostForm initialTags={tags} />
    </section>
  );
}
