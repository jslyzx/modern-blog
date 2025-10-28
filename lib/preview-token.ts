"use server";

import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

const BASE64_URL_REGEX = /^[A-Za-z0-9_-]+$/;

export interface PreviewTokenPayload {
  postId: number;
  exp: number;
}

export interface SignedPreviewToken {
  token: string;
  payload: PreviewTokenPayload;
}

export interface CreatePreviewTokenOptions {
  ttlMs?: number;
}

export const PREVIEW_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cachedSecret: string | null = null;

const base64UrlEncode = (buffer: Buffer): string =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const base64UrlDecode = (value: string): Buffer | null => {
  if (!value || !BASE64_URL_REGEX.test(value)) {
    return null;
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingSize = (4 - (normalized.length % 4)) % 4;
  const padded = normalized.padEnd(normalized.length + paddingSize, "=");

  try {
    return Buffer.from(padded, "base64");
  } catch {
    return null;
  }
};

const getSecret = (): string => {
  if (cachedSecret) {
    return cachedSecret;
  }

  const explicitSecret = process.env.PREVIEW_TOKEN_SECRET?.trim();
  const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim();
  const resolvedSecret = explicitSecret || nextAuthSecret;

  if (!resolvedSecret) {
    throw new Error("PREVIEW_TOKEN_SECRET (or NEXTAUTH_SECRET) must be configured to support preview links.");
  }

  cachedSecret = resolvedSecret;

  return cachedSecret;
};

const signEncodedPayload = (encodedPayload: string): Buffer => {
  return createHmac("sha256", getSecret()).update(encodedPayload, "utf8").digest();
};

const timingSafeEqualBuffer = (a: Buffer, b: Buffer): boolean => {
  if (a.length !== b.length || a.length === 0) {
    return false;
  }

  return timingSafeEqual(a, b);
};

export const createPreviewToken = (postId: number, options: CreatePreviewTokenOptions = {}): SignedPreviewToken => {
  if (!Number.isFinite(postId)) {
    throw new Error("postId must be a finite number");
  }

  const normalizedPostId = Math.trunc(postId);

  if (normalizedPostId <= 0) {
    throw new Error("postId must be a positive integer");
  }

  const ttlMsCandidate = options.ttlMs;
  const ttlMs =
    typeof ttlMsCandidate === "number" && Number.isFinite(ttlMsCandidate) && ttlMsCandidate > 0
      ? Math.trunc(ttlMsCandidate)
      : PREVIEW_TOKEN_TTL_MS;

  const exp = Date.now() + ttlMs;
  const payload: PreviewTokenPayload = {
    postId: normalizedPostId,
    exp,
  };

  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = signEncodedPayload(encodedPayload);
  const encodedSignature = base64UrlEncode(signature);

  return {
    token: `${encodedPayload}.${encodedSignature}`,
    payload,
  };
};

export const verifyPreviewToken = (token: string): PreviewTokenPayload | null => {
  if (typeof token !== "string" || !token) {
    return null;
  }

  const segments = token.split(".");

  if (segments.length !== 2) {
    return null;
  }

  const [encodedPayload, encodedSignature] = segments;
  const payloadBuffer = base64UrlDecode(encodedPayload);
  const providedSignature = base64UrlDecode(encodedSignature);

  if (!payloadBuffer || !providedSignature) {
    return null;
  }

  const expectedSignature = signEncodedPayload(encodedPayload);

  if (!timingSafeEqualBuffer(providedSignature, expectedSignature)) {
    return null;
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(payloadBuffer.toString("utf8"));
  } catch {
    return null;
  }

  const candidate = decoded as Partial<PreviewTokenPayload>;
  const { postId, exp } = candidate;

  if (typeof postId !== "number" || !Number.isFinite(postId) || postId <= 0) {
    return null;
  }

  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    return null;
  }

  const normalizedPostId = Math.trunc(postId);

  if (!Number.isSafeInteger(normalizedPostId) || normalizedPostId <= 0) {
    return null;
  }

  if (exp <= Date.now()) {
    return null;
  }

  return {
    postId: normalizedPostId,
    exp,
  };
};
