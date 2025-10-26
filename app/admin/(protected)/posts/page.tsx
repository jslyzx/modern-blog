import Link from "next/link";

import PostsList from "@/components/admin/PostsList";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_POST_STATUS_FILTER,
  getAdminPosts,
  isPostStatusFilter,
  type PostStatusFilter,
} from "@/lib/admin/posts";

export const dynamic = "force-dynamic";

type PostsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const resolveParamValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export default async function PostsPage({ searchParams = {} }: PostsPageProps) {
  const rawStatus = resolveParamValue(searchParams.status);
  const rawSearch = resolveParamValue(searchParams.search);

  const status: PostStatusFilter = rawStatus && isPostStatusFilter(rawStatus) ? rawStatus : DEFAULT_POST_STATUS_FILTER;
  const searchQuery = typeof rawSearch === "string" ? rawSearch : "";

  const posts = await getAdminPosts({ status, search: searchQuery });

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-2 border-b pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">文章管理</h1>
          <p className="text-muted-foreground">在此管理已发布、草稿和已归档的文章。</p>
        </div>
        <Button asChild>
          <Link href="/admin/posts/new">新建文章</Link>
        </Button>
      </header>

      <PostsList posts={posts} statusFilter={status} searchQuery={searchQuery} />
    </section>
  );
}
