import { PostForm } from "@/components/admin/PostForm";
import { getAllTags } from "@/lib/admin/posts";

export default async function NewPostPage() {
  const tags = await getAllTags();

  return (
    <section className="space-y-6">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">New Post</h1>
        <p className="text-muted-foreground">Create a new blog post with rich text editor and math formula support.</p>
      </header>

      <PostForm availableTags={tags} />
    </section>
  );
}
