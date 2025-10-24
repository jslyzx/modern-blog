import type { JSONContent } from "@tiptap/core";

export const POST_STATUSES = ["draft", "published", "archived"] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export type PostMetadata = Record<string, unknown>;

export interface Post {
  id: number;
  title: string | null;
  slug: string;
  status: PostStatus;
  excerpt: string | null;
  content: string | null;
  editorContent: JSONContent | null;
  metadata: PostMetadata | null;
  tags: string[];
  allowComments: boolean;
  isFeatured: boolean;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostListResponse {
  posts: Post[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PostInput {
  title?: string | null;
  slug?: string | null;
  status?: PostStatus;
  excerpt?: string | null;
  content?: string | null;
  editorContent?: JSONContent | null;
  metadata?: PostMetadata | null;
  tags?: string[];
  allowComments?: boolean;
  isFeatured?: boolean;
  publishedAt?: string | null;
  editorId?: number | null;
}

export interface PostRevision {
  id: number;
  postId: number;
  editorId: number | null;
  snapshot: Record<string, unknown>;
  createdAt: string;
}
