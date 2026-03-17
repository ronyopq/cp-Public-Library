import type { MemberProfileDetail } from '@shared/index'
import { toBanglaCurrency, toDhakaDisplay } from '@shared/index'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { MemberCardPreview } from './MemberCardPreview'

export function MemberProfilePanel({
  profile,
  showNotes = false,
  cardTemplateName,
  actions,
}: {
  profile: MemberProfileDetail
  showNotes?: boolean
  cardTemplateName?: string | null
  actions?: React.ReactNode
}) {
  return (
    <div className="page-stack">
      <section className="split-grid split-grid--member">
        <div className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>{profile.member.fullNameBn}</h2>
              <p className="muted">
                {profile.member.memberCode} • {profile.member.phone}
              </p>
            </div>
            <Badge
              tone={profile.member.memberStatus === 'active' ? 'success' : 'warning'}
            >
              {profile.member.memberStatus}
            </Badge>
          </div>

          <div className="member-summary-grid">
            <div className="shell-card">
              <p className="muted">চলমান ইস্যু</p>
              <strong>{profile.currentBorrowedBooks.length}</strong>
            </div>
            <div className="shell-card">
              <p className="muted">মোট ধার ইতিহাস</p>
              <strong>{profile.borrowingHistory.length}</strong>
            </div>
            <div className="shell-card">
              <p className="muted">বকেয়া জরিমানা</p>
              <strong>{toBanglaCurrency(profile.dues.outstandingAmount)}</strong>
            </div>
            <div className="shell-card">
              <p className="muted">মোট পরিশোধ</p>
              <strong>{toBanglaCurrency(profile.paymentSummary.totalPaidAmount)}</strong>
            </div>
          </div>

          <div className="member-identity-grid">
            <div>
              <span className="muted">ঠিকানা</span>
              <strong>
                {[profile.member.addressLine, profile.member.area, profile.member.district]
                  .filter(Boolean)
                  .join(', ') || 'উল্লেখ নেই'}
              </strong>
            </div>
            <div>
              <span className="muted">যোগদানের তারিখ</span>
              <strong>{toDhakaDisplay(profile.member.joinedAt)}</strong>
            </div>
            <div>
              <span className="muted">মেয়াদ</span>
              <strong>
                {profile.member.membershipExpiresAt
                  ? toDhakaDisplay(profile.member.membershipExpiresAt)
                  : 'নির্ধারিত নয়'}
              </strong>
            </div>
            <div>
              <span className="muted">সর্বশেষ পেমেন্ট</span>
              <strong>
                {profile.paymentSummary.lastPaidAt
                  ? toDhakaDisplay(profile.paymentSummary.lastPaidAt)
                  : 'এখনও নেই'}
              </strong>
            </div>
          </div>

          {showNotes && profile.member.notes ? (
            <div className="warning-banner">{profile.member.notes}</div>
          ) : null}

          {actions}
        </div>

        <div className="content-card section-grid">
          <h2>আইডি কার্ড প্রিভিউ</h2>
          <MemberCardPreview member={profile.member} templateName={cardTemplateName} />
        </div>
      </section>

      <section className="content-card section-grid">
        <div className="content-card__header">
          <div>
            <h2>বর্তমান ধার নেওয়া বই</h2>
            <p className="muted">যেসব কপি এখনো ফেরত আসেনি।</p>
          </div>
        </div>
        <DataTable
          items={profile.currentBorrowedBooks}
          empty={
            <EmptyState
              title="বর্তমানে কোনো ধার নেওয়া বই নেই"
              description="নতুন ইস্যু হলে এখানে দেখা যাবে।"
            />
          }
          columns={[
            {
              key: 'book',
              header: 'বই',
              render: (item) => (
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted">{item.authors.join(', ') || 'লেখক অজানা'}</p>
                </div>
              ),
            },
            {
              key: 'copy',
              header: 'কপি',
              render: (item) => (
                <div>
                  <strong>{item.accessionCode}</strong>
                  <p className="muted">কপি #{item.copyNumber}</p>
                </div>
              ),
            },
            {
              key: 'dates',
              header: 'সময়',
              render: (item) => (
                <div>
                  <p className="muted">ইস্যু: {toDhakaDisplay(item.issuedAt)}</p>
                  <p className="muted">ফেরত: {toDhakaDisplay(item.dueAt)}</p>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'স্ট্যাটাস',
              render: (item) => (
                <Badge tone={item.status === 'overdue' ? 'danger' : 'info'}>{item.status}</Badge>
              ),
            },
          ]}
        />
      </section>

      <section className="content-card section-grid">
        <div className="content-card__header">
          <div>
            <h2>ধার নেওয়ার ইতিহাস</h2>
            <p className="muted">সদস্যের সাম্প্রতিক ধার নেওয়ার রেকর্ড।</p>
          </div>
        </div>
        <DataTable
          items={profile.borrowingHistory}
          empty={<EmptyState title="ইতিহাস পাওয়া যায়নি" description="এখনও কোনো ধার রেকর্ড নেই।" />}
          columns={[
            {
              key: 'title',
              header: 'বই',
              render: (item) => (
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted">{item.accessionCode}</p>
                </div>
              ),
            },
            {
              key: 'issuedAt',
              header: 'ইস্যুর সময়',
              render: (item) => toDhakaDisplay(item.issuedAt),
            },
            {
              key: 'dueAt',
              header: 'ফেরতের সময়',
              render: (item) => toDhakaDisplay(item.dueAt),
            },
            {
              key: 'status',
              header: 'স্ট্যাটাস',
              render: (item) => <Badge tone="info">{item.status}</Badge>,
            },
          ]}
        />
      </section>

      <section className="content-card section-grid">
        <div className="content-card__header">
          <div>
            <h2>ফেরত ইতিহাস</h2>
            <p className="muted">যেসব বই সদস্য ফেরত দিয়েছেন।</p>
          </div>
        </div>
        <DataTable
          items={profile.returnHistory}
          empty={
            <EmptyState title="ফেরত ইতিহাস নেই" description="ফেরত সম্পন্ন হলে এখানে দেখা যাবে।" />
          }
          columns={[
            {
              key: 'title',
              header: 'বই',
              render: (item) => (
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted">{item.accessionCode}</p>
                </div>
              ),
            },
            {
              key: 'returnedAt',
              header: 'ফেরতের সময়',
              render: (item) => toDhakaDisplay(item.returnedAt),
            },
            {
              key: 'fine',
              header: 'জরিমানা',
              render: (item) => (
                <span>{toBanglaCurrency(Math.max(item.fineAccrued - item.finePaid, 0))}</span>
              ),
            },
          ]}
        />
      </section>

      <section className="split-grid split-grid--member">
        <div className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>দেনা ও জরিমানা</h2>
              <p className="muted">খোলা জরিমানা এবং সমন্বয়ের সারসংক্ষেপ।</p>
            </div>
          </div>
          <div className="member-summary-grid">
            <div className="shell-card">
              <p className="muted">মোট ধার্য</p>
              <strong>{toBanglaCurrency(profile.dues.assessedAmount)}</strong>
            </div>
            <div className="shell-card">
              <p className="muted">পরিশোধিত</p>
              <strong>{toBanglaCurrency(profile.dues.paidAmount)}</strong>
            </div>
            <div className="shell-card">
              <p className="muted">মওকুফ</p>
              <strong>{toBanglaCurrency(profile.dues.waivedAmount)}</strong>
            </div>
            <div className="shell-card">
              <p className="muted">খোলা জরিমানা</p>
              <strong>{profile.dues.openFineCount}</strong>
            </div>
          </div>
        </div>

        <div className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>পেমেন্ট সারসংক্ষেপ</h2>
              <p className="muted">সাম্প্রতিক পরিশোধ এবং মোট সংগ্রহ।</p>
            </div>
          </div>
          <div className="member-summary-grid">
            <div className="shell-card">
              <p className="muted">মোট পরিশোধ</p>
              <strong>{toBanglaCurrency(profile.paymentSummary.totalPaidAmount)}</strong>
            </div>
            <div className="shell-card">
              <p className="muted">পেমেন্ট সংখ্যা</p>
              <strong>{profile.paymentSummary.paymentCount}</strong>
            </div>
          </div>
          <DataTable
            items={profile.recentPayments}
            empty={
              <EmptyState title="পেমেন্ট পাওয়া যায়নি" description="এখনও কোনো পেমেন্ট রেকর্ড নেই।" />
            }
            columns={[
              {
                key: 'type',
                header: 'পেমেন্ট',
                render: (item) => (
                  <div>
                    <strong>{item.paymentTypeName}</strong>
                    <p className="muted">{item.paymentTypeCode}</p>
                  </div>
                ),
              },
              {
                key: 'amount',
                header: 'পরিমাণ',
                render: (item) => toBanglaCurrency(item.amount),
              },
              {
                key: 'paidAt',
                header: 'সময়',
                render: (item) => toDhakaDisplay(item.paidAt),
              },
              {
                key: 'status',
                header: 'স্ট্যাটাস',
                render: (item) => (
                  <Badge tone={item.status === 'completed' ? 'success' : 'warning'}>
                    {item.status}
                  </Badge>
                ),
              },
            ]}
          />
        </div>
      </section>
    </div>
  )
}
