"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

export interface CodeCopyButtonProps {
  code: string;
  language?: string | null;
  className?: string;
}

function useClipboard(code: string, language?: string | null) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  const contentDescription = useMemo(
    () => (language ? `${language} snippet` : "code snippet"),
    [language],
  );

  const handleSuccess = () => {
    setCopied(true);
    const descriptionForToast = `${contentDescription.charAt(0).toUpperCase()}${contentDescription.slice(1)}`;
    toast({
      title: "Copied!",
      description: `${descriptionForToast} copied to clipboard.`,
      variant: "success",
      duration: 2000,
    });
  };

  const handleError = () => {
    toast({
      title: "Copy failed",
      description: "Unable to copy to clipboard. Please try again.",
      variant: "destructive",
    });
  };

  const copy = async () => {
    if (!code) {
      return;
    }

    const supportsAsyncClipboard = typeof navigator !== "undefined" && !!navigator.clipboard?.writeText;

    try {
      if (supportsAsyncClipboard) {
        await navigator.clipboard.writeText(code);
        handleSuccess();
        return;
      }
    } catch {
      /* noop - fallback will be attempted below */
    }

    const fallbackSucceeded = (() => {
      if (typeof document === "undefined") {
        return false;
      }

      try {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "-9999px";
        textarea.style.opacity = "0";

        document.body.appendChild(textarea);
        textarea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textarea);

        return successful;
      } catch {
        return false;
      }
    })();

    if (fallbackSucceeded) {
      handleSuccess();
      return;
    }

    handleError();
  };

  return { copied, copy, contentDescription } as const;
}

export function CodeCopyButton({ code, language, className }: CodeCopyButtonProps) {
  const { copied, copy, contentDescription } = useClipboard(code, language);
  const ariaLabel = copied
    ? `${contentDescription} copied to clipboard`
    : `Copy ${contentDescription} to clipboard`;

  return (
    <div
      className={cn(
        "pointer-events-auto inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "transition-opacity",
        className,
      )}
    >
      {language ? (
        <span className="hidden text-[0.65rem] uppercase tracking-wide text-muted-foreground md:inline">{language}</span>
      ) : null}
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={ariaLabel}
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        <span className="sr-only sm:not-sr-only">{copied ? "Copied!" : "Copy"}</span>
      </button>
    </div>
  );
}
