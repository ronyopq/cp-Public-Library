interface NextAccessionRequest {
  count: number
  prefix: string
}

export class AccessionCounter {
  private readonly state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method !== 'POST' || url.pathname !== '/next') {
      return new Response('Not found', { status: 404 })
    }

    const body = (await request.json()) as NextAccessionRequest
    const count = Math.max(1, Math.min(100, Number(body.count ?? 1)))
    const prefix = String(body.prefix ?? 'CPL')

    const codes = await this.state.blockConcurrencyWhile(async () => {
      const current = (await this.state.storage.get<number>('sequence')) ?? 0
      const next = current + count
      await this.state.storage.put('sequence', next)

      return Array.from({ length: count }, (_, index) => {
        const numeric = current + index + 1
        return {
          accessionCode: `${prefix}-${String(numeric).padStart(6, '0')}`,
          accessionSequence: numeric,
        }
      })
    })

    return Response.json({ codes })
  }
}
