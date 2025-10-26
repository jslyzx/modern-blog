export const metadata = {
  title: "Media library",
};

export default function MediaPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Media library</h1>
        <p className="text-sm text-muted-foreground">Upload and manage images across your posts.</p>
      </div>
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
        Media management features are coming soon.
      </div>
    </section>
  );
}
