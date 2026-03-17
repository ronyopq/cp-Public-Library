import type { SessionUser } from '@shared/index'
import { dhakaNow } from '@shared/utils'
import { dbRun } from './db'

export async function writeAudit(
  db: D1Database,
  actor: SessionUser | null,
  actionKey: string,
  entityType: string,
  entityId: string,
  note: string,
  options: {
    before?: unknown
    after?: unknown
    requestId?: string | null
    ipAddress?: string | null
    userAgent?: string | null
  } = {},
) {
  await dbRun(
    db,
    `
      INSERT INTO audit_logs (
        id,
        actor_user_id,
        actor_role_key,
        actor_display_name,
        action_key,
        entity_type,
        entity_id,
        request_id,
        ip_address,
        user_agent,
        before_json,
        after_json,
        note,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      crypto.randomUUID(),
      actor?.id ?? null,
      actor?.role ?? null,
      actor?.nameBn ?? 'System',
      actionKey,
      entityType,
      entityId,
      options.requestId ?? null,
      options.ipAddress ?? null,
      options.userAgent ?? null,
      options.before ? JSON.stringify(options.before) : null,
      options.after ? JSON.stringify(options.after) : null,
      note,
      dhakaNow(),
    ],
  )
}
