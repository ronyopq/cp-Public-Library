import type { ReminderChannel } from '@shared/index'
import type { AppBindings } from '../types'

interface ReminderDispatchPayload {
  channel: ReminderChannel
  providerKey: string
  recipient: string
  subject?: string | null
  body: string
}

interface ReminderDispatchResult {
  providerReference: string
}

interface ReminderProvider {
  key: string
  supports(channel: ReminderChannel): boolean
  send(
    env: AppBindings,
    payload: ReminderDispatchPayload,
  ): Promise<ReminderDispatchResult>
}

class StubReminderProvider implements ReminderProvider {
  readonly key: string
  private readonly supportedChannel: ReminderChannel

  constructor(key: string, supportedChannel: ReminderChannel) {
    this.key = key
    this.supportedChannel = supportedChannel
  }

  supports(channel: ReminderChannel) {
    return channel === this.supportedChannel
  }

  async send(
    _env: AppBindings,
    payload: ReminderDispatchPayload,
  ): Promise<ReminderDispatchResult> {
    if (!payload.recipient.trim()) {
      throw new Error(`Recipient address is missing for ${payload.channel} delivery.`)
    }

    console.info(`[${this.key}] ${payload.channel} -> ${payload.recipient}`, {
      subject: payload.subject ?? null,
      body: payload.body,
    })

    return {
      providerReference: `${this.key}:${crypto.randomUUID()}`,
    }
  }
}

const providers: ReminderProvider[] = [
  new StubReminderProvider('whatsapp_stub', 'whatsapp'),
  new StubReminderProvider('sms_stub', 'sms'),
  new StubReminderProvider('email_stub', 'email'),
]

export async function dispatchReminder(
  env: AppBindings,
  payload: ReminderDispatchPayload,
): Promise<ReminderDispatchResult> {
  const provider =
    providers.find((item) => item.key === payload.providerKey && item.supports(payload.channel)) ??
    providers.find((item) => item.supports(payload.channel))

  if (!provider) {
    throw new Error(`No provider configured for ${payload.channel} reminders.`)
  }

  return provider.send(env, payload)
}
