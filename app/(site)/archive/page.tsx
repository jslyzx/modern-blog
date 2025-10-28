import type { Metadata } from "next";
import Link from "next/link";

import { buildPostPath } from "@/lib/paths";
import { getPublishedPosts, type PublishedPostSummary } from "@/lib/posts";
import { createAbsoluteUrlFromConfig, getSiteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

type ArchivePost = {
  id: number;
  slug: string;
  title: string;
  date: Date;
};

type ArchiveMonthGroup = {
  month: number;
  posts: ArchivePost[];
};

type ArchiveYearGroup = {
  year: number;
  months: ArchiveMonthGroup[];
};

const getPostDate = (post: PublishedPostSummary): Date | null => post.publishedAt ?? post.createdAt ?? null;

const getPostSlug = (post: PublishedPostSummary): string | null => {
  const slug = post.slug?.trim();

  return slug ? slug : null;
};

const groupPostsByYearAndMonth = (posts: PublishedPostSummary[]): ArchiveYearGroup[] => {
  const yearMap = new Map<number, Map<number, ArchivePost[]>>();

  for (const post of posts) {
    const date = getPostDate(post);
    const slug = getPostSlug(post);

    if (!date || !slug) {
      continue;
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const entry: ArchivePost = {
      id: post.id,
      slug,
      title: post.title,
      date,
    };

    if (!yearMap.has(year)) {
      yearMap.set(year, new Map<number, ArchivePost[]>());
    }

    const monthMap = yearMap.get(year)!;
    const monthPosts = monthMap.get(month);

    if (monthPosts) {
      monthPosts.push(entry);
    } else {
      monthMap.set(month, [entry]);
    }
  }

  const yearGroups: ArchiveYearGroup[] = [];

  for (const [year, monthMap] of Array.from(yearMap.entries()).sort((a, b) => b[0] - a[0])) {
    const months: ArchiveMonthGroup[] = [];

    for (const [month, monthPosts] of Array.from(monthMap.entries()).sort((a, b) => b[0] - a[0])) {
      const sortedPosts = [...monthPosts].sort((a, b) => b.date.getTime() - a.date.getTime());

      months.push({
        month,
        posts: sortedPosts,
      });
    }

    if (months.length > 0) {
      yearGroups.push({
        year,
        months,
      });
    }
  }

  return yearGroups;
};

const formatMonthLabel = (year: number, month: number): string => {
  try {
    return new Intl.DateTimeFormat("zh-CN", { month: "long" }).format(new Date(year, month - 1, 1));
  } catch (error) {
    console.warn("Failed to format month label", { month, error });
    return `${month}月`;
  }
};

const formatPostDateLabel = (date: Date): string => {
  try {
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch (error) {
    console.warn("Failed to format archive post date", { error });
    return date.toISOString().slice(0, 10);
  }
};

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteConfig();
  const title = "文章归档";
  const description = "按年份和月份浏览所有已发布文章。";
  const canonicalUrl = createAbsoluteUrlFromConfig(site, "/archive");

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function ArchivePage() {
  const posts = await getPublishedPosts();
  const archive = groupPostsByYearAndMonth(posts);
  const hasPosts = archive.length > 0;

  return (
    <main className="container mx-auto max-w-5xl space-y-10 px-4 py-12">
      <header className="space-y-2 text-center md:text-left">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">文章归档</h1>
        <p className="text-lg text-muted-foreground">按年份和月份浏览所有已发布文章。</p>
      </header>

      {hasPosts ? (
        <div className="space-y-12">
          {archive.map((yearGroup) => (
            <section key={yearGroup.year} className="space-y-6">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">{yearGroup.year}</h2>
              <div className="space-y-8">
                {yearGroup.months.map((monthGroup) => (
                  <div key={`${yearGroup.year}-${monthGroup.month}`} className="space-y-4">
                    <h3 className="flex items-baseline gap-2 text-xl font-semibold text-foreground">
                      <span>{formatMonthLabel(yearGroup.year, monthGroup.month)}</span>
                      <span className="text-sm text-muted-foreground">({monthGroup.posts.length})</span>
                    </h3>
                    <ul className="space-y-3">
                      {monthGroup.posts.map((post) => (
                        <li key={post.id}>
                          <Link
                            href={buildPostPath(post.slug)}
                            className="group flex flex-col gap-1 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                          >
                            <span className="text-base font-medium text-foreground transition-colors group-hover:text-primary">
                              {post.title}
                            </span>
                            <time
                              dateTime={post.date.toISOString()}
                              className="text-sm text-muted-foreground whitespace-nowrap"
                            >
                              {formatPostDateLabel(post.date)}
                            </time>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/20 p-12 text-center">
          <p className="text-base text-muted-foreground">暂无已发布的文章。</p>
        </div>
      )}
    </main>
  );
}
