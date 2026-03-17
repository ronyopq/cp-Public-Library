// ============================================================================
// ADMIN ROUTES - API Endpoints for Admin Operations
// src/api/routes/admin.ts
// ============================================================================

import { Hono } from "hono";
import { requireRole, requirePermission, AuthContext } from "../middleware/auth";
import { v4 as uuid } from "uuid";

const admin = new Hono();

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * GET /admin/users
 * List all staff users (admins & librarians)
 */
admin.get(
  "/users",
  requireRole("super_admin", "admin"),
  async (c) => {
    try {
      const user = c.get("user") as AuthContext;
      const db = c.env.DB;

      // Get pagination params
      const page = parseInt(c.req.query("page") || "1");
      const limit = Math.min(parseInt(c.req.query("limit") || "50"), 500);
      const offset = (page - 1) * limit;

      // Count total
      const countResult = await db
        .prepare("SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL")
        .first();
      const total = (countResult as any)?.count || 0;

      // Get users
      const query = `
        SELECT 
          user_id, email, display_name, role_id, status, created_at, updated_at
        FROM users
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      const result = await db
        .prepare(query)
        .bind(limit, offset)
        .all();

      // Enhance with role names
      const users = await Promise.all(
        (result.results as any[]).map(async (user: any) => {
          const role = await db
            .prepare("SELECT name FROM roles WHERE role_id = ?")
            .bind(user.role_id)
            .first();
          return {
            ...user,
            role_name: (role as any)?.name || "unknown",
          };
        })
      );

      return c.json({
        success: true,
        data: users,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Failed to list users:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "ERR_INTERNAL",
            message: "Failed to list users",
          },
        },
        500
      );
    }
  }
);

/**
 * POST /admin/users
 * Create new staff user
 */
admin.post(
  "/users",
  requirePermission("admin:create"),
  async (c) => {
    try {
      const user = c.get("user") as AuthContext;
      const body = await c.req.json<{
        email: string;
        display_name: string;
        password: string;
        role: string;
      }>();

      // Validate input
      if (!body.email || !body.display_name || !body.password || !body.role) {
        return c.json(
          {
            success: false,
            error: {
              code: "ERR_VALIDATION",
              message: "Missing required fields",
            },
          },
          400
        );
      }

      const db = c.env.DB;

      // Check if email already exists
      const existing = await db
        .prepare("SELECT user_id FROM users WHERE email = ?")
        .bind(body.email)
        .first();

      if (existing) {
        return c.json(
          {
            success: false,
            error: {
              code: "ERR_EMAIL_EXISTS",
              message: "Email already in use",
            },
          },
          409
        );
      }

      // Hash password
      const { hashPassword } = await import("../auth/tokens");
      const passwordHash = await hashPassword(body.password);

      // Create user
      const userId = uuid();
      const now = Date.now();

      await db
        .prepare(
          `
        INSERT INTO users (user_id, email, display_name, password_hash, role_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
      `
        )
        .bind(userId, body.email, body.display_name, passwordHash, body.role, now, now)
        .run();

      // Create user profile
      await db
        .prepare(
          `
        INSERT INTO user_profiles (user_profile_id, user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `
        )
        .bind(uuid(), userId, now, now)
        .run();

      // Log audit
      await db
        .prepare(
          `
        INSERT INTO audit_log (audit_id, user_id, action, entity, entity_id, new_values, status, created_at)
        VALUES (?, ?, 'create', 'user', ?, ?, 'success', ?)
      `
        )
        .bind(
          uuid(),
          user.user_id,
          userId,
          JSON.stringify({
            email: body.email,
            display_name: body.display_name,
            role_id: body.role,
          }),
          now
        )
        .run();

      return c.json(
        {
          success: true,
          data: {
            user_id: userId,
            email: body.email,
            display_name: body.display_name,
            status: "active",
            created_at: now,
          },
        },
        201
      );
    } catch (error) {
      console.error("Failed to create user:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "ERR_INTERNAL",
            message: "Failed to create user",
          },
        },
        500
      );
    }
  }
);

/**
 * PATCH /admin/users/:user_id
 * Update staff user
 */
admin.patch(
  "/users/:user_id",
  requirePermission("admin:manage"),
  async (c) => {
    try {
      const user = c.get("user") as AuthContext;
      const userId = c.req.param("user_id");
      const body = await c.req.json<{
        display_name?: string;
        role_id?: string;
        status?: string;
      }>();

      const db = c.env.DB;

      // Get current user
      const current = await db
        .prepare("SELECT * FROM users WHERE user_id = ?")
        .bind(userId)
        .first();

      if (!current) {
        return c.json(
          {
            success: false,
            error: {
              code: "ERR_NOT_FOUND",
              message: "User not found",
            },
          },
          404
        );
      }

      // Prevent modifying same-level or higher users
      const { getRoleHierarchy } = require("../middleware/auth");
      const currentLevel = getRoleHierarchy(user.role);
      const targetLevel = getRoleHierarchy((current as any).role_id);

      if (targetLevel <= currentLevel) {
        return c.json(
          {
            success: false,
            error: {
              code: "ERR_PERMISSION_DENIED",
              message: "Cannot modify same or higher level users",
            },
          },
          403
        );
      }

      // Update user
      const now = Date.now();
      const updates: string[] = [];
      const values: any[] = [];

      if (body.display_name) {
        updates.push("display_name = ?");
        values.push(body.display_name);
      }
      if (body.role_id) {
        updates.push("role_id = ?");
        values.push(body.role_id);
      }
      if (body.status) {
        updates.push("status = ?");
        values.push(body.status);
      }

      if (updates.length === 0) {
        return c.json({
          success: true,
          data: current,
        });
      }

      updates.push("updated_at = ?");
      values.push(now);
      values.push(userId);

      const query = `UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`;
      await db.prepare(query).bind(...values).run();

      // Log audit
      await db
        .prepare(
          `
        INSERT INTO audit_log (audit_id, user_id, action, entity, entity_id, old_values, new_values, status, created_at)
        VALUES (?, ?, 'update', 'user', ?, ?, ?, 'success', ?)
      `
        )
        .bind(
          uuid(),
          user.user_id,
          userId,
          JSON.stringify(current),
          JSON.stringify(body),
          now
        )
        .run();

      const updated = await db
        .prepare("SELECT * FROM users WHERE user_id = ?")
        .bind(userId)
        .first();

      return c.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      console.error("Failed to update user:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "ERR_INTERNAL",
            message: "Failed to update user",
          },
        },
        500
      );
    }
  }
);

/**
 * DELETE /admin/users/:user_id
 * Delete/deactivate user (super admin only)
 */
admin.delete(
  "/users/:user_id",
  requireRole("super_admin"),
  async (c) => {
    try {
      const user = c.get("user") as AuthContext;
      const userId = c.req.param("user_id");
      const db = c.env.DB;

      // Soft delete
      const now = Date.now();
      await db
        .prepare("UPDATE users SET deleted_at = ?, updated_at = ? WHERE user_id = ?")
        .bind(now, now, userId)
        .run();

      // Log audit
      await db
        .prepare(
          `
        INSERT INTO audit_log (audit_id, user_id, action, entity, entity_id, status, created_at)
        VALUES (?, ?, 'delete', 'user', ?, 'success', ?)
      `
        )
        .bind(uuid(), user.user_id, userId, now)
        .run();

      return c.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("Failed to delete user:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "ERR_INTERNAL",
            message: "Failed to delete user",
          },
        },
        500
      );
    }
  }
);

// ============================================================================
// ROLE MANAGEMENT
// ============================================================================

/**
 * GET /admin/roles
 * List all roles
 */
admin.get(
  "/roles",
  requirePermission("settings:read"),
  async (c) => {
    try {
      const db = c.env.DB;

      const result = await db
        .prepare(
          `
        SELECT role_id, name, description, hierarchy_level, status, created_at
        FROM roles
        ORDER BY hierarchy_level ASC
      `
        )
        .all();

      return c.json({
        success: true,
        data: result.results,
      });
    } catch (error) {
      console.error("Failed to list roles:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "ERR_INTERNAL",
            message: "Failed to list roles",
          },
        },
        500
      );
    }
  }
);

/**
 * GET /admin/roles/:role_id/permissions
 * Get permissions for a role
 */
admin.get(
  "/roles/:role_id/permissions",
  requirePermission("settings:read"),
  async (c) => {
    try {
      const roleId = c.req.param("role_id");
      const db = c.env.DB;

      const result = await db
        .prepare(
          `
        SELECT p.permission_id, p.code, p.description, p.category
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.permission_id
        WHERE rp.role_id = ?
        ORDER BY p.category, p.code
      `
        )
        .bind(roleId)
        .all();

      return c.json({
        success: true,
        data: result.results,
      });
    } catch (error) {
      console.error("Failed to fetch role permissions:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "ERR_INTERNAL",
            message: "Failed to fetch role permissions",
          },
        },
        500
      );
    }
  }
);

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

/**
 * GET /admin/settings
 * Get all system settings
 */
admin.get(
  "/settings",
  requirePermission("settings:read"),
  async (c) => {
    try {
      const db = c.env.DB;

      const result = await db
        .prepare(
          `
        SELECT setting_id, key, value, description, type, scope
        FROM settings
        ORDER BY scope, key
      `
        )
        .all();

      return c.json({
        success: true,
        data: result.results,
      });
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "ERR_INTERNAL",
            message: "Failed to fetch settings",
          },
        },
        500
      );
    }
  }
);

/**
 * PATCH /admin/settings/:key
 * Update system setting
 */
admin.patch(
  "/settings/:key",
  requirePermission("settings:update"),
  async (c) => {
    try {
      const user = c.get("user") as AuthContext;
      const key = c.req.param("key");
      const body = await c.req.json<{ value: string }>();

      const db = c.env.DB;

      const now = Date.now();
      await db
        .prepare(
          "UPDATE settings SET value = ?, updated_at = ?, updated_by_user_id = ? WHERE key = ?"
        )
        .bind(body.value, now, user.user_id, key)
        .run();

      // Log audit
      await db
        .prepare(
          `
        INSERT INTO audit_log (audit_id, user_id, action, entity, entity_id, new_values, status, created_at)
        VALUES (?, ?, 'update', 'setting', ?, ?, 'success', ?)
      `
        )
        .bind(
          uuid(),
          user.user_id,
          key,
          JSON.stringify({ key, value: body.value }),
          now
        )
        .run();

      return c.json({
        success: true,
        message: `Setting '${key}' updated`,
      });
    } catch (error) {
      console.error("Failed to update setting:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "ERR_INTERNAL",
            message: "Failed to update setting",
          },
        },
        500
      );
    }
  }
);

// ============================================================================
// AUDIT LOG
// ============================================================================

/**
 * GET /admin/audit-log
 * View audit log with pagination and filtering
 */
admin.get(
  "/audit-log",
  requirePermission("audit:read"),
  async (c) => {
    try {
      const db = c.env.DB;

      const page = parseInt(c.req.query("page") || "1");
      const limit = Math.min(parseInt(c.req.query("limit") || "50"), 500);
      const offset = (page - 1) * limit;
      const action = c.req.query("action");
      const entity = c.req.query("entity");
      const userId = c.req.query("user_id");

      // Build query
      let whereClause = "1=1";
      const params: any[] = [];

      if (action) {
        whereClause += " AND action = ?";
        params.push(action);
      }
      if (entity) {
        whereClause += " AND entity = ?";
        params.push(entity);
      }
      if (userId) {
        whereClause += " AND user_id = ?";
        params.push(userId);
      }

      // Count total
      const countResult = await db
        .prepare(`SELECT COUNT(*) as count FROM audit_log WHERE ${whereClause}`)
        .bind(...params)
        .first();
      const total = (countResult as any)?.count || 0;

      // Get logs
      const logsQuery = `
        SELECT audit_id, user_id, action, entity, entity_id, status, created_at
        FROM audit_log
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      const result = await db
        .prepare(logsQuery)
        .bind(...params, limit, offset)
        .all();

      return c.json({
        success: true,
        data: result.results,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Failed to fetch audit log:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "ERR_INTERNAL",
            message: "Failed to fetch audit log",
          },
        },
        500
      );
    }
  }
);

/**
 * POST /admin/audit-log/export
 * Export audit log as CSV
 */
admin.post(
  "/audit-log/export",
  requirePermission("audit:export"),
  async (c) => {
    try {
      const user = c.get("user") as AuthContext;
      const db = c.env.DB;

      const result = await db
        .prepare(
          `
        SELECT * FROM audit_log
        ORDER BY created_at DESC
        LIMIT 10000
      `
        )
        .all();

      // Convert to CSV
      const headers = [
        "Audit ID",
        "User ID",
        "Action",
        "Entity",
        "Entity ID",
        "Status",
        "Created At",
      ];
      const rows = (result.results as any[]).map((log: any) => [
        log.audit_id,
        log.user_id,
        log.action,
        log.entity,
        log.entity_id,
        log.status,
        new Date(log.created_at).toISOString(),
      ]);

      const csv =
        headers.join(",") +
        "\n" +
        rows.map((row: any[]) => row.map((v: any) => `"${v}"`).join(",")).join("\n");

      return c.text(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=audit-log.csv",
        },
      });
    } catch (error) {
      console.error("Failed to export audit log:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "ERR_INTERNAL",
            message: "Failed to export audit log",
          },
        },
        500
      );
    }
  }
);

export default admin;
