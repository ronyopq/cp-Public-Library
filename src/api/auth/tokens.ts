// ============================================================================
// AUTHENTICATION & JWT SYSTEM
// src/api/auth/tokens.ts
// ============================================================================

import { SignJWT, jwtVerify } from "jose";
import * as bcrypt from "bcryptjs";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-key-change-in-production-12345"
);

const REFRESH_SECRET = new TextEncoder().encode(
  process.env.REFRESH_SECRET || "dev-refresh-secret-change-in-production-12345"
);

// ============================================================================
// PASSWORD HASHING
// ============================================================================

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================================================
// JWT TOKEN GENERATION
// ============================================================================

export interface JWTPayload {
  sub: string; // user_id or member_id
  email: string;
  role: string;
  type: "user" | "member";
  iat?: number;
  exp?: number;
}

export async function generateAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

export async function generateRefreshToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(REFRESH_SECRET);
}

// ============================================================================
// JWT VERIFICATION
// ============================================================================

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as JWTPayload;
  } catch (error) {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<JWTPayload | null> {
  try {
    const verified = await jwtVerify(token, REFRESH_SECRET);
    return verified.payload as JWTPayload;
  } catch (error) {
    return null;
  }
}

// ============================================================================
// TOKEN EXTRACTION FROM HEADER
// ============================================================================

export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

// ============================================================================
// TOKEN VALIDATION TYPES
// ============================================================================

export interface TokenValidationResult {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
}

export async function validateAccessToken(
  authHeader: string | null
): Promise<TokenValidationResult> {
  const token = extractToken(authHeader);
  if (!token) {
    return { valid: false, error: "No token provided" };
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return { valid: false, error: "Invalid or expired token" };
  }

  return { valid: true, payload };
}

// ============================================================================
// CREDENTIAL VALIDATION (Not used in production - implement via DB)
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    user_id: string;
    email: string;
    role: string;
    type: "user" | "member";
    accessToken: string;
    refreshToken: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// TOKEN BLACKLIST (Stored in KV for logout support)
// ============================================================================

export async function blacklistToken(
  env: any,
  token: string,
  expiresIn: number = 86400 // 24h default
): Promise<void> {
  const namespace = env.TOKEN_BLACKLIST || env.KV_NAMESPACE;
  await namespace.put(`blacklist:${token}`, "1", { expirationTtl: expiresIn });
}

export async function isTokenBlacklisted(env: any, token: string): Promise<boolean> {
  const namespace = env.TOKEN_BLACKLIST || env.KV_NAMESPACE;
  const result = await namespace.get(`blacklist:${token}`);
  return result !== null;
}

// ============================================================================
// SESSION MANAGEMENT (KV-backed)
// ============================================================================

export interface Session {
  user_id: string;
  email: string;
  role: string;
  ip_address: string;
  user_agent: string;
  created_at: number;
  last_activity: number;
  expires_at: number;
}

export async function createSession(
  env: any,
  session: Session
): Promise<void> {
  const namespace = env.KV_NAMESPACE;
  const key = `session:${session.user_id}:${Date.now()}`;
  const ttl = Math.floor((session.expires_at - Date.now()) / 1000);
  await namespace.put(key, JSON.stringify(session), { expirationTtl: ttl });
}

export async function getSession(env: any, sessionKey: string): Promise<Session | null> {
  const namespace = env.KV_NAMESPACE;
  const data = await namespace.get(sessionKey);
  if (!data) return null;
  return JSON.parse(data) as Session;
}

export async function destroySession(env: any, sessionKey: string): Promise<void> {
  const namespace = env.KV_NAMESPACE;
  await namespace.delete(sessionKey);
}

// ============================================================================
// RATE LIMITING (KV-backed per IP)
// ============================================================================

export async function checkRateLimit(
  env: any,
  ipAddress: string,
  limit: number = 100,
  windowSeconds: number = 3600
): Promise<boolean> {
  const namespace = env.KV_NAMESPACE;
  const key = `ratelimit:${ipAddress}`;

  const current = await namespace.get(key);
  const count = current ? parseInt(current) + 1 : 1;

  if (count > limit) {
    return false; // Rate limit exceeded
  }

  await namespace.put(key, count.toString(), { expirationTtl: windowSeconds });
  return true; // Within limit
}

// ============================================================================
// PASSWORD VALIDATION
// ============================================================================

export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) errors.push("Password must be at least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("Password must contain capital letter");
  if (!/[a-z]/.test(password)) errors.push("Password must contain lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Password must contain number");

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// ============================================================================
// PHONE VALIDATION
// ============================================================================

export function validatePhoneNumber(phone: string): boolean {
  // Bangladesh format: +880XXXXXXXXXX or 01XXXXXXXXX
  const bdPhoneRegex = /^(\+880|0)[1-9]\d{8,9}$/;
  return bdPhoneRegex.test(phone.replace(/[\s\-()]/g, ""));
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: {
    code: "ERR_INVALID_CREDENTIALS",
    message: "Invalid email or password",
  },
  TOKEN_EXPIRED: {
    code: "ERR_TOKEN_EXPIRED",
    message: "Token has expired",
  },
  INVALID_TOKEN: {
    code: "ERR_INVALID_TOKEN",
    message: "Invalid token",
  },
  NO_TOKEN: {
    code: "ERR_NO_TOKEN",
    message: "Authorization token required",
  },
  PERMISSION_DENIED: {
    code: "ERR_PERMISSION_DENIED",
    message: "Insufficient permissions",
  },
  ACCOUNT_SUSPENDED: {
    code: "ERR_ACCOUNT_SUSPENDED",
    message: "Account is suspended",
  },
  INVALID_PASSWORD: {
    code: "ERR_INVALID_PASSWORD",
    message: "Password does not meet requirements",
  },
  EMAIL_EXISTS: {
    code: "ERR_EMAIL_EXISTS",
    message: "Email already registered",
  },
  PHONE_EXISTS: {
    code: "ERR_PHONE_EXISTS",
    message: "Phone number already registered",
  },
};

export const TOKEN_TYPES = {
  ACCESS: "access",
  REFRESH: "refresh",
  RESET: "reset",
};
