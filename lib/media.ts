import { promises as fs } from "node:fs/promises";
import path from "node:path";

import { IMAGE_MIME_EXTENSION_MAP } from "./media-config";

export interface MediaUpload {
  filepath: string;
  size: number;
  originalFilename?: string | null;
  mimetype?: string | null;
}

export interface MediaUploadResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  storagePath: string;
}

export interface MediaStorageProvider {
  save(file: MediaUpload): Promise<MediaUploadResult>;
}

export interface AliyunOssConfiguration {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  region: string;
  baseUrl?: string;
}

export class AliyunOssMediaStorage implements MediaStorageProvider {
  constructor(private readonly config: AliyunOssConfiguration) {}

  async save(): Promise<MediaUploadResult> {
    const { bucket } = this.config;

    throw new Error(`Aliyun OSS media provider is not implemented yet for bucket "${bucket}".`);
  }
}

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const URL_PREFIX = "/uploads";

const MIME_EXTENSION_MAP = IMAGE_MIME_EXTENSION_MAP;

const sanitizeFilename = (filename: string) => {
  const normalized = filename
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");

  return normalized || "file";
};

const ensureUploadsDirectory = async () => {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
};

const moveFile = async (source: string, destination: string) => {
  try {
    await fs.rename(source, destination);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "EXDEV") {
      const buffer = await fs.readFile(source);
      await fs.writeFile(destination, buffer);
      await fs.unlink(source);
      return;
    }

    throw error;
  }
};

export class LocalMediaStorage implements MediaStorageProvider {
  async save(file: MediaUpload): Promise<MediaUploadResult> {
    await ensureUploadsDirectory();

    const originalName = file.originalFilename ?? "upload";
    const sanitized = sanitizeFilename(path.basename(originalName));
    const extensionFromName = path.extname(sanitized);
    const normalizedBase = extensionFromName ? sanitized.slice(0, -extensionFromName.length) : sanitized;
    const safeBase = normalizedBase || "file";
    const guessedExtension = file.mimetype ? MIME_EXTENSION_MAP[file.mimetype] : undefined;
    const extension = extensionFromName || guessedExtension || "";
    const timestamp = Date.now();
    const finalFilename = extension ? `${timestamp}-${safeBase}${extension}` : `${timestamp}-${safeBase}`;

    const storagePath = path.join(UPLOADS_DIR, finalFilename);
    await moveFile(file.filepath, storagePath);

    const url = `${URL_PREFIX}/${finalFilename}`;

    return {
      url,
      filename: finalFilename,
      size: file.size,
      mimeType: file.mimetype ?? "application/octet-stream",
      storagePath,
    };
  }
}

