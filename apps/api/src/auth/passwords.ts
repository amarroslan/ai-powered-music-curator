import bcrypt from "bcryptjs";
import { config } from "../config.js";

/**
 * Password hashing (SPEC.md §7): bcrypt, cost >= 12. bcryptjs is the
 * pure-JS build — no native compilation pain on Windows/serverless.
 */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, config.bcryptRounds);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
