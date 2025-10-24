export default function PostsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 lg:py-16">{children}</div>;
}
