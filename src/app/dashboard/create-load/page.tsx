import React from "react";
import { getAuthToken } from "@/src/utils/auth";

type HeadersDict = HeadersInit;
const bearerHeaders = (token?: string | null): HeadersDict => {
  const h: Record<string, string> = { Accept: "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

async function readJson<T = unknown>(
  res: Response
): Promise<T | string | null> {
  const t = await res.text();
  try {
    return t ? (JSON.parse(t) as T) : null;
  } catch {
    return t;
  }
}
const pickMsg = (j: any, fb: string) =>
  j?.message || j?.detail || j?.title || fb;

export default function CreateLoad() {
    const token = React.useMemo(getAuthToken, []);
    const headers = React.useMemo<HeadersDict>(() => bearerHeaders(token), [token]);
}