"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Settings,
  Tag,
} from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminNavProps {
  userLabel: string;
}

const navItems = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Posts",
    href: "/admin/posts",
    icon: FileText,
  },
  {
    label: "Tags",
    href: "/admin/tags",
    icon: Tag,
  },
  {
    label: "Media",
    href: "/admin/media",
    icon: ImageIcon,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
] as const;

const isActive = (currentPath: string, target: string) => {
  if (target === "/admin") {
    return currentPath === target;
  }

  return currentPath === target || currentPath.startsWith(`${target}/`);
};

export function AdminNav({ userLabel }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <>
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{userLabel}</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/admin/settings" className={cn(buttonVariants({ variant: "ghost" }), "h-8 px-2 text-xs")}>Settings</Link>
            <LogoutButton />
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({ variant: active ? "default" : "outline" }),
                  "h-9 min-w-[120px] flex-1 justify-center gap-2 whitespace-nowrap text-sm",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <aside className="hidden w-64 flex-col border-r bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:flex">
        <div className="border-b px-6 py-6">
          <Link href="/admin" className="flex items-center gap-2 text-lg font-semibold">
            <LayoutDashboard className="h-5 w-5" />
            Admin Dashboard
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">Manage your content and configuration.</p>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t px-4 py-5">
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium text-foreground">{userLabel}</p>
              <p className="text-xs text-muted-foreground">Signed in</p>
            </div>
            <LogoutButton />
          </div>
          <Link
            href="/admin/settings"
            className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" /> Account settings
          </Link>
        </div>
        <div className="border-t px-4 py-5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <LogOut className="h-3.5 w-3.5" />
            Use the sign out button to end your session securely.
          </div>
        </div>
      </aside>
    </>
  );
}
