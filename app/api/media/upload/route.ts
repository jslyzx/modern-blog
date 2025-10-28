import { NextRequest, NextResponse } from "next/server";
import formidable, { errors as formidableErrors, type File as FormidableFile } from "formidable";
import type { IncomingMessage } from "node:http";
import { promises as fs } from "node:fs/promises";
import { Readable } from "node:stream";

import { apiErrors, createApiErrorResponse } from "@/lib/api/errors";
import { auth } from "@/auth";
import { LocalMediaStorage, isSvgMimeType } from "@/lib/media";
import { MAX_FILE_SIZE_BYTES, allowedImageMimeTypes } from "@/lib/media-config";

const storage = new LocalMediaStorage();
const allowedMimeTypesSet = new Set(allowedImageMimeTypes);
const allowedTypeSummary = allowedImageMimeTypes
  .map((type) => type.replace("image/", "").replace("+xml", ""))
  .join(", ");

const humanReadableSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)}MB`;

const cleanupTempFile = async (filepath: string | undefined) => {
  if (!filepath) {
    return;
  }

  try {
    await fs.unlink(filepath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Failed to remove temporary upload file", error);
    }
  }
};

const unauthorized = () => apiErrors.unauthorized();

const UNSAFE_SVG_CONTENT_PATTERN = /<\s*script|<\s*foreignobject|on[a-z]+\s*=|javascript:|data:text\//i;

const isSvgContentSafe = (contents: string) => !UNSAFE_SVG_CONTENT_PATTERN.test(contents);

type FormidableCompatibleRequest = Readable &
  Pick<IncomingMessage, "headers" | "method" | "url" | "httpVersion">;

const toFormidableRequest = (request: NextRequest): FormidableCompatibleRequest => {
  const stream = request.body;
  const nodeStream =
    stream != null
      ? Readable.fromWeb(stream as unknown as ReadableStream<Uint8Array>)
      : Readable.from([]);

  const headers = Object.fromEntries(request.headers.entries()) as IncomingMessage["headers"];

  return Object.assign(nodeStream, {
    headers,
    method: request.method,
    url: request.url,
    httpVersion: "1.1",
  });
};

const parseUpload = async (request: NextRequest): Promise<FormidableFile> => {
  const form = formidable({
    multiples: false,
    maxFileSize: MAX_FILE_SIZE_BYTES,
    keepExtensions: true,
  });

  const formidableRequest = toFormidableRequest(request);

  return new Promise<FormidableFile>((resolve, reject) => {
    form.parse(formidableRequest as unknown as IncomingMessage, (error, _fields, files) => {
      if (error) {
        reject(error);
        return;
      }

      const primaryFile = (files.file ?? Object.values(files)[0]) as FormidableFile | FormidableFile[] | undefined;
      const resolvedFile = Array.isArray(primaryFile) ? primaryFile[0] : primaryFile;

      if (!resolvedFile) {
        reject(new Error("缺少上传文件"));
        return;
      }

      resolve(resolvedFile);
    });
  });
};

const isFileTooLargeError = (error: unknown) =>
  error instanceof formidableErrors.FormidableError && error.code === formidableErrors.biggerThanMaxFileSize;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const contentType = request.headers.get("content-type");

  if (!contentType || !contentType.toLowerCase().includes("multipart/form-data")) {
    return createApiErrorResponse({
      status: 415,
      error: "请求的 Content-Type 必须为 multipart/form-data。",
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
  }

  let parsedFile: FormidableFile | null = null;

  try {
    const file = await parseUpload(request);
    parsedFile = file;

    if (!file.mimetype || !allowedMimeTypesSet.has(file.mimetype)) {
      await cleanupTempFile(file.filepath);

      return NextResponse.json(
        {
          error: `不支持的文件类型，仅支持：${allowedTypeSummary}。`,
        },
        { status: 415 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      await cleanupTempFile(file.filepath);

      return NextResponse.json(
        {
          error: `文件过大，最大支持 ${humanReadableSize(MAX_FILE_SIZE_BYTES)}。`,
        },
        { status: 413 },
      );
    }

    if (isSvgMimeType(file.mimetype)) {
      try {
        const svgContents = await fs.readFile(file.filepath, "utf8");

        if (!isSvgContentSafe(svgContents)) {
          await cleanupTempFile(file.filepath);

          return NextResponse.json(
            {
              error: "SVG 文件包含不受支持的脚本、事件或嵌入内容。",
            },
            { status: 415 },
          );
        }
      } catch (error) {
        await cleanupTempFile(file.filepath);
        console.warn("Failed to validate SVG upload", error);
        return NextResponse.json({ error: "无法解析 SVG 文件。" }, { status: 400 });
      }
    }

    const originalFilename = file.originalFilename ?? file.newFilename;
    const result = await storage.save({
      filepath: file.filepath,
      size: file.size,
      originalFilename,
      mimetype: file.mimetype,
    });

    parsedFile = null;

    return NextResponse.json(
      {
        url: result.url,
        width: result.width,
        height: result.height,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
        blurDataUrl: result.blurDataUrl,
        webpUrl: result.webp?.url ?? null,
        webpMimeType: result.webp?.mimeType ?? null,
        webpSizeBytes: result.webp?.sizeBytes ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (parsedFile) {
      await cleanupTempFile(parsedFile.filepath);
    }
    console.error("Failed to process media upload", error);

    if (isFileTooLargeError(error)) {
      return NextResponse.json(
        {
          error: `文件过大，最大支持 ${humanReadableSize(MAX_FILE_SIZE_BYTES)}。`,
        },
        { status: 413 },
      );
    }

    if (error instanceof Error && error.message === "缺少上传文件") {
      return NextResponse.json({ error: "未检测到上传文件。" }, { status: 400 });
    }

    return NextResponse.json({ error: "媒体上传失败。" }, { status: 400 });
  }
}
