// scripts/bootstrap-admin.ts

/**
 * Bootstrap script to create the initial Super Admin user.
 * Usage:
 *   npx ts-node scripts/bootstrap-admin.ts <email> <password> <full_name>
 *   
 * Example:
 *   npx ts-node scripts/bootstrap-admin.ts admin@library.bd MyPassword123 "Admin User"
 */

import { hashPassword, generateId } from '../src/api/utils/auth';

const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('Usage: npx ts-node scripts/bootstrap-admin.ts <email> <password> <full_name>');
  console.error('Example: npx ts-node scripts/bootstrap-admin.ts admin@library.bd MyPassword123 "Admin User"');
  process.exit(1);
}

const [email, password, fullName] = args;

// Validate email
if (!email.includes('@')) {
  console.error('❌ Invalid email format');
  process.exit(1);
}

// Validate password
if (password.length < 8) {
  console.error('❌ Password must be at least 8 characters');
  process.exit(1);
}

// Generate hash
hashPassword(password).then((hash) => {
  const adminId = generateId();
  
  const sql = `
INSERT INTO users (id, role_id, email, password_hash, full_name, is_active)
VALUES ('${adminId}', 'role_super_admin', '${email}', '${hash}', '${fullName}', 1);

-- Output the created user
SELECT * FROM users WHERE id = '${adminId}';
  `.trim();

  console.log('✅ SQL to execute:\n');
  console.log(sql);
  console.log('\n📋 Run this in Cloudflare D1:\n');
  console.log(`wrangler d1 execute library --remote --command "${sql}"`);
  console.log('\n💾 Or save to a file and execute:\n');
  console.log(`wrangler d1 execute library --remote --file admin.sql`);
});
