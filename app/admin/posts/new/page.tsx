import { PostEditor } from "../_components/post-editor";

export default function NewPostPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Create post</h2>
        <p className="text-sm text-muted-foreground">
          Draft a new post and assign tags before publishing.
        </p>
      </div>
      <PostEditor mode="create" />
    </div>
  );
}
