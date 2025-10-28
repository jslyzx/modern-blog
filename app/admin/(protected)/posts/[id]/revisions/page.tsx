import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPostById } from "@/lib/admin/posts";
import { getPostRevisions } from "@/lib/admin/post-revisions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type RevisionsPageProps = {
  params: {
    id: string;
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

export default async function PostRevisionsPage({ params }: RevisionsPageProps) {
  const postId = parseId(params.id);

  if (!postId) {
    notFound();
  }

  const [post, revisions] = await Promise.all([getPostById(postId), getPostRevisions(postId)]);

  if (!post) {
    notFound();
  }

  const revisionCount = revisions.length;

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">历史版本</h1>
          <p className="text-muted-foreground">
            查看并管理文章「{post.title}」的所有历史版本。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">共 {revisionCount} 个版本</Badge>
          <Button asChild variant="outline">
            <Link href={`/admin/posts/${post.id}/edit`}>返回编辑</Link>
          </Button>
        </div>
      </header>

      {revisions.length ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">版本</TableHead>
                <TableHead>编辑</TableHead>
                <TableHead className="w-64">更新时间</TableHead>
                <TableHead>说明</TableHead>
                <TableHead className="w-32 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revisions.map((revision) => {
                const editorName = revision.editor.name ?? revision.editor.email ?? "系统";

                return (
                  <TableRow key={revision.id} className={cn(revision.isLatest && "bg-muted/60")}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>#{revision.revisionNumber}</span>
                        {revision.isLatest ? <Badge variant="outline">当前</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{editorName}</TableCell>
                    <TableCell>{formatDateTime(revision.createdAt)}</TableCell>
                    <TableCell>{revision.diffSummary ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/posts/${post.id}/revisions/${revision.id}`}>查看</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">暂时没有可用的历史版本。</p>
      )}
    </section>
  );
}
