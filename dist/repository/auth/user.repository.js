"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: user.repository.ts
// PURPOSE: Encapsulates ALL database queries related to the User entity.
//          No other layer (controller, service) should write raw TypeORM
//          queries — they go through this repository instead.
//
// OOP PRINCIPLES:
//   • Single Responsibility — this class ONLY handles User data access.
//   • Encapsulation — the TypeORM Repository internals are hidden behind
//     clean, domain-specific method signatures.
//   • Dependency Injection — the class receives nothing from outside;
//     it fetches the repository from the DataSource singleton. This can
//     be refactored to constructor injection for testing.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
// Import the DataSource so we can derive entity-specific repositories.
const database_source_1 = require("../../database/database-source");
// Import the User entity — TypeORM uses this to know which table to query.
const user_entity_1 = require("../../entities/user.entity");
const enum_constant_1 = require("../../constant/enum.constant");
// ─── UserRepository Class ───────────────────────────────────────────────────
class UserRepository {
    // The constructor initializes the TypeORM repository for the User entity.
    // `AppDataSource.getRepository(User)` returns a fully-configured
    // repository that knows the table name, columns, and relations.
    constructor() {
        this.repository = database_source_1.AppDataSource.getRepository(user_entity_1.User);
    }
    // ─── findByEmail ────────────────────────────────────────────────────────
    // Looks up a user by their email address. Returns `null` if not found.
    // This is the most critical query in the auth flow — it's called on
    // EVERY login and registration attempt to check for existing accounts.
    // The `unique` index on `email` in the entity ensures O(1) lookup.
    async findByEmail(email) {
        const normalized = email.trim().toLowerCase();
        return this.repository
            .createQueryBuilder('user')
            .where('LOWER(user.email) = :email', { email: normalized })
            .getOne();
    }
    async findOwnerByEmail(email) {
        const normalized = email.trim().toLowerCase();
        return this.repository
            .createQueryBuilder('user')
            .where('LOWER(user.email) = :email', { email: normalized })
            .andWhere('user.role = :role', { role: enum_constant_1.IROLES.OWNER })
            .getOne();
    }
    // ─── findById ───────────────────────────────────────────────────────────
    // Looks up a user by their UUID primary key. Used by token verification
    // middleware to load the authenticated user from the token's `sub` claim.
    async findById(id) {
        return this.repository.findOne({ where: { id } });
    }
    // ─── createUser ─────────────────────────────────────────────────────────
    // Inserts a new user record into the database. Accepts a partial User
    // object (at minimum: email, password hash, firstName, lastName).
    // `Partial<User>` means not all fields are required — TypeORM fills in
    // defaults (id, role, timestamps) automatically.
    //
    // Returns the full User object including the auto-generated UUID and
    // timestamps, which the service layer needs for token generation.
    async createUser(userData) {
        // `this.repository.create()` instantiates a User entity in memory
        // WITHOUT hitting the database — it just maps the plain object to
        // the entity class so TypeORM can track it.
        const user = this.repository.create(userData);
        // `this.repository.save()` performs the actual INSERT query and
        // returns the persisted entity with all auto-generated fields filled.
        return this.repository.save(user);
    }
    async updateAvatar(userId, avatarUrl, avatarPublicId) {
        await this.repository.update(userId, { avatarUrl, avatarPublicId });
    }
    // ─── updateRefreshToken ─────────────────────────────────────────────────
    // Updates the stored (hashed) refresh token for a given user.
    // Called on every login/token-refresh to rotate the refresh token.
    // Passing `null` clears the token — used on logout to invalidate it.
    //
    // `update()` is used instead of `save()` because we only need to modify
    // one column — `update()` generates a targeted UPDATE query without
    // loading the full entity, which is faster and uses less memory.
    async updateRefreshToken(userId, hashedRefreshToken) {
        await this.repository.update(userId, { refreshToken: hashedRefreshToken });
    }
    async updatePassword(userId, hashedPassword) {
        await this.repository.update(userId, {
            password: hashedPassword,
            refreshToken: null,
            passwordResetToken: null,
            passwordResetExpiresAt: null,
        });
    }
    async setPasswordResetToken(userId, tokenHash, expiresAt) {
        await this.repository.update(userId, {
            passwordResetToken: tokenHash,
            passwordResetExpiresAt: expiresAt,
        });
    }
    async findByPasswordResetToken(tokenHash) {
        return this.repository.findOne({ where: { passwordResetToken: tokenHash } });
    }
}
exports.UserRepository = UserRepository;
