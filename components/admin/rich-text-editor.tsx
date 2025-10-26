"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import katex from "katex";
import {
  Bold,
  Code,
  FunctionSquare,
  Heading2,
  Heading3,
  Heading4,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { MAX_FILE_SIZE_BYTES, allowedImageMimeTypes } from "@/lib/media";
import { cn } from "@/lib/utils";

import "katex/dist/katex.min.css";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const allowedTypes = new Set(allowedImageMimeTypes);
const allowedTypeLabels = allowedImageMimeTypes.map((type) => type.replace("image/", "").replace("+xml", ""));

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

const headingLevels = [2, 3, 4] as const;

export function RichTextEditor({ value, onChange, placeholder = "Write your post...", disabled = false }: RichTextEditorProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        history: {
          depth: 100,
        },
        heading: {
          levels: headingLevels,
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "my-4 rounded-md",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    [placeholder],
  );

  const editor = useEditor({
    extensions,
    editable: !disabled,
    content: value || "<p></p>",
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const current = editor.getHTML();

    if (value === current) {
      return;
    }

    editor.commands.setContent(value || "<p></p>", false);
  }, [editor, value]);

  const validateFile = useCallback((file: File) => {
    if (!allowedTypes.has(file.type)) {
      return `Unsupported file type. Allowed types: ${allowedTypeLabels.join(", ")}.`;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File is too large. Maximum size is ${humanFileSize(MAX_FILE_SIZE_BYTES)}.`;
    }

    return null;
  }, []);

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
          const message = typeof payload?.error === "string" ? payload.error : "Upload failed.";
          setError(message);
          return;
        }

        if (!payload?.url) {
          setError("Upload failed: missing URL in response.");
          return;
        }

        editor?.chain().focus().setImage({ src: payload.url, alt: file.name }).run();
      } catch (uploadError) {
        console.error("Failed to upload image", uploadError);
        setError("Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [editor, validateFile],
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

  const triggerFileBrowser = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const insertFormula = useCallback(() => {
    const formula = window.prompt("Enter a LaTeX formula", "E=mc^2");

    if (!formula) {
      return;
    }

    try {
      const html = katex.renderToString(formula, {
        throwOnError: false,
        displayMode: true,
      });

      const wrapper = `<div class="katex-block my-4" data-formula="${encodeURIComponent(formula)}">${html}</div>`;
      editor?.chain().focus().insertContent(wrapper).run();
    } catch (renderError) {
      console.error("Failed to render formula", renderError);
      window.alert("Invalid formula. Please check your LaTeX syntax.");
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  const isButtonDisabled = disabled || editor.isDestroyed;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={isButtonDisabled || !editor.can().chain().focus().toggleBold().run()}
            className={toolbarButtonClasses(editor.isActive("bold"))}
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={isButtonDisabled || !editor.can().chain().focus().toggleItalic().run()}
            className={toolbarButtonClasses(editor.isActive("italic"))}
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={isButtonDisabled}
            className={toolbarButtonClasses(editor.isActive("bulletList"))}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            disabled={isButtonDisabled}
            className={toolbarButtonClasses(editor.isActive("orderedList"))}
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            disabled={isButtonDisabled}
            className={toolbarButtonClasses(editor.isActive("codeBlock"))}
          >
            <Code className="h-4 w-4" />
          </button>
          {headingLevels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
              disabled={isButtonDisabled}
              className={toolbarButtonClasses(editor.isActive("heading", { level }))}
            >
              {level === 2 ? <Heading2 className="h-4 w-4" /> : null}
              {level === 3 ? <Heading3 className="h-4 w-4" /> : null}
              {level === 4 ? <Heading4 className="h-4 w-4" /> : null}
            </button>
          ))}
          <button
            type="button"
            onClick={insertFormula}
            disabled={isButtonDisabled}
            className={toolbarButtonClasses()}
          >
            <FunctionSquare className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={isButtonDisabled || !editor.can().chain().focus().undo().run()}
            className={toolbarButtonClasses()}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={isButtonDisabled || !editor.can().chain().focus().redo().run()}
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
              disabled={uploading || disabled}
            />
            <Button type="button" variant="outline" onClick={triggerFileBrowser} disabled={uploading || disabled}>
              <ImageIcon className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Insert image"}
            </Button>
          </div>
        </div>
        <div className="mt-4 rounded-md border">
          <EditorContent editor={editor} className="editor-content min-h-[320px] px-3 py-4" />
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Accepted types: {allowedTypeLabels.join(", ")} · Max size {humanFileSize(MAX_FILE_SIZE_BYTES)}
        </p>
      </div>
    </div>
  );
}
