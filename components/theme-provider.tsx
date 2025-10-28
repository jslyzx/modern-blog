"use client";

import { ThemeProvider as NextThemeProvider, type ThemeProviderProps } from "next-themes";
import { ReactNode } from "react";

export type AppThemeProviderProps = Omit<ThemeProviderProps, "children"> & {
  children: ReactNode;
};

export const THEME_STORAGE_KEY = "modern-blog-theme";

export function ThemeProvider({
  children,
  themes = ["light", "dark"],
  storageKey = THEME_STORAGE_KEY,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = true,
  ...props
}: AppThemeProviderProps) {
  return (
    <NextThemeProvider
      {...props}
      attribute={attribute}
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      disableTransitionOnChange={disableTransitionOnChange}
      storageKey={storageKey}
      themes={themes}
    >
      {children}
    </NextThemeProvider>
  );
}
