"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

interface DeletePostButtonProps {
  postId: number;
  postTitle: string;
}

export function DeletePostButton({ postId, postTitle }: DeletePostButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!window.confirm(`Delete "${postTitle}"? This cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
      });

      if (!response.ok && response.status !== 204) {
        let message = "Failed to delete post";

        try {
          const data = await response.json();
          if (data?.error) {
            message = data.error;
          }
        } catch (error) {
          console.error("Failed to parse delete response", error);
        }

        window.alert(message);
        return;
      }

      router.refresh();
    });
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isPending} className="text-destructive">
      {isPending ? "Deleting..." : "Delete"}
    </Button>
  );
}
