export default function AdminHomePage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Welcome to the admin panel</h2>
      <p className="text-sm text-muted-foreground">
        Use the navigation above to manage posts and tags.
      </p>
    </div>
  );
}
