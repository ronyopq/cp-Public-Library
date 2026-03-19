import { describe, expect, it } from 'vitest'
import type { AccountingReceiptDetail, AccountingReportPayload } from '@shared/index'
import { buildReceiptHtml, buildReportCsv, generateReceiptNo } from './accounts'

function makeReceipt(): AccountingReceiptDetail {
  return {
    id: 'receipt-1',
    receiptNo: 'CPL-MR-2026-ABC123',
    paymentId: 'payment-1',
    memberId: 'member-1',
    memberCode: 'M-1001',
    memberNameBn: 'রনি "আলম"',
    paymentMethodCode: 'cash',
    paymentMethodNameBn: 'নগদ',
    feeTypeNameBn: 'মাসিক চাঁদা',
    totalAmount: 300,
    paidAt: '2026-03-19T10:30:00.000Z',
    note: 'মার্চ ২০২৬',
    items: [
      {
        labelBn: 'মাসিক চাঁদা',
        labelEn: 'Monthly subscription',
        quantity: 1,
        amount: 300,
        month: '2026-03',
        note: 'নিয়মিত সংগ্রহ',
      },
    ],
    collectedByNameBn: 'ম্যানেজার',
    fileKey: null,
    fileUrl: null,
    reprintCount: 0,
    lastReprintedAt: null,
  }
}

function makeReport(): AccountingReportPayload {
  return {
    filters: {
      preset: 'monthly',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      feeTypeId: '',
      paymentMethodCode: '',
      memberId: '',
    },
    summary: {
      totalCollected: 300,
      transactionCount: 1,
      outstandingDues: 50,
      advanceBalances: 0,
    },
    feeBreakdown: [],
    paymentMethodBreakdown: [],
    dailyBreakdown: [],
    memberBalances: [],
    cashLedger: [],
    incomeLedger: [],
    payments: [
      {
        id: 'payment-1',
        memberId: 'member-1',
        memberCode: 'M-1001',
        memberNameBn: 'রনি "আলম"',
        feeTypeCode: 'monthly_subscription',
        feeTypeNameBn: 'মাসিক চাঁদা',
        paymentMethodCode: 'cash',
        paymentMethodNameBn: 'নগদ',
        amount: 300,
        paidAt: '2026-03-19T10:30:00.000Z',
        status: 'completed',
        receiptId: 'receipt-1',
        receiptNo: 'CPL-MR-2026-ABC123',
        referenceNo: 'REF-01',
        note: 'মাসিক চাঁদা',
        isVoided: false,
        voidedAt: null,
        canVoid: true,
      },
    ],
    generatedAt: '2026-03-19T10:30:00.000Z',
  }
}

describe('accounting receipt and report helpers', () => {
  it('generates receipt numbers with the expected prefix and year', () => {
    expect(generateReceiptNo('CPL')).toMatch(/^CPL-MR-\d{4}-[A-Z0-9]{6}$/)
  })

  it('builds printable receipt HTML for historical reprints', () => {
    const html = buildReceiptHtml('কমিউনিটি লাইব্রেরি', makeReceipt())

    expect(html).toContain('window.print()')
    expect(html).toContain('কমিউনিটি লাইব্রেরি')
    expect(html).toContain('CPL-MR-2026-ABC123')
    expect(html).toContain('রনি &quot;আলম&quot;')
  })

  it('exports accounting payments as CSV that Excel-compatible tools can open', () => {
    const csv = buildReportCsv(makeReport())

    expect(csv).toContain('"Report","Accounting Report"')
    expect(csv).toContain('"M-1001"')
    expect(csv).toContain('"রনি ""আলম"""')
    expect(csv).toContain('"300.00"')
  })
})
