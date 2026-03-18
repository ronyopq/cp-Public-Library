import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { PublicQrResolution } from '@shared/index'
import { useQuery } from '@tanstack/react-query'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiRequest, errorMessage } from '@/lib/api'

export function PublicQrPage() {
  const navigate = useNavigate()
  const { shortCode } = useParams<{ shortCode: string }>()
  const query = useQuery({
    queryKey: ['public-qr', shortCode],
    enabled: Boolean(shortCode),
    queryFn: () => apiRequest<PublicQrResolution>(`/api/public/qr/${shortCode}`),
  })

  useEffect(() => {
    if (query.data) {
      navigate(query.data.destinationPath, { replace: true })
    }
  }, [navigate, query.data])

  if (query.isLoading) {
    return <LoadingState label="QR লিংক যাচাই করা হচ্ছে..." />
  }

  if (!query.data) {
    return <EmptyState title="QR লিংক কাজ করছে না" description={errorMessage(query.error)} />
  }

  return <LoadingState label="সঠিক পাতায় নেওয়া হচ্ছে..." />
}
