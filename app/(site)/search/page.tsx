import { Suspense } from "react";
import { searchPublishedPosts } from "@/lib/posts";
import { PostCard } from "@/components/site/post-card";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

function SearchForm({ initialQuery }: { initialQuery?: string }) {
  return (
    <form method="get" className="mx-auto mb-12 max-w-2xl">
      <div className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={initialQuery}
          placeholder="Search posts by title or excerpt..."
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          autoFocus
        />
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          Search
        </button>
      </div>
    </form>
  );
}

async function SearchResults({ query }: { query: string }) {
  if (!query?.trim()) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>Enter a search term to find posts.</p>
      </div>
    );
  }

  const results = await searchPublishedPosts(query);

  if (results.length === 0) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-2xl font-semibold text-muted-foreground">No results found</h2>
        <p className="mt-2 text-muted-foreground">
          Try adjusting your search terms or browse all posts.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mb-6 text-muted-foreground">
        Found {results.length} {results.length === 1 ? "result" : "results"} for &quot;{query}&quot;
      </p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {results.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q ?? "";

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="mb-8 text-4xl font-bold">Search Posts</h1>
      
      <SearchForm initialQuery={query} />

      <Suspense fallback={<div className="text-center">Searching...</div>}>
        <SearchResults query={query} />
      </Suspense>
    </div>
  );
}
