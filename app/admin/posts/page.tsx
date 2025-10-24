import Link from "next/link";

import { Button } from "@/components/ui/button";

import { PostsTable } from "./_components/posts-table";

export default function AdminPostsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Posts</h1>
          <p className="text-muted-foreground">Create, edit, publish, and manage your posts.</p>
        </div>
        <Button asChild>
          <Link href="/admin/posts/new">New post</Link>
        </Button>
      </div>
      <PostsTable />
    </div>
  );
}
