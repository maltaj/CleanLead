import "server-only";
import { createHmac } from "node:crypto";
import { getServerEnv } from "@/lib/env.server";

/** Client address as set by the hosting proxy (Vercel overwrites x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** Keyed hash so raw addresses are never stored and hashes can't be reversed without the secret. */
export function hashIp(ip: string): string {
  return createHmac("sha256", getServerEnv().ENQUIRY_IP_HASH_SECRET).update(ip).digest("hex");
}
