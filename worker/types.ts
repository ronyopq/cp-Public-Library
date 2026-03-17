import type { FeatureFlags, SessionUser } from '@shared/index'

export type TaskMessage =
  | {
      type: 'overdue-reminder'
      loanId: string
      memberId: string
      dueAt: string
    }
  | {
      type: 'circulation-reminder'
      reminderId: string
    }
  | {
      type: 'export-snapshot'
      exportId: string
      tableNames: string[]
      actorId: string
    }

export interface AppBindings {
  DB: D1Database
  APP_CACHE: KVNamespace
  MEDIA_BUCKET: R2Bucket
  TASK_QUEUE: Queue<TaskMessage>
  ACCESSION_COUNTER: DurableObjectNamespace
  ASSETS: Fetcher
  AI?: Ai
  APP_NAME_BN: string
  APP_NAME_EN: string
  APP_TIMEZONE: string
  LIBRARY_CODE: string
  DEFAULT_FINE_PER_DAY: string
  AI_BOOK_INTAKE_MODEL: string
}

export interface AppVariables {
  requestId: string
  sessionUser: SessionUser | null
  sessionId: string | null
  featureFlags: FeatureFlags
}

export interface AppEnv {
  Bindings: AppBindings
  Variables: AppVariables
}
