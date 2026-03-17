// src/api/utils/db.ts

import type { D1Database } from '@cloudflare/workers-types';

export interface QueryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class Database {
  constructor(private db: D1Database) {}

  async query<T>(sql: string, params?: any[]): Promise<T | null> {
    try {
      const stmt = this.db.prepare(sql);
      const result = params ? stmt.bind(...params).first<T>() : stmt.first<T>();
      return result;
    } catch (err) {
      console.error('Database query error:', err);
      return null;
    }
  }

  async queryAll<T>(sql: string, params?: any[]): Promise<T[]> {
    try {
      const stmt = this.db.prepare(sql);
      const result = params ? stmt.bind(...params).all<T>() : stmt.all<T>();
      return result.results || [];
    } catch (err) {
      console.error('Database query error:', err);
      return [];
    }
  }

  async execute(sql: string, params?: any[]): Promise<boolean> {
    try {
      const stmt = this.db.prepare(sql);
      params ? stmt.bind(...params).run() : stmt.run();
      return true;
    } catch (err) {
      console.error('Database execute error:', err);
      return false;
    }
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T | null> {
    try {
      await this.execute('BEGIN TRANSACTION');
      const result = await callback();
      await this.execute('COMMIT');
      return result;
    } catch (err) {
      await this.execute('ROLLBACK');
      console.error('Transaction error:', err);
      return null;
    }
  }
}

export function getUserById(db: Database, userId: string) {
  return db.query(
    'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL',
    [userId]
  );
}

export function getUserByEmail(db: Database, email: string) {
  return db.query(
    'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL',
    [email]
  );
}

export function createUser(
  db: Database,
  id: string,
  email: string,
  passwordHash: string,
  fullName: string,
  roleId: string,
  phone?: string
) {
  return db.execute(
    `INSERT INTO users (id, email, password_hash, full_name, phone, role_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, email, passwordHash, fullName, phone || null, roleId]
  );
}

export function getUserRole(db: Database, roleId: string) {
  return db.query('SELECT * FROM roles WHERE id = ?', [roleId]);
}

export function getRolePermissions(db: Database, roleId: string) {
  return db.queryAll(
    `SELECT p.* FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     WHERE rp.role_id = ?`,
    [roleId]
  );
}

export function logAuditEvent(
  db: Database,
  id: string,
  userId: string | null,
  action: string,
  resourceType: string,
  resourceId: string,
  status: 'SUCCESS' | 'FAILED' = 'SUCCESS',
  errorMessage?: string
) {
  return db.execute(
    `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, userId || null, action, resourceType, resourceId, status, errorMessage || null]
  );
}

export function recordLoginAttempt(
  db: Database,
  userId: string,
  success: boolean
) {
  if (success) {
    return db.execute(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0 WHERE id = ?',
      [userId]
    );
  } else {
    return db.execute(
      `UPDATE users SET failed_login_attempts = failed_login_attempts + 1,
       locked_until = CASE WHEN failed_login_attempts >= 9 
                           THEN datetime(CURRENT_TIMESTAMP, '+15 minutes')
                           ELSE locked_until END
       WHERE id = ?`,
      [userId]
    );
  }
}

export function isUserLocked(user: any): boolean {
  if (!user.locked_until) return false;
  const lockUntil = new Date(user.locked_until);
  return lockUntil > new Date();
}
