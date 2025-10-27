export const IMAGE_MIME_EXTENSION_MAP = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
} as const;

export const allowedImageMimeTypes = Object.keys(IMAGE_MIME_EXTENSION_MAP);

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
