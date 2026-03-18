import type {
  ACCOUNTING_COLLECTION_MODES,
  ACCOUNTING_FEE_CODES,
  ACCOUNTING_REPORT_PRESETS,
  MEMBER_DUE_STATUSES,
} from './constants'
import type { LookupOption, Member, PaymentTypeOption } from './domain'

export type AccountingFeeCode = (typeof ACCOUNTING_FEE_CODES)[number]
export type AccountingCollectionMode = (typeof ACCOUNTING_COLLECTION_MODES)[number]
export type MemberDueStatus = (typeof MEMBER_DUE_STATUSES)[number]
export type AccountingReportPreset = (typeof ACCOUNTING_REPORT_PRESETS)[number]

export interface FeeTypeDefinition {
  id: string
  feeCode: string
  baseCode?: string | null
  nameBn: string
  nameEn: string
  descriptionBn?: string | null
  descriptionEn?: string | null
  collectionMode: AccountingCollectionMode
  defaultAmount: number
  allowCustomAmount: boolean
  allowMultiMonth: boolean
  incomeAccountId?: string | null
  incomeAccountCode?: string | null
  incomeAccountNameBn?: string | null
  active: boolean
  isSystem: boolean
  sortOrder: number
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface DueMonthOption {
  month: string
  labelBn: string
  labelEn: string
  expectedAmount: number
  paidAmount: number
  waivedAmount: number
  outstandingAmount: number
  isAdvance: boolean
  status: MemberDueStatus
}

export interface MemberDueLine {
  id: string
  memberId: string
  feeTypeId: string
  feeTypeCode: string
  feeTypeNameBn: string
  month: string
  dueDate?: string | null
  expectedAmount: number
  paidAmount: number
  waivedAmount: number
  outstandingAmount: number
  isAdvance: boolean
  status: MemberDueStatus
  note?: string | null
  updatedAt: string
}

export interface AccountingPaymentRecord {
  id: string
  memberId?: string | null
  memberCode?: string | null
  memberNameBn?: string | null
  feeTypeCode?: string | null
  feeTypeNameBn: string
  paymentMethodCode: string
  paymentMethodNameBn: string
  amount: number
  paidAt: string
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  receiptId?: string | null
  receiptNo?: string | null
  referenceNo?: string | null
  note?: string | null
  isVoided: boolean
  voidedAt?: string | null
  canVoid: boolean
}

export interface AccountingReceiptItem {
  labelBn: string
  labelEn: string
  amount: number
  quantity: number
  month?: string | null
  note?: string | null
}

export interface AccountingReceiptDetail {
  id: string
  receiptNo: string
  paymentId: string
  memberId?: string | null
  memberCode?: string | null
  memberNameBn?: string | null
  paymentMethodCode: string
  paymentMethodNameBn: string
  feeTypeNameBn: string
  totalAmount: number
  paidAt: string
  note?: string | null
  items: AccountingReceiptItem[]
  collectedByNameBn?: string | null
  fileKey?: string | null
  fileUrl?: string | null
  reprintCount: number
  lastReprintedAt?: string | null
}

export interface MemberLedgerSummary {
  totalAssessed: number
  totalPaid: number
  totalWaived: number
  outstanding: number
  advanceBalance: number
}

export interface MemberLedgerEntry {
  id: string
  entryDate: string
  accountCode: string
  accountNameBn: string
  direction: 'debit' | 'credit'
  amount: number
  referenceType?: string | null
  narration?: string | null
}

export interface AccountingMemberLedgerPayload {
  member: Member
  summary: MemberLedgerSummary
  dueLines: MemberDueLine[]
  dueMonthOptions: Record<string, DueMonthOption[]>
  payments: AccountingPaymentRecord[]
  receipts: AccountingReceiptDetail[]
  ledgerEntries: MemberLedgerEntry[]
}

export interface AccountingStats {
  todayCollections: number
  monthCollections: number
  yearCollections: number
  outstandingDues: number
  advanceBalances: number
  openReceipts: number
}

export interface AccountingDashboardPayload {
  stats: AccountingStats
  feeTypes: FeeTypeDefinition[]
  paymentMethods: PaymentTypeOption[]
  recentPayments: AccountingPaymentRecord[]
  memberLookupHints: LookupOption[]
}

export interface AccountingCollectionResult {
  payment: AccountingPaymentRecord
  receipt: AccountingReceiptDetail
  ledgerSummary: MemberLedgerSummary | null
}

export interface AccountingReportFilters {
  preset: AccountingReportPreset
  startDate: string
  endDate: string
  feeTypeId?: string | null
  paymentMethodCode?: string | null
  memberId?: string | null
}

export interface AccountingReportBreakdown {
  key: string
  labelBn: string
  totalAmount: number
  transactionCount: number
}

export interface AccountingBalanceRow {
  memberId: string
  memberCode: string
  memberNameBn: string
  outstandingAmount: number
  advanceAmount: number
}

export interface AccountingCashLedgerRow {
  accountCode: string
  accountNameBn: string
  debitTotal: number
  creditTotal: number
}

export interface AccountingReportPayload {
  filters: AccountingReportFilters
  summary: {
    totalCollected: number
    transactionCount: number
    outstandingDues: number
    advanceBalances: number
  }
  feeBreakdown: AccountingReportBreakdown[]
  paymentMethodBreakdown: AccountingReportBreakdown[]
  dailyBreakdown: Array<{ day: string; totalAmount: number }>
  memberBalances: AccountingBalanceRow[]
  cashLedger: AccountingCashLedgerRow[]
  incomeLedger: AccountingCashLedgerRow[]
  payments: AccountingPaymentRecord[]
  generatedAt: string
}

export interface AccountingExportResult {
  exportId: string
  fileName: string
  outputKey: string
  outputUrl: string
  format: 'csv' | 'html'
}
