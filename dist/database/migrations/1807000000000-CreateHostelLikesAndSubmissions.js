"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateHostelLikesAndSubmissions1807000000000 = void 0;
class CreateHostelLikesAndSubmissions1807000000000 {
    constructor() {
        this.name = 'CreateHostelLikesAndSubmissions1807000000000';
    }
    async up(queryRunner) {
        // 1. hostel_likes table
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hostel_likes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hostelId" uuid NOT NULL,
        "userId" uuid,
        "clientIdentifier" character varying(128) NOT NULL,
        "ipAddress" character varying(64),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hostel_likes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hostel_likes_hostel" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hostel_likes_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_hostel_likes_hostel_id" ON "hostel_likes" ("hostelId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_hostel_likes_user_id" ON "hostel_likes" ("userId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_hostel_likes_client_id" ON "hostel_likes" ("clientIdentifier")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_hostel_likes_hostel_client" ON "hostel_likes" ("hostelId", "clientIdentifier")`);
        // 2. contact_submissions table
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contact_submissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(150) NOT NULL,
        "email" character varying(255) NOT NULL,
        "phone" character varying(50),
        "subject" character varying(255),
        "message" text NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "ipAddress" character varying(64),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contact_submissions" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_contact_submissions_email" ON "contact_submissions" ("email")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_contact_submissions_status" ON "contact_submissions" ("status")`);
        // 3. hostel_listing_requests table
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hostel_listing_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hostelName" character varying(200) NOT NULL,
        "type" character varying(50) NOT NULL DEFAULT 'coed',
        "totalBeds" integer NOT NULL DEFAULT 0,
        "phone" character varying(50) NOT NULL,
        "city" character varying(100) NOT NULL,
        "area" character varying(150),
        "address" text NOT NULL,
        "priceFrom" numeric(10,2),
        "negotiable" boolean NOT NULL DEFAULT false,
        "amenities" text[] NOT NULL DEFAULT '{}',
        "description" text,
        "rules" text,
        "photos" text[] NOT NULL DEFAULT '{}',
        "ownerName" character varying(150) NOT NULL,
        "email" character varying(255) NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "adminNotes" text,
        "ipAddress" character varying(64),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hostel_listing_requests" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_listing_requests_email" ON "hostel_listing_requests" ("email")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_listing_requests_phone" ON "hostel_listing_requests" ("phone")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_listing_requests_status" ON "hostel_listing_requests" ("status")`);
        // 4. newsletter_subscriptions table
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "newsletter_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'ACTIVE',
        "source" character varying(100) DEFAULT 'footer',
        "ipAddress" character varying(64),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_newsletter_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_newsletter_subscriptions_email" UNIQUE ("email")
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_newsletter_email" ON "newsletter_subscriptions" ("email")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_newsletter_email"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "newsletter_subscriptions"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_listing_requests_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_listing_requests_phone"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_listing_requests_email"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "hostel_listing_requests"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_contact_submissions_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_contact_submissions_email"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "contact_submissions"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_hostel_likes_hostel_client"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_hostel_likes_client_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_hostel_likes_user_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_hostel_likes_hostel_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "hostel_likes"`);
    }
}
exports.CreateHostelLikesAndSubmissions1807000000000 = CreateHostelLikesAndSubmissions1807000000000;
