import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeCoordinatesToDoublePrecision1806000000000 implements MigrationInterface {
  name = 'ChangeCoordinatesToDoublePrecision1806000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hostels"
        ALTER COLUMN "latitude" TYPE double precision USING "latitude"::double precision,
        ALTER COLUMN "longitude" TYPE double precision USING "longitude"::double precision;
    `);

    await queryRunner.query(`
      ALTER TABLE "attendances"
        ALTER COLUMN "checkInLatitude" TYPE double precision USING "checkInLatitude"::double precision,
        ALTER COLUMN "checkInLongitude" TYPE double precision USING "checkInLongitude"::double precision,
        ALTER COLUMN "checkOutLatitude" TYPE double precision USING "checkOutLatitude"::double precision,
        ALTER COLUMN "checkOutLongitude" TYPE double precision USING "checkOutLongitude"::double precision;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendances"
        ALTER COLUMN "checkInLatitude" TYPE numeric(10, 7) USING "checkInLatitude"::numeric(10, 7),
        ALTER COLUMN "checkInLongitude" TYPE numeric(10, 7) USING "checkInLongitude"::numeric(10, 7),
        ALTER COLUMN "checkOutLatitude" TYPE numeric(10, 7) USING "checkOutLatitude"::numeric(10, 7),
        ALTER COLUMN "checkOutLongitude" TYPE numeric(10, 7) USING "checkOutLongitude"::numeric(10, 7);
    `);

    await queryRunner.query(`
      ALTER TABLE "hostels"
        ALTER COLUMN "latitude" TYPE numeric(10, 7) USING "latitude"::numeric(10, 7),
        ALTER COLUMN "longitude" TYPE numeric(10, 7) USING "longitude"::numeric(10, 7);
    `);
  }
}
