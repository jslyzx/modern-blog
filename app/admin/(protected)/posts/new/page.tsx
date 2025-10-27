import PostForm from "@/components/admin/PostForm";

export default function NewPostPage() {
  return (
    <div className="container py-8">
      <h1 className="mb-8 text-3xl font-bold">新建文章</h1>
      <PostForm />
    </div>
  );
}
