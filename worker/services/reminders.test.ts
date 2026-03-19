import { describe, expect, it } from 'vitest'
import { dispatchReminder } from './reminders'

describe('reminder provider abstraction', () => {
  it('falls back to the channel provider when the configured key is unavailable', async () => {
    const result = await dispatchReminder({} as any, {
      channel: 'whatsapp',
      providerKey: 'missing_provider',
      recipient: '01700000000',
      body: 'বই ফেরত দেওয়ার সময় হয়েছে।',
    })

    expect(result.providerReference.startsWith('whatsapp_stub:')).toBe(true)
  })

  it('fails when the recipient address is blank', async () => {
    await expect(
      dispatchReminder({} as any, {
        channel: 'email',
        providerKey: 'email_stub',
        recipient: '   ',
        subject: 'Reminder',
        body: 'Return your book',
      }),
    ).rejects.toThrow('Recipient address is missing')
  })
})
