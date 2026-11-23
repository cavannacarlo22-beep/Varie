import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "av_admin";

function expectedToken() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHmac("sha256", pw).update("auto-villella-admin-v1").digest("hex");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function isAdmin() {
  const token = expectedToken();
  if (!token) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  return Boolean(value && safeEqual(value, token));
}

export async function startSession(password: string) {
  const pw = process.env.ADMIN_PASSWORD;
  const token = expectedToken();
  if (!pw || !token || !safeEqual(password, pw)) return false;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return true;
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export const adminConfigured = () => Boolean(process.env.ADMIN_PASSWORD);
