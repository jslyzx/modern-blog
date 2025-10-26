"use client";

import { useTransition } from "react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(() => {
      void signOut({ callbackUrl: "/admin/login" });
    });
  };

  return (
    <Button variant="ghost" onClick={handleSignOut} disabled={isPending}>
      {isPending ? "正在退出..." : "退出登录"}
    </Button>
  );
}
