export const POST_STATUS_VALUES = ["published", "draft", "archived"] as const;
export type PostStatus = (typeof POST_STATUS_VALUES)[number];

export const POST_STATUS_FILTERS = ["all", ...POST_STATUS_VALUES] as const;
export type PostStatusFilter = (typeof POST_STATUS_FILTERS)[number];

export const BULK_POST_ACTIONS = ["delete", "publish", "draft", "archive"] as const;
export type BulkPostAction = (typeof BULK_POST_ACTIONS)[number];

export const DEFAULT_POST_STATUS_FILTER: PostStatusFilter = "all";

export interface AdminPost {
  id: number;
  slug: string;
  title: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string | null;
  publishedAt: string | null;
  authorId: number | null;
  authorName: string | null;
  authorEmail: string | null;
}

export interface AdminPostsQuery {
  status?: PostStatusFilter | null;
  search?: string | null;
}

// Helper functions for type checking
export const isPostStatus = (value: unknown): value is PostStatus =>
  typeof value === "string" && POST_STATUS_VALUES.includes(value as PostStatus);

export const isPostStatusFilter = (value: unknown): value is PostStatusFilter =>
  typeof value === "string" && POST_STATUS_FILTERS.includes(value as PostStatusFilter);

export const isBulkPostAction = (value: unknown): value is BulkPostAction =>
  typeof value === "string" && BULK_POST_ACTIONS.includes(value as BulkPostAction);