import "./globals.css";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Modern Blog Admin",
  description: "Admin portal for Modern Blog",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased")}>{children}</body>
    </html>
  );
}
