"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import { EditorContent, useEditor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import History from "@tiptap/extension-history";
import { Bold, Image as ImageIcon, Italic, List, ListOrdered, Redo2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MAX_FILE_SIZE_BYTES, allowedImageMimeTypes } from "@/lib/media-config";
import { cn } from "@/lib/utils";

const allowedTypes = new Set(allowedImageMimeTypes);
const allowedTypeLabels = allowedImageMimeTypes.map((type) => type.replace("image/", "").replace("+xml", ""));
const INITIAL_CONTENT = "<p>开始撰写文章...</p>";

const humanFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const toolbarButtonClasses = (active?: boolean) =>
  cn(
    "inline-flex h-9 items-center justify-center rounded-md border px-2 text-sm font-medium transition",
    active ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
  );

export function RichTextEditor() {
  const [previewHtml, setPreviewHtml] = useState(INITIAL_CONTENT);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4],
        },
      }),
      History.configure({
        depth: 100,
      }),
      Image.configure({
        HTMLAttributes: {
          class: "my-4 rounded-md",
        },
      }),
    ],
    content: INITIAL_CONTENT,
    onUpdate({ editor }) {
      setPreviewHtml(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor) {
      setPreviewHtml(editor.getHTML());
    }
  }, [editor]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const validateFile = (file: File) => {
    if (!allowedTypes.has(file.type)) {
      return `不支持的文件类型，仅支持：${allowedTypeLabels.join(", ")}。`;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `文件过大，最大限制为 ${humanFileSize(MAX_FILE_SIZE_BYTES)}。`;
    }

    return null;
  };

  const uploadImage = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);

      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/media/upload", {
          method: "POST",
          body: formData,
        });

        const payload = await response.json();

        if (!response.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "上传失败。";
          setError(message);
          return;
        }

        if (typeof payload?.url !== "string") {
          setError("上传失败：响应缺少 URL。");
          return;
        }

        const imageAttributes: { src: string; alt: string; width?: number; height?: number } = {
          src: payload.url,
          alt: file.name,
        };

        if (typeof payload.width === "number" && typeof payload.height === "number") {
          imageAttributes.width = payload.width;
          imageAttributes.height = payload.height;
        }

        editor?.chain().focus().setImage(imageAttributes).run();
      } catch (uploadError) {
        console.error("Failed to upload image", uploadError);
        setError("上传失败，请重试。");
      } finally {
        setUploading(false);
      }
    },
    [editor],
  );

  const onSelectImage = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      event.target.value = "";

      if (!selectedFile) {
        return;
      }

      await uploadImage(selectedFile);
    },
    [uploadImage],
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handlePaste = (event: ClipboardEvent) => {
      if (!event.clipboardData || uploading) {
        return;
      }

      const imageFiles: File[] = [];

      for (const item of Array.from(event.clipboardData.items)) {
        if (item.kind !== "file") {
          continue;
        }

        const file = item.getAsFile();

        if (file && allowedTypes.has(file.type)) {
          imageFiles.push(file);
        }
      }

      if (imageFiles.length === 0) {
        return;
      }

      event.preventDefault();

      const uploadSequentially = async () => {
        for (const imageFile of imageFiles) {
          await uploadImage(imageFile);
        }
      };

      void uploadSequentially();
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener("paste", handlePaste);

    return () => {
      editorElement.removeEventListener("paste", handlePaste);
    };
  }, [editor, uploadImage, uploading]);

  const triggerFileBrowser = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (!editor) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={toolbarButtonClasses(editor.isActive("bold"))}
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={toolbarButtonClasses(editor.isActive("italic"))}
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={toolbarButtonClasses(editor.isActive("bulletList"))}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={toolbarButtonClasses(editor.isActive("orderedList"))}
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className={toolbarButtonClasses()}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className={toolbarButtonClasses()}
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={Array.from(allowedTypes).join(",")}
              onChange={onSelectImage}
              className="hidden"
              disabled={uploading}
            />
            <Button type="button" variant="outline" onClick={triggerFileBrowser} disabled={uploading}>
              <ImageIcon className="mr-2 h-4 w-4" />
              {uploading ? "上传中..." : "插入图片"}
            </Button>
          </div>
        </div>
        <div className="mt-4 rounded-md border">
          <EditorContent editor={editor} className="editor-content px-3 py-4" />
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <p className="mt-2 text-xs text-muted-foreground">
          支持的格式：{allowedTypeLabels.join(", ")} · 最大体积 {humanFileSize(MAX_FILE_SIZE_BYTES)}
        </p>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">预览</h2>
        <div
          className="preview-content mt-3 space-y-4 rounded-md border bg-background p-4"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
    </div>
  );
}
