"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import type { JSONContent } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { lowlight } from "lowlight";
import renderMathInElement from "katex/contrib/auto-render";
import {
  Bold as BoldIcon,
  Code2 as CodeIcon,
  Eye as EyeIcon,
  Heading1,
  Heading2,
  Heading3,
  Italic as ItalicIcon,
  Link as LinkIcon,
  List as ListIcon,
  ListOrdered,
  Minus as HorizontalRuleIcon,
  Quote as QuoteIcon,
  Redo2 as RedoIcon,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2 as UndoIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [],
    },
  ],
};

const MATH_DELIMITERS: Array<{ left: string; right: string; display: boolean }> = [
  { left: "$$", right: "$$", display: true },
  { left: "\\[", right: "\\]", display: true },
  { left: "\\(", right: "\\)", display: false },
  { left: "$", right: "$", display: false },
];

type PostEditorProps = {
  value: JSONContent | null;
  onChange: (payload: { html: string; json: JSONContent }) => void;
  placeholder?: string;
  className?: string;
};

const isContentEqual = (a: JSONContent | null, b: JSONContent | null): boolean => {
  return JSON.stringify(a ?? EMPTY_DOC) === JSON.stringify(b ?? EMPTY_DOC);
};

export function PostEditor({ value, onChange, placeholder = "Write your post...", className }: PostEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const previewContentRef = useRef<HTMLDivElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
      Typography,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none dark:prose-invert focus:outline-none min-h-[320px]",
      },
    },
    content: value ?? EMPTY_DOC,
    onUpdate({ editor: nextEditor }) {
      const json = nextEditor.getJSON();
      onChange({ json, html: nextEditor.getHTML() });
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (value === null) {
      if (!editor.isEmpty) {
        editor.commands.setContent(EMPTY_DOC, false);
      }
      return;
    }

    const current = editor.getJSON();

    if (!isContentEqual(current, value)) {
      editor.commands.setContent(value, false);
    }
  }, [editor, value]);

  const previewHtml = useMemo(() => {
    if (!editor) {
      return "";
    }

    return editor.getHTML();
  }, [editor, value, showPreview]);

  useEffect(() => {
    if (!showPreview) {
      return;
    }

    const element = previewContentRef.current;

    if (!element) {
      return;
    }

    renderMathInElement(element, {
      delimiters: MATH_DELIMITERS,
    });
  }, [previewHtml, showPreview]);

  if (!editor) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        Loading editor…
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-background", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2 text-muted-foreground">
        <div className="flex items-center gap-1">
          <ToolbarButton
            icon={BoldIcon}
            label="Bold"
            isActive={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            icon={ItalicIcon}
            label="Italic"
            isActive={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            icon={UnderlineIcon}
            label="Underline"
            isActive={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            icon={Strikethrough}
            label="Strikethrough"
            isActive={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
        </div>
        <div className="h-4 w-px bg-border" aria-hidden />
        <div className="flex items-center gap-1">
          <ToolbarButton
            icon={Heading1}
            label="Heading 1"
            isActive={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          />
          <ToolbarButton
            icon={Heading2}
            label="Heading 2"
            isActive={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarButton
            icon={Heading3}
            label="Heading 3"
            isActive={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          />
          <ToolbarButton
            icon={QuoteIcon}
            label="Blockquote"
            isActive={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
        </div>
        <div className="h-4 w-px bg-border" aria-hidden />
        <div className="flex items-center gap-1">
          <ToolbarButton
            icon={ListIcon}
            label="Bullet list"
            isActive={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            icon={ListOrdered}
            label="Ordered list"
            isActive={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            icon={HorizontalRuleIcon}
            label="Horizontal rule"
            isActive={false}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
        </div>
        <div className="h-4 w-px bg-border" aria-hidden />
        <div className="flex items-center gap-1">
          <ToolbarButton
            icon={CodeIcon}
            label="Code block"
            isActive={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          />
          <ToolbarButton
            icon={LinkIcon}
            label="Link"
            isActive={editor.isActive("link")}
            onClick={() => {
              const previousUrl = editor.getAttributes("link").href as string | undefined;
              const url = window.prompt("Enter URL", previousUrl ?? "https://");

              if (url === null) {
                return;
              }

              if (url === "") {
                editor.chain().focus().unsetLink().run();
                return;
              }

              editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
            }}
          />
        </div>
        <div className="h-4 w-px bg-border" aria-hidden />
        <div className="flex items-center gap-1">
          <ToolbarButton icon={UndoIcon} label="Undo" isActive={false} onClick={() => editor.chain().focus().undo().run()} />
          <ToolbarButton icon={RedoIcon} label="Redo" isActive={false} onClick={() => editor.chain().focus().redo().run()} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={showPreview ? "default" : "secondary"}
            onClick={() => setShowPreview((current) => !current)}
            className="h-8 gap-2"
          >
            <EyeIcon className="h-4 w-4" />
            {showPreview ? "Hide preview" : "Preview"}
          </Button>
        </div>
      </div>
      <div className="grid gap-0 md:grid-cols-1">
        <EditorContent editor={editor} className="px-4 py-4" />
        {showPreview && (
          <div className="border-t bg-muted/30 px-4 py-4 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
            <div className="prose prose-sm max-w-none overflow-x-auto dark:prose-invert" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        )}
      </div>
    </div>
  );
}

type ToolbarButtonProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
};

function ToolbarButton({ icon: Icon, label, isActive, onClick }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 w-8 p-0 text-muted-foreground hover:text-foreground",
        isActive && "bg-primary/10 text-primary hover:text-primary",
      )}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
