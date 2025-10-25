import { Suspense } from "react";
import { getPublishedPostsPaginated, getFeaturedPosts } from "@/lib/posts";
import { PostCard } from "@/components/site/post-card";
import { Pagination } from "@/components/site/pagination";

interface HomePageProps {
  searchParams: Promise<{ page?: string }>;
}

async function FeaturedSection() {
  const featuredPosts = await getFeaturedPosts(3);

  if (featuredPosts.length === 0) return null;

  return (
    <section className="border-b bg-muted/50 py-12">
      <div className="container mx-auto px-4">
        <h2 className="mb-8 text-3xl font-bold">Featured Posts</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featuredPosts.map((post) => (
            <PostCard key={post.id} post={post} featured />
          ))}
        </div>
      </div>
    </section>
  );
}

async function PostsFeed({ page }: { page: number }) {
  const { posts, totalPages } = await getPublishedPostsPaginated(page, 10);

  if (posts.length === 0) {
    return (
      <div className="py-24 text-center">
        <h2 className="text-2xl font-semibold text-muted-foreground">No posts found</h2>
        <p className="mt-2 text-muted-foreground">Check back later for new content!</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="mt-12">
          <Pagination currentPage={page} totalPages={totalPages} />
        </div>
      )}
    </>
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);

  return (
    <>
      <Suspense fallback={<div className="py-12">Loading featured posts...</div>}>
        <FeaturedSection />
      </Suspense>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-3xl font-bold">Latest Posts</h2>
          <Suspense fallback={<div>Loading posts...</div>}>
            <PostsFeed page={page} />
          </Suspense>
        </div>
      </section>
    </>
  );
}
