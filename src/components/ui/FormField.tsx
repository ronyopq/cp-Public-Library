import clsx from 'clsx'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      {children}
      {hint ? <span className="form-field__hint">{hint}</span> : null}
      {error ? <span className="form-field__error">{error}</span> : null}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx('ui-input', props.className)} {...props} />
}

export function TextAreaInput(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('ui-input ui-textarea', props.className)} {...props} />
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx('ui-input', props.className)} {...props} />
}

export function CheckboxInput(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string },
) {
  return (
    <label className="checkbox-field">
      <input type="checkbox" {...props} />
      <span>{props.label}</span>
    </label>
  )
}
