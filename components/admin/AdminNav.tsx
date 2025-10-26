"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";

type AdminNavProps = {
  userLabel: string;
};

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  {
    href: "/admin",
    label: "仪表盘",
  },
  {
    href: "/admin/posts",
    label: "文章管理",
  },
  {
    href: "/admin/tags",
    label: "标签管理",
  },
];

function getInitials(value: string) {
  const parts = value
    .split(/[\s-_]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function AdminNav({ userLabel }: AdminNavProps) {
  const pathname = usePathname();
  const initials = getInitials(userLabel);

  return (
    <aside className="flex min-h-screen w-64 flex-col border-r bg-background">
      <div className="px-6 py-6">
        <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold uppercase text-primary">
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{userLabel}</p>
            <p className="text-xs text-muted-foreground">管理员账户</p>
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 pb-6" aria-label="管理员导航">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive && "bg-muted text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t px-6 py-4">
        <LogoutButton />
      </div>
    </aside>
  );
}
