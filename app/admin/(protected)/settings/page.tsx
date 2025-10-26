export const metadata = {
  title: "Admin settings",
};

export default function SettingsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure application preferences and account options.</p>
      </div>
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
        Settings management will be available in a future update.
      </div>
    </section>
  );
}
