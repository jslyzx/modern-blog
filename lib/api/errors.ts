import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "INVALID_PAYLOAD"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RESOURCE_NOT_FOUND"
  | "SERVER_ERROR"
  | "CONFLICT"
  | "UPLOAD_ERROR"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | (string & {});

export interface ApiErrorBody {
  error: string;
  code?: string;
}

interface ApiErrorResponseOptions {
  status: number;
  error: string;
  code?: ApiErrorCode;
}

export function createApiErrorResponse({ status, error, code }: ApiErrorResponseOptions) {
  const body: ApiErrorBody = { error };

  if (code) {
    body.code = code;
  }

  return NextResponse.json(body, { status });
}

export const apiErrors = {
  badRequest: (error: string, code: ApiErrorCode = "BAD_REQUEST") =>
    createApiErrorResponse({ status: 400, error, code }),
  unauthorized: (error = "未授权", code: ApiErrorCode = "UNAUTHORIZED") =>
    createApiErrorResponse({ status: 401, error, code }),
  forbidden: (error = "无权限执行此操作", code: ApiErrorCode = "FORBIDDEN") =>
    createApiErrorResponse({ status: 403, error, code }),
  notFound: (error = "未找到资源", code: ApiErrorCode = "RESOURCE_NOT_FOUND") =>
    createApiErrorResponse({ status: 404, error, code }),
  internal: (error = "服务器内部错误", code: ApiErrorCode = "SERVER_ERROR") =>
    createApiErrorResponse({ status: 500, error, code }),
};
