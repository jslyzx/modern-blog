"use client";

import { useEffect, useMemo, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeOption = "light" | "dark" | "system";

type ThemeToggleProps = {
  className?: string;
};

const themeOrder: ThemeOption[] = ["light", "dark", "system"];

const themeLabels: Record<ThemeOption, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme: ThemeOption = useMemo(() => {
    if (!mounted) {
      return "system";
    }

    if (theme === "light" || theme === "dark" || theme === "system") {
      return theme;
    }

    return "system";
  }, [mounted, theme]);

  const appliedTheme: ThemeOption = useMemo(() => {
    if (!mounted) {
      return "system";
    }

    if (activeTheme === "system") {
      return resolvedTheme === "light" || resolvedTheme === "dark" ? resolvedTheme : "system";
    }

    return activeTheme;
  }, [activeTheme, mounted, resolvedTheme]);

  const Icon = useMemo(() => {
    if (appliedTheme === "dark") {
      return Moon;
    }

    if (appliedTheme === "light") {
      return Sun;
    }

    return Monitor;
  }, [appliedTheme]);

  const indicatorLabel = useMemo(() => {
    if (activeTheme === "system" && (appliedTheme === "light" || appliedTheme === "dark")) {
      return `System (${themeLabels[appliedTheme]})`;
    }

    return themeLabels[activeTheme];
  }, [activeTheme, appliedTheme]);

  const handleToggle = (): void => {
    const currentIndex = themeOrder.indexOf(activeTheme);
    const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length];
    setTheme(nextTheme);
  };

  const nextThemeLabel = themeLabels[themeOrder[(themeOrder.indexOf(activeTheme) + 1) % themeOrder.length]];

  return (
    <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        aria-label={`Activate ${nextThemeLabel} theme`}
        title={`Switch theme (${themeLabels[activeTheme]} → ${nextThemeLabel})`}
      >
        <Icon className="h-5 w-5" />
        <span className="sr-only">Change theme</span>
      </Button>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
        {indicatorLabel}
      </span>
    </div>
  );
}
