"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FormValues = {
  siteTitle: string;
  siteDescription: string;
  defaultOgImage: string;
};

interface SiteSettingsFormProps {
  initialValues: FormValues;
}

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

const updateSetting = async (key: string, value: string | null): Promise<void> => {
  const response = await fetch("/api/settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key, value }),
  });

  let payload: any = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || "保存设置失败");
  }
};

export function SiteSettingsForm({ initialValues }: SiteSettingsFormProps) {
  const router = useRouter();
  const [formValues, setFormValues] = useState<FormValues>(initialValues);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  useEffect(() => {
    setFormValues(initialValues);
  }, [initialValues.siteTitle, initialValues.siteDescription, initialValues.defaultOgImage]);

  const hasChanges = useMemo(() => {
    return (
      formValues.siteTitle !== initialValues.siteTitle ||
      formValues.siteDescription !== initialValues.siteDescription ||
      formValues.defaultOgImage !== initialValues.defaultOgImage
    );
  }, [formValues, initialValues]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setMessage(null);

    const title = formValues.siteTitle.trim();
    const description = formValues.siteDescription.trim();
    const defaultOgImage = formValues.defaultOgImage.trim();

    if (!title) {
      setMessage({ type: "error", text: "站点标题不能为空" });
      return;
    }

    setSaving(true);

    try {
      const updates: Array<{ key: string; value: string | null }> = [
        { key: "site_title", value: title },
        { key: "site_description", value: description || null },
        { key: "default_og_image", value: defaultOgImage || null },
      ];

      for (const update of updates) {
        await updateSetting(update.key, update.value);
      }

      setMessage({ type: "success", text: "设置已保存" });
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "保存设置失败" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {message ? (
        <div
          className={
            message.type === "success"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              : "rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
          }
          role="alert"
        >
          {message.text}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="site-title">站点标题 *</Label>
        <Input
          id="site-title"
          value={formValues.siteTitle}
          onChange={(event) => setFormValues((prev) => ({ ...prev, siteTitle: event.target.value }))}
          placeholder="请输入站点标题"
          required
          disabled={saving}
        />
        <p className="text-xs text-muted-foreground">将显示在站点导航、页脚以及默认元数据中。</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="site-description">站点描述</Label>
        <Textarea
          id="site-description"
          value={formValues.siteDescription}
          onChange={(event) => setFormValues((prev) => ({ ...prev, siteDescription: event.target.value }))}
          placeholder="简要介绍站点或社区"
          rows={4}
          disabled={saving}
        />
        <p className="text-xs text-muted-foreground">用于首页介绍、默认元描述等位置，留空将使用默认文案。</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="default-og-image">默认分享图像</Label>
        <Input
          id="default-og-image"
          value={formValues.defaultOgImage}
          onChange={(event) => setFormValues((prev) => ({ ...prev, defaultOgImage: event.target.value }))}
          placeholder="https://example.com/og-image.jpg 或 /images/og.jpg"
          disabled={saving}
        />
        <p className="text-xs text-muted-foreground">用于社交分享和开放图谱的默认图片，支持相对或绝对链接。</p>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={saving || !hasChanges}>
          {saving ? "保存中..." : "保存设置"}
        </Button>
      </div>
    </form>
  );
}
