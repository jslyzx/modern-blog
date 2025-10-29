"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

type RestoreRevisionButtonProps = {
  postId: number;
  revisionId: number;
  disabled?: boolean;
};

export function RestoreRevisionButton({ postId, revisionId, disabled }: RestoreRevisionButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    setRestoring(true);

    try {
      const response = await fetch(`/api/posts/${postId}/revisions/${revisionId}/restore`, {
        method: "POST",
      });

      let payload: { success?: boolean; error?: string } | null = null;

      try {
        payload = await response.json();
      } catch (parseError) {
        console.warn("Failed to parse restore response", { parseError });
      }

      if (!response.ok) {
        const message = (payload && typeof payload.error === "string" && payload.error) || "恢复历史版本失败";
        throw new Error(message);
      }

      toast({
        title: "版本已恢复",
        description: "文章内容已恢复为所选历史版本。",
      });

      setOpen(false);
      router.push(`/admin/posts/${postId}/edit`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "恢复历史版本失败";
      toast({
        title: "恢复失败",
        description: message,
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !restoring && setOpen(value)}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>恢复此版本</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认恢复历史版本</DialogTitle>
          <DialogDescription>
            恢复后，当前文章内容将被该历史版本替换，并生成一个新的历史版本记录。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={restoring} onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button type="button" variant="destructive" onClick={handleRestore} disabled={restoring}>
            {restoring ? "恢复中..." : "确认恢复"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
