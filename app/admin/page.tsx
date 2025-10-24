import { RichTextEditor } from "@/components/admin/rich-text-editor";

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12 lg:py-16">
      <header className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</span>
        <h1 className="text-3xl font-semibold tracking-tight">Post editor</h1>
        <p className="text-sm text-muted-foreground">
          Draft your content and upload inline images directly from the toolbar. Uploaded media is stored under{" "}
          <code className="ml-1 rounded bg-muted px-1 py-0.5 text-xs">public/uploads</code> and available to your posts.
        </p>
      </header>

      <RichTextEditor />
    </main>
  );
}
