import { DashboardRefreshButton } from "@/components/admin/DashboardRefreshButton";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getLatestPosts, getMediaCount, getPostCounts, getTagCount, getUserCount } from "@/lib/admin/stats";
import type { PostStatus } from "@/lib/admin/posts";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<PostStatus, string> = {
  published: "已发布",
  draft: "草稿",
  archived: "已归档",
};

const STATUS_BADGE_VARIANTS: Record<PostStatus, BadgeProps["variant"]> = {
  published: "success",
  draft: "secondary",
  archived: "outline",
};

const formatNumber = (value: number): string => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch (error) {
    console.warn("Failed to format date", { error });
    return date.toLocaleString();
  }
};

export default async function AdminHome() {
  const [postCounts, tagCount, userCount, mediaCount, latestPosts] = await Promise.all([
    getPostCounts(),
    getTagCount(),
    getUserCount(),
    getMediaCount(),
    getLatestPosts(5),
  ]);

  const stats: Array<{ title: string; value: number }> = [
    { title: "文章总数", value: postCounts.total },
    { title: "已发布文章", value: postCounts.published },
    { title: "草稿文章", value: postCounts.draft },
    { title: "已归档文章", value: postCounts.archived },
    { title: "标签数量", value: tagCount },
    { title: "活跃用户", value: userCount },
  ];

  if (mediaCount !== null) {
    stats.push({ title: "媒体资源数量", value: mediaCount });
  }

  const hasLatestPosts = latestPosts.length > 0;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">欢迎访问管理后台</h1>
          <p className="text-muted-foreground">查看最新的站点数据并快速管理内容。</p>
        </div>
        <DashboardRefreshButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{formatNumber(stat.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">最新文章</CardTitle>
            <CardDescription>展示最近创建或更新的文章，方便快速跟进内容状态。</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {hasLatestPosts ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>发布时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="space-y-1">
                      <div className="font-medium">{post.title}</div>
                      <div className="text-xs text-muted-foreground">链接别名：{post.slug || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE_VARIANTS[post.status]}>{STATUS_LABELS[post.status]}</Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(post.createdAt)}</TableCell>
                    <TableCell>{formatDateTime(post.publishedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">暂时没有最新文章记录。</div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
