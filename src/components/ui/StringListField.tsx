import { useState } from 'react'
import { Button } from './Button'
import { TextInput } from './FormField'

export function StringListField({
  label,
  values,
  placeholder,
  onChange,
}: {
  label: string
  values: string[]
  placeholder?: string
  onChange: (values: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function addDraftValue() {
    const nextValue = draft.trim()
    if (!nextValue) {
      return
    }

    onChange([...new Set([...values, nextValue])])
    setDraft('')
  }

  return (
    <div className="string-list-field">
      <div className="content-card__header">
        <strong>{label}</strong>
        <span className="muted">{values.length}টি</span>
      </div>

      {values.length > 0 ? (
        <div className="string-chip-list">
          {values.map((value) => (
            <button
              key={value}
              className="string-chip"
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              <span>{value}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">এখনও কিছু যোগ করা হয়নি।</p>
      )}

      <div className="inline-actions">
        <TextInput
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              addDraftValue()
            }
          }}
        />
        <Button type="button" variant="ghost" onClick={addDraftValue}>
          যোগ করুন
        </Button>
      </div>
    </div>
  )
}
