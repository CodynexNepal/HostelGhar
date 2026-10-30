"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateNotifications1803000000000 = void 0;
class CreateNotifications1803000000000 {
    constructor() {
        this.name = 'CreateNotifications1803000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "hostelId" uuid,
        "type" varchar(60) NOT NULL,
        "title" varchar(200) NOT NULL,
        "message" text NOT NULL,
        "entityType" varchar(50) NOT NULL,
        "entityId" varchar(100),
        "targetUrl" varchar(500),
        "metadata" jsonb,
        "isRead" boolean NOT NULL DEFAULT false,
        "readAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_notifications_hostel" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_notifications_user_is_read" ON "notifications" ("userId", "isRead")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_notifications_user_created" ON "notifications" ("userId", "createdAt" DESC)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_notifications_user_entity" ON "notifications" ("userId", "entityType", "isRead")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_notifications_hostel_id" ON "notifications" ("hostelId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_notifications_type" ON "notifications" ("type")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_type"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_hostel_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_user_entity"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_user_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_user_is_read"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    }
}
exports.CreateNotifications1803000000000 = CreateNotifications1803000000000;
