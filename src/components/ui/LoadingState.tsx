export function LoadingState({ label = 'লোড হচ্ছে...' }: { label?: string }) {
  return (
    <div className="state-card">
      <div className="loading-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}
