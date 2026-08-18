// ──────────────────────────────────────────────────────────────────────────────
// FILE: password-hasher.util.ts
// PURPOSE: Provides a production-grade password hashing abstraction using
//          bcrypt. This class is the ONLY place in the entire application
//          that touches password hashing — if we ever migrate from bcrypt
//          to argon2, we change ONE file.
//
// WHY BCRYPT?
//   1. Deliberately slow — each hash takes ~250ms with 12 rounds, making
//      brute-force attacks computationally infeasible (billions of years).
//   2. Adaptive cost factor — you can increase rounds as hardware improves.
//   3. Built-in salt — the salt is embedded in the hash string, so you
//      never need to store or manage salts separately.
//   4. Resistant to GPU/ASIC acceleration — bcrypt's memory-access pattern
//      makes it hard to parallelize on specialized hardware.
//   5. Battle-tested — used by GitHub, Dropbox, and virtually every
//      security-conscious application for 25+ years.
//
// OOP PRINCIPLES:
//   • Encapsulation — bcrypt internals (salt rounds, algorithm) are hidden.
//   • Single Responsibility — this class ONLY hashes and compares passwords.
//   • Static methods — no instance state needed; prevents accidental
//     instantiation of a utility class.
// ──────────────────────────────────────────────────────────────────────────────

// Import bcrypt — the gold-standard password hashing library.
// We import individual functions (`hash`, `compare`) for clarity.
import bcrypt from 'bcrypt';
import { dotEnvConfig } from '../configs/envConfig';

// ─── PasswordHasher Class ───────────────────────────────────────────────────

export class PasswordHasher {
  // ─── Salt Rounds Configuration ────────────────────────────────────────

  // Loaded securely from environment variables via dotEnvConfig:
  // `private static readonly` ensures this value cannot be accessed or modified
  // outside this class.
  private static readonly SALT_ROUNDS = parseInt(dotEnvConfig.SALT_ROUNDS);

  // ─── Private Constructor ──────────────────────────────────────────────

  // A private constructor prevents external code from writing
  // `new PasswordHasher()` — this class is a collection of static utility
  // methods, not an object you instantiate. This pattern is called
  // a "static utility class" and is common in Java/C# as well.
  private constructor() {
    // Intentionally empty — this constructor exists solely to be private.
  }

  // ─── hash() ───────────────────────────────────────────────────────────

  // Takes a plaintext password and returns its bcrypt hash.
  // The returned string looks like:
  //   $2b$12$LJ3m4ys3Sz.W8aAqN0PKq.v5AvRVv0XTp5hJk8QK5F.GvE3CLxFhW
  //   ^^^^ ^^ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //   algo rounds         22-char salt + 31-char hash (base64)
  //
  // The salt is automatically generated and embedded in the output string,
  // so we never need to store the salt separately.
  public static async hash(plainTextPassword: string): Promise<string> {
    // `bcrypt.hash()` generates a random salt, then computes the hash.
    // The `SALT_ROUNDS` parameter controls the cost factor (2^12 iterations).
    // This is an async operation because hashing is CPU-intensive — running
    // it asynchronously prevents blocking the Node.js event loop and
    // keeping the server responsive to other requests.
    const hashedPassword: string = await bcrypt.hash(plainTextPassword, PasswordHasher.SALT_ROUNDS);

    // Return the hash string to be stored in the database.
    return hashedPassword;
  }

  // ─── compare() ────────────────────────────────────────────────────────

  // Compares a plaintext password against a stored bcrypt hash.
  // Returns `true` if they match, `false` otherwise.
  //
  // SECURITY NOTE: bcrypt.compare() is timing-safe — it always takes the
  // same amount of time regardless of whether the password is correct.
  // This prevents timing attacks where an attacker measures response time
  // to determine how many characters of the password are correct.
  public static async compare(plainTextPassword: string, hashedPassword: string): Promise<boolean> {
    // `bcrypt.compare()` extracts the salt from the stored hash, re-hashes
    // the plaintext with that salt, and compares the result byte-by-byte.
    // This is why we don't need to store the salt separately.
    const isMatch: boolean = await bcrypt.compare(plainTextPassword, hashedPassword);

    // Return the boolean result — the caller (LoginService) decides what
    // to do with it (throw 401, proceed to token generation, etc.).
    return isMatch;
  }
}
