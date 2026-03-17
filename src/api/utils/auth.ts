// src/api/utils/auth.ts

import { hash, compare } from 'bcryptjs';
import * as jose from 'jose';

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash);
}

export async function generateAccessToken(
  payload: { userId: string; email: string; role_id: string },
  secret: string
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const token = await new jose.SignJWT({ ...payload, iat, exp: iat + JWT_EXPIRY })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode(secret));
  
  return token;
}

export async function generateRefreshToken(
  userId: string,
  secret: string
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const token = await new jose.SignJWT({ userId, iat, exp: iat + REFRESH_TOKEN_EXPIRY })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode(secret));
  
  return token;
}

export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<{ userId: string; email: string; role_id: string } | null> {
  try {
    const payload = await jose.jwtVerify(token, new TextEncoder().encode(secret));
    return payload.payload as any;
  } catch (err) {
    return null;
  }
}

export function generateId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateMembershipNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `M${year}${random}`;
}

export function generateAccessionNumber(year: number): string {
  const yy = year.toString().slice(-2);
  const seq = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `${yy}-${seq}`;
}
