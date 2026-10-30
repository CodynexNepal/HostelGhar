import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1803000000000 implements MigrationInterface {
  name = 'CreateNotifications1803000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_notifications_user_is_read" ON "notifications" ("userId", "isRead")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_notifications_user_created" ON "notifications" ("userId", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_notifications_user_entity" ON "notifications" ("userId", "entityType", "isRead")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_notifications_hostel_id" ON "notifications" ("hostelId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_notifications_type" ON "notifications" ("type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_hostel_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_user_entity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_user_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_user_is_read"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
  }
}
