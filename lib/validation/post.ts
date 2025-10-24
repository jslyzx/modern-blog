import { z } from "zod";

import { POST_STATUSES, type PostStatus } from "@/types/post";

const postStatusValues = [...POST_STATUSES] as [PostStatus, ...PostStatus[]];

export const postStatusSchema = z.enum(postStatusValues);

const metadataSchema = z.record(z.unknown());

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may contain lowercase letters, numbers, and hyphens")
  .max(255);

const basePostSchema = z.object({
  title: z
    .string()
    .trim()
    .max(255, "Title must be 255 characters or less")
    .optional()
    .nullable(),
  slug: slugSchema.optional().nullable(),
  excerpt: z
    .string()
    .trim()
    .max(1024, "Excerpt must be 1024 characters or less")
    .optional()
    .nullable(),
  content: z
    .string()
    .optional()
    .nullable(),
  editorContent: jsonValueSchema.optional().nullable(),
  metadata: metadataSchema.optional().nullable(),
  tags: z
    .array(z.string().min(1).max(64))
    .max(20, "A maximum of 20 tags is supported")
    .optional(),
  allowComments: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  publishedAt: z.string().datetime().optional().nullable(),
  editorId: z.number().int().positive("editorId must be a positive integer").optional(),
});

export const postCreateSchema = basePostSchema
  .extend({
    status: postStatusSchema.default("draft"),
  })
  .superRefine((data, ctx) => {
    if (data.status === "published") {
      if (!data.title || data.title.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Title is required when publishing",
          path: ["title"],
        });
      }

      if (!data.content || data.content.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Content is required when publishing",
          path: ["content"],
        });
      }
    }
  });

export const postUpdateSchema = basePostSchema
  .extend({
    status: postStatusSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "published") {
      if (!data.title || data.title.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Title is required when publishing",
          path: ["title"],
        });
      }

      if (!data.content || data.content.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Content is required when publishing",
          path: ["content"],
        });
      }
    }
  });

export type PostCreatePayload = z.infer<typeof postCreateSchema>;
export type PostUpdatePayload = z.infer<typeof postUpdateSchema>;
