import Link from "next/link";

import { Button } from "@/components/ui/button";

import { PostForm } from "../_components/post-form";

export default function NewPostPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Create post</h1>
          <p className="text-muted-foreground">Compose a new post with the TipTap editor.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/posts">Back to posts</Link>
        </Button>
      </div>
      <PostForm mode="create" />
    </div>
  );
}
