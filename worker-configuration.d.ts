declare module '*.svg' {
  const source: string
  export default source
}

declare module '*.png' {
  const source: string
  export default source
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ success: boolean; meta?: Record<string, unknown> }>
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>
  exec(query: string): Promise<{ count: number; duration: number }>
  dump(): Promise<ArrayBuffer>
}

interface KVNamespace {
  get(key: string, type: 'text'): Promise<string | null>
  get<T = unknown>(key: string, type: 'json'): Promise<T | null>
  get(key: string): Promise<string | null>
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>
  delete(key: string): Promise<void>
}

interface R2HTTPMetadata {
  contentType?: string
  contentDisposition?: string
  contentLanguage?: string
  contentEncoding?: string
  cacheControl?: string
}

interface R2Object {
  key: string
  size: number
  uploaded?: Date
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: {
      httpMetadata?: R2HTTPMetadata
      customMetadata?: Record<string, string>
    },
  ): Promise<R2Object | null>
  delete(key: string): Promise<void>
}

interface Queue<T = unknown> {
  send(message: T): Promise<void>
}

interface QueueMessage<T = unknown> {
  id: string
  body: T
  attempts: number
  ack(): void
  retry(): void
}

interface MessageBatch<T = unknown> {
  messages: QueueMessage<T>[]
}

interface DurableObjectId {}

interface DurableObjectStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId
  get(id: DurableObjectId): DurableObjectStub
}

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>
  put<T = unknown>(key: string, value: T): Promise<void>
}

interface DurableObjectState {
  storage: DurableObjectStorage
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

interface ScheduledController {
  scheduledTime: number
  cron: string
  noRetry(): void
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

interface Ai {
  run<T = unknown>(model: string, input: Record<string, unknown>): Promise<T>
}

interface ExportedHandler<Env = unknown, QueueMessageBody = unknown> {
  fetch?: (
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ) => Response | Promise<Response>
  scheduled?: (
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) => void | Promise<void>
  queue?: (
    batch: MessageBatch<QueueMessageBody>,
    env: Env,
    ctx: ExecutionContext,
  ) => void | Promise<void>
}
