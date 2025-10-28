"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, QrCode, Rss, Share2, Twitter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const QRCodeCanvas = dynamic(() => import("qrcode.react").then((mod) => mod.QRCodeCanvas), {
  ssr: false,
});

type ShareButtonsProps = {
  title: string;
  url: string;
  summary?: string | null;
  className?: string;
};

const truncateText = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(maxLength - 1, 0))}…`;
};

const sanitizeSummary = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\s+/g, " ");
};

export function ShareButtons({ title, url, summary, className }: ShareButtonsProps) {
  const { toast } = useToast();
  const [isShareSupported, setIsShareSupported] = useState(false);
  const [isWeChatOpen, setIsWeChatOpen] = useState(false);

  const normalizedSummary = useMemo(() => sanitizeSummary(summary), [summary]);
  const shareDescription = normalizedSummary ?? title;

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }

    setIsShareSupported(typeof navigator.share === "function");
  }, []);

  const openShareWindow = useCallback(
    (shareUrl: string) => {
      if (typeof window === "undefined") {
        return;
      }

      const popup = window.open(shareUrl, "_blank", "noopener,noreferrer");

      if (!popup) {
        toast({
          title: "无法打开分享窗口",
          description: "请检查浏览器的弹窗拦截设置。",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleWeiboShare = useCallback(() => {
    const shareUrl = new URL("https://service.weibo.com/share/share.php");
    shareUrl.searchParams.set("url", url);
    const text = normalizedSummary ? `${title} - ${normalizedSummary}` : title;
    shareUrl.searchParams.set("title", truncateText(text, 280));
    openShareWindow(shareUrl.toString());
  }, [normalizedSummary, openShareWindow, title, url]);

  const handleTwitterShare = useCallback(() => {
    const shareUrl = new URL("https://twitter.com/intent/tweet");
    shareUrl.searchParams.set("url", url);
    const text = normalizedSummary ? `${title} — ${normalizedSummary}` : title;
    shareUrl.searchParams.set("text", truncateText(text, 240));
    openShareWindow(shareUrl.toString());
  }, [normalizedSummary, openShareWindow, title, url]);

  const handleCopyLink = useCallback(async () => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      toast({
        title: "无法复制链接",
        description: "请手动复制浏览器地址栏中的链接。",
        variant: "destructive",
      });
      return;
    }

    let success = false;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        success = true;
      } catch (error) {
        console.warn("Failed to copy via Clipboard API", error);
      }
    }

    if (!success) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        const selection = document.getSelection();
        const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        textarea.select();
        success = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (range && selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch (error) {
        console.warn("Failed to copy link", error);
        success = false;
      }
    }

    if (success) {
      toast({
        title: "链接已复制",
        description: "现在可以粘贴给朋友或分享到社交平台。",
        variant: "success",
      });
    } else {
      toast({
        title: "无法复制链接",
        description: "请手动复制浏览器地址栏中的链接。",
        variant: "destructive",
      });
    }
  }, [toast, url]);

  const handleNativeShare = useCallback(async () => {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      toast({
        title: "分享不可用",
        description: "当前浏览器不支持系统分享，请尝试其它方式。",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.share({
        title,
        text: shareDescription,
        url,
      });
    } catch (error) {
      if (error instanceof DOMException && (error.name === "AbortError" || error.name === "NotAllowedError")) {
        return;
      }

      console.warn("Failed to invoke Web Share API", error);
      toast({
        title: "分享失败",
        description: "无法打开系统分享，请尝试其它方式。",
        variant: "destructive",
      });
    }
  }, [shareDescription, title, toast, url]);

  return (
    <div className={cn("space-y-4", className)}>
      <Dialog open={isWeChatOpen} onOpenChange={setIsWeChatOpen}>
        <div className="hidden lg:flex lg:flex-col lg:items-center">
          <div className="sticky top-32 flex flex-col items-center gap-3 rounded-full border border-border/60 bg-background/80 p-3 shadow-sm backdrop-blur">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">分享</span>
            <DialogTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="rounded-full border border-[#07C160]/30 bg-[#07C160]/10 text-[#07C160] hover:bg-[#07C160]/20"
                aria-label="通过微信扫码分享"
              >
                <QrCode className="h-5 w-5" aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="rounded-full border border-[#E6162D]/20 bg-[#E6162D]/10 text-[#E6162D] hover:bg-[#E6162D]/20"
              aria-label="分享到微博"
              onClick={handleWeiboShare}
            >
              <Rss className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="rounded-full border border-[#1DA1F2]/20 bg-[#1DA1F2]/10 text-[#1DA1F2] hover:bg-[#1DA1F2]/20"
              aria-label="分享到 Twitter"
              onClick={handleTwitterShare}
            >
              <Twitter className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="rounded-full border border-border/60 text-muted-foreground hover:text-foreground"
              aria-label="复制文章链接"
              onClick={handleCopyLink}
            >
              <Copy className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="lg:hidden">
          <div className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm backdrop-blur">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">分享本文</p>
            <div className="flex flex-wrap items-center gap-3">
              {isShareSupported ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[140px]"
                  onClick={handleNativeShare}
                >
                  <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  系统分享
                </Button>
              ) : null}
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[120px] border-[#07C160]/30 bg-[#07C160]/5 text-[#07C160] hover:bg-[#07C160]/10"
                >
                  <QrCode className="mr-2 h-4 w-4" aria-hidden="true" />
                  微信
                </Button>
              </DialogTrigger>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 min-w-[120px] border-[#E6162D]/30 bg-[#E6162D]/5 text-[#E6162D] hover:bg-[#E6162D]/10"
                onClick={handleWeiboShare}
              >
                <Rss className="mr-2 h-4 w-4" aria-hidden="true" />
                微博
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 min-w-[120px] border-[#1DA1F2]/30 bg-[#1DA1F2]/5 text-[#1DA1F2] hover:bg-[#1DA1F2]/10"
                onClick={handleTwitterShare}
              >
                <Twitter className="mr-2 h-4 w-4" aria-hidden="true" />
                Twitter
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 min-w-[120px]"
                onClick={handleCopyLink}
              >
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                复制链接
              </Button>
            </div>
          </div>
        </div>

        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>分享到微信</DialogTitle>
            <DialogDescription>使用微信扫一扫，发送给好友或分享到朋友圈。</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {isWeChatOpen ? (
              <QRCodeCanvas value={url} size={200} includeMargin className="h-48 w-48" />
            ) : (
              <div className="h-48 w-48 animate-pulse rounded-lg bg-muted" />
            )}
            <p className="text-center text-sm text-muted-foreground">使用微信扫描二维码即可分享此文章。</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
