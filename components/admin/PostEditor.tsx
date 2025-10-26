"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import { EditorContent, useEditor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo2,
  Sigma,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_FILE_SIZE_BYTES, allowedImageMimeTypes } from "@/lib/media";
import { cn } from "@/lib/utils";

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

interface PostEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export function PostEditor({ content, onChange }: PostEditorProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showFormulaDialog, setShowFormulaDialog] = useState(false);
  const [formulaContent, setFormulaContent] = useState("");
  const [formulaType, setFormulaType] = useState<"inline" | "block">("block");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: {
          depth: 100,
        },
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "my-4 rounded-md max-w-full",
        },
      }),
      Placeholder.configure({
        placeholder: "Start writing your post content...",
      }),
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const validateFile = (file: File) => {
    if (!allowedTypes.has(file.type)) {
      return `Unsupported file type. Allowed types: ${allowedTypeLabels.join(", ")}.`;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File is too large. Maximum size is ${humanFileSize(MAX_FILE_SIZE_BYTES)}.`;
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

  const triggerFileBrowser = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAddLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href;
    setLinkUrl(previousUrl || "");
    setShowLinkDialog(true);
  }, [editor]);

  const handleSaveLink = useCallback(() => {
    if (!editor) return;

    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
    }

    setShowLinkDialog(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const handleAddFormula = useCallback((type: "inline" | "block") => {
    setFormulaType(type);
    setFormulaContent("");
    setShowFormulaDialog(true);
  }, []);

  const handleInsertFormula = useCallback(() => {
    if (!editor || !formulaContent) return;

    const formulaMarkdown = formulaType === "block" ? `$$${formulaContent}$$` : `$${formulaContent}$`;
    editor.chain().focus().insertContent(formulaMarkdown).run();

    setShowFormulaDialog(false);
    setFormulaContent("");
  }, [editor, formulaContent, formulaType]);

  if (!editor) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={toolbarButtonClasses(editor.isActive("bold"))}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={toolbarButtonClasses(editor.isActive("italic"))}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={toolbarButtonClasses(editor.isActive("heading", { level: 1 }))}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={toolbarButtonClasses(editor.isActive("heading", { level: 2 }))}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={toolbarButtonClasses(editor.isActive("heading", { level: 3 }))}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={toolbarButtonClasses(editor.isActive("bulletList"))}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={toolbarButtonClasses(editor.isActive("orderedList"))}
            title="Ordered List"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={toolbarButtonClasses(editor.isActive("code"))}
            title="Inline Code"
          >
            <Code className="h-4 w-4" />
          </button>
          <button type="button" onClick={handleAddLink} className={toolbarButtonClasses(editor.isActive("link"))} title="Add Link">
            <LinkIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleAddFormula("block")}
            className={toolbarButtonClasses()}
            title="Insert Formula (Block)"
          >
            <Sigma className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className={toolbarButtonClasses()}
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className={toolbarButtonClasses()}
            title="Redo"
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
            <Button type="button" variant="outline" size="sm" onClick={triggerFileBrowser} disabled={uploading}>
              <ImageIcon className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Image"}
            </Button>
          </div>
        </div>
        <div className="mt-4 rounded-md border">
          <EditorContent editor={editor} className="editor-content min-h-[300px] px-3 py-4" />
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Accepted types: {allowedTypeLabels.join(", ")} · Max size {humanFileSize(MAX_FILE_SIZE_BYTES)} · Use $formula$ for inline
          math, $$formula$$ for block math
        </p>
      </div>

      {showLinkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">Add Link</h3>
            <Input
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowLinkDialog(false);
                  setLinkUrl("");
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveLink}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {showFormulaDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">Insert {formulaType === "block" ? "Block" : "Inline"} Formula</h3>
            <Input
              type="text"
              placeholder="E=mc^2"
              value={formulaContent}
              onChange={(e) => setFormulaContent(e.target.value)}
              className="mb-4"
            />
            <p className="mb-4 text-xs text-muted-foreground">
              {formulaType === "block" ? "Block formula will be inserted as $$formula$$" : "Inline formula will be inserted as $formula$"}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowFormulaDialog(false);
                  setFormulaContent("");
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleInsertFormula} disabled={!formulaContent}>
                Insert
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
