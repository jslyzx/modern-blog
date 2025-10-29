import Link from "next/link";
import { notFound } from "next/navigation";

import { RestoreRevisionButton } from "@/components/admin/RestoreRevisionButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPostById } from "@/lib/admin/posts";
import { getPostRevisionById } from "@/lib/admin/post-revisions";

export const dynamic = "force-dynamic";

type RevisionDetailPageProps = {
  params: {
    id: string;
    revisionId: string;
  };
};

const parseId = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch (error) {
    console.warn("Failed to format revision timestamp", { value, error });
    return date.toLocaleString();
  }
};

const hasContent = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const formatBoolean = (value: boolean | null | undefined): string => {
  if (value === null || value === undefined) {
    return "—";
  }

  return value ? "是" : "否";
};

export default async function PostRevisionDetailPage({ params }: RevisionDetailPageProps) {
  const postId = parseId(params.id);
  const revisionId = parseId(params.revisionId);

  if (!postId || !revisionId) {
    notFound();
  }

  const [post, revision] = await Promise.all([
    getPostById(postId),
    getPostRevisionById(postId, revisionId),
  ]);

  if (!post || !revision) {
    notFound();
  }

  const editorLabel = revision.editor?.name ?? revision.editor?.email ?? "系统";
  const formattedDate = formatDateTime(revision.createdAt);
  const canRestore = !revision.isLatest;
  const summaryText = hasContent(revision.summary) ? revision.summary?.trim() ?? "" : null;
  const coverImage = hasContent(revision.coverImageUrl) ? revision.coverImageUrl : null;
  const hasHtmlContent = hasContent(revision.contentHtml);

  return (
    <section className="space-y-8">
      <header className="space-y-4 border-b pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">版本 #{revision.revisionNumber}</h1>
          {revision.isLatest ? <Badge variant="outline">当前版本</Badge> : null}
          <Badge variant="secondary">共 {revision.totalCount} 个版本</Badge>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="space-x-2">
            <span>所属文章：</span>
            <span className="font-medium text-foreground">{post.title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span>编辑者：{editorLabel}</span>
            <span>更新时间：{formattedDate}</span>
            <span>版本 ID：{revision.id}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={`/admin/posts/${post.id}/revisions`}>返回列表</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/posts/${post.id}/edit`}>返回编辑</Link>
          </Button>
          <RestoreRevisionButton postId={post.id} revisionId={revision.id} disabled={!canRestore} />
        </div>
        {!canRestore ? (
          <p className="text-sm text-muted-foreground">当前展示的是最新版本，无需恢复。</p>
        ) : null}
        {revision.diffSummary ? (
          <p className="text-sm text-muted-foreground">版本说明：{revision.diffSummary}</p>
        ) : null}
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">版本信息</h2>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">允许评论</dt>
              <dd className="font-medium text-foreground">{formatBoolean(revision.allowComments)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">推荐文章</dt>
              <dd className="font-medium text-foreground">{formatBoolean(revision.isFeatured)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">封面图片</dt>
              <dd className="font-medium text-foreground break-all">
                {coverImage ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">摘要</h2>
          {summaryText ? (
            <p className="rounded-md border bg-muted/40 p-4 leading-relaxed text-foreground">{summaryText}</p>
          ) : (
            <p className="text-sm text-muted-foreground">此版本未提供摘要。</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">内容预览</h2>
          {hasHtmlContent ? (
            <div
              className="prose prose-neutral max-w-none rounded-md border bg-background p-6 shadow-sm"
              dangerouslySetInnerHTML={{ __html: revision.contentHtml }}
            />
          ) : (
            <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
              此版本暂无 HTML 内容。
            </p>
          )}
        </div>
        {revision.contentMd ? (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Markdown 源内容</h3>
            <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-sm">{revision.contentMd}</pre>
          </div>
        ) : null}
      </div>
    </section>
  );
}