import { NextRequest, NextResponse } from "next/server";
import formidable, { errors as formidableErrors, type File as FormidableFile } from "formidable";
import type { IncomingMessage } from "node:http";
import { promises as fs } from "node:fs/promises";
import { Readable } from "node:stream";

import { LocalMediaStorage } from "@/lib/media";
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
        reject(new Error("No file provided"));
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
  const contentType = request.headers.get("content-type");

  if (!contentType || !contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Content-Type must be multipart/form-data" },
      { status: 415 },
    );
  }

  let parsedFile: FormidableFile | null = null;

  try {
    const file = await parseUpload(request);
    parsedFile = file;

    if (!file.mimetype || !allowedMimeTypesSet.has(file.mimetype)) {
      await cleanupTempFile(file.filepath);

      return NextResponse.json(
        {
          error: `Unsupported file type. Allowed types: ${allowedTypeSummary}.`,
        },
        { status: 415 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      await cleanupTempFile(file.filepath);

      return NextResponse.json(
        {
          error: `File is too large. Maximum supported size is ${humanReadableSize(MAX_FILE_SIZE_BYTES)}.`,
        },
        { status: 413 },
      );
    }

    const result = await storage.save({
      filepath: file.filepath,
      size: file.size,
      originalFilename: file.originalFilename ?? file.newFilename,
      mimetype: file.mimetype,
    });

    parsedFile = null;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (parsedFile) {
      await cleanupTempFile(parsedFile.filepath);
    }
    console.error("Failed to process media upload", error);

    if (isFileTooLargeError(error)) {
      return NextResponse.json(
        {
          error: `File is too large. Maximum supported size is ${humanReadableSize(MAX_FILE_SIZE_BYTES)}.`,
        },
        { status: 413 },
      );
    }

    if (error instanceof Error && error.message === "No file provided") {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to upload media." }, { status: 400 });
  }
}
