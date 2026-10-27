import 'reflect-metadata';
import { AppDataSource } from './src/database/database-source';

async function main() {
  try {
    await AppDataSource.initialize();
    const result = await AppDataSource.query(
      `SELECT id, email, "firstName", "lastName", role, "passwordResetExpiresAt" FROM "users" LIMIT 10`,
    );
    console.log('Users in DB (users table):', result);
    await AppDataSource.destroy();
  } catch (err: any) {
    console.log('Error querying "users", trying "user":', err.message);
    try {
      const result2 = await AppDataSource.query(
        `SELECT id, email, "firstName", "lastName", role, "passwordResetExpiresAt" FROM "user" LIMIT 10`,
      );
      console.log('Users in DB (user table):', result2);
      await AppDataSource.destroy();
    } catch (err2: any) {
      console.error('Raw query error:', err2.message);
    }
  }
}

main();
