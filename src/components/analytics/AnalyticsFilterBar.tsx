import type { AnalyticsPreset } from '@shared/index'
import { Button } from '@/components/ui/Button'
import { FormField, SelectInput, TextInput } from '@/components/ui/FormField'
import {
  analyticsMonthOptions,
  type AnalyticsFilterDraft,
} from '@/lib/analytics'

interface AnalyticsFilterBarProps {
  draft: AnalyticsFilterDraft
  onChange: (next: AnalyticsFilterDraft) => void
  onApply: () => void
  onReset: () => void
  busy?: boolean
}

export function AnalyticsFilterBar({
  draft,
  onChange,
  onApply,
  onReset,
  busy = false,
}: AnalyticsFilterBarProps) {
  function update<K extends keyof AnalyticsFilterDraft>(key: K, value: AnalyticsFilterDraft[K]) {
    onChange({
      ...draft,
      [key]: value,
    })
  }

  return (
    <section className="content-card analytics-filter-card">
      <div className="content-card__header">
        <div>
          <h2>সময়ভিত্তিক ফিল্টার</h2>
          <p className="muted">মাস, বছর বা কাস্টম তারিখসীমা বেছে অ্যানালিটিক্স দেখুন।</p>
        </div>
        <div className="page-actions">
          <Button type="button" variant="ghost" onClick={onReset} disabled={busy}>
            রিসেট
          </Button>
          <Button type="button" onClick={onApply} disabled={busy}>
            {busy ? 'লোড হচ্ছে...' : 'প্রয়োগ করুন'}
          </Button>
        </div>
      </div>

      <div className="form-grid form-grid--analytics">
        <FormField label="ফিল্টার ধরন">
          <SelectInput
            value={draft.preset}
            onChange={(event) => update('preset', event.target.value as AnalyticsPreset)}
          >
            <option value="month">মাসভিত্তিক</option>
            <option value="year">বছরভিত্তিক</option>
            <option value="custom">কাস্টম সময়সীমা</option>
          </SelectInput>
        </FormField>

        {draft.preset === 'month' ? (
          <>
            <FormField label="মাস">
              <SelectInput
                value={draft.month}
                onChange={(event) => update('month', event.target.value)}
              >
                {analyticsMonthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="বছর">
              <TextInput
                type="number"
                min="2020"
                max="2100"
                value={draft.year}
                onChange={(event) => update('year', event.target.value)}
              />
            </FormField>
          </>
        ) : null}

        {draft.preset === 'year' ? (
          <FormField label="বছর">
            <TextInput
              type="number"
              min="2020"
              max="2100"
              value={draft.year}
              onChange={(event) => update('year', event.target.value)}
            />
          </FormField>
        ) : null}

        {draft.preset === 'custom' ? (
          <>
            <FormField label="শুরুর তারিখ">
              <TextInput
                type="date"
                value={draft.startDate}
                onChange={(event) => update('startDate', event.target.value)}
              />
            </FormField>
            <FormField label="শেষ তারিখ">
              <TextInput
                type="date"
                value={draft.endDate}
                onChange={(event) => update('endDate', event.target.value)}
              />
            </FormField>
          </>
        ) : null}
      </div>
    </section>
  )
}
