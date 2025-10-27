"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function DashboardRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <Button type="button" variant="outline" onClick={handleRefresh} disabled={isPending}>
      {isPending ? "刷新中..." : "刷新"}
    </Button>
  );
}
