import { TagManagement, type TagSummary } from "@/components/admin/tags/TagManagement";
import { listTags } from "@/lib/tags";

const PAGE_SIZE = 20;

const serializeTag = (tag: Awaited<ReturnType<typeof listTags>>["tags"][number]): TagSummary => ({
  id: tag.id,
  name: tag.name,
  slug: tag.slug,
  postCount: tag.postCount,
  createdAt: tag.createdAt ? tag.createdAt.toISOString() : null,
  updatedAt: tag.updatedAt ? tag.updatedAt.toISOString() : null,
});

export default async function TagsPage() {
  const { tags, total } = await listTags({ limit: PAGE_SIZE, offset: 0 });
  const initialTags = tags.map(serializeTag);
  const pageCount = PAGE_SIZE > 0 ? Math.ceil(total / PAGE_SIZE) : 0;

  return (
    <section className="space-y-6">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">标签管理</h1>
        <p className="text-muted-foreground">创建、更新与删除标签，并查看每个标签关联的文章数量。</p>
      </header>

      <TagManagement
        initialTags={initialTags}
        initialPagination={{
          page: 1,
          pageSize: PAGE_SIZE,
          total,
          pageCount,
          hasNextPage: pageCount > 1,
          hasPrevPage: false,
        }}
      />
    </section>
  );
}
