import type { Member } from '@shared/index'
import { Badge } from '@/components/ui/Badge'
import { mediaUrl } from '@/lib/api'

export function MemberCardPreview({
  member,
  templateName,
}: {
  member: Member
  templateName?: string | null
}) {
  return (
    <article className="member-card-preview">
      <div className="member-card-preview__header">
        <div>
          <p className="member-card-preview__eyebrow">সদস্য পরিচয়পত্র</p>
          <h3>{member.fullNameBn}</h3>
          <p className="muted">{member.memberCode}</p>
        </div>
        <Badge tone={member.memberStatus === 'active' ? 'success' : 'warning'}>
          {member.memberStatus}
        </Badge>
      </div>

      <div className="member-card-preview__body">
        <div className="member-card-preview__photo">
          {member.photoKey ? (
            <img src={mediaUrl(member.photoKey) ?? ''} alt={member.fullNameBn} />
          ) : (
            <span>{member.fullNameBn.slice(0, 2)}</span>
          )}
        </div>

        <div className="member-card-preview__meta">
          <div>
            <span>মোবাইল</span>
            <strong>{member.phone}</strong>
          </div>
          <div>
            <span>যোগদান</span>
            <strong>{member.joinedAt.slice(0, 10)}</strong>
          </div>
          <div>
            <span>মেয়াদ</span>
            <strong>{member.membershipExpiresAt || 'নির্ধারিত নয়'}</strong>
          </div>
        </div>
      </div>

      <div className="member-card-preview__footer">
        <span>{templateName || 'ডিফল্ট সদস্য কার্ড টেমপ্লেট'}</span>
        <small>Print ready</small>
      </div>
    </article>
  )
}
