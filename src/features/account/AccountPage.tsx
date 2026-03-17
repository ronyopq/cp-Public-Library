import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { changePasswordSchema, type MemberProfileDetail } from '@shared/index'
import type { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField, TextInput } from '@/components/ui/FormField'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiPost, apiRequest, errorMessage } from '@/lib/api'
import { useAuth } from '@/providers/useAuth'
import { MemberProfilePanel } from '@/features/members/MemberProfilePanel'

type ChangePasswordValues = z.infer<typeof changePasswordSchema>

export function AccountPage() {
  const { user, refreshSession } = useAuth()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
  })

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordValues) => apiPost('/api/auth/change-password', values),
    onSuccess: async () => {
      reset()
      await refreshSession()
    },
  })

  const memberProfileQuery = useQuery({
    queryKey: ['self-member-profile'],
    enabled: Boolean(
      user?.permissions.includes('members.self_service') ||
        user?.permissions.includes('loans.view_own'),
    ),
    queryFn: async () => {
      const result = await apiRequest<{ profile: MemberProfileDetail | null }>(
        '/api/app/members/self/profile',
      )
      return result.profile
    },
  })

  async function onSubmit(values: ChangePasswordValues) {
    try {
      await mutation.mutateAsync(values)
    } catch (submitError) {
      setError('root', { message: errorMessage(submitError) })
    }
  }

  return (
    <div className="page-stack">
      <div className="page-header content-card">
        <h1>আমার একাউন্ট</h1>
        <p>নিরাপদ সাইন-ইন বজায় রাখতে এখানে পাসওয়ার্ড পরিবর্তন করুন।</p>
      </div>

      {user?.mustChangePassword ? (
        <div className="warning-banner">
          এই সেশনে কাজ চালিয়ে যাওয়ার আগে আপনাকে পাসওয়ার্ড পরিবর্তন করতে হবে।
        </div>
      ) : null}

      <form className="content-card form-grid" onSubmit={handleSubmit(onSubmit)}>
        {errors.root?.message ? <div className="error-banner">{errors.root.message}</div> : null}
        {mutation.isSuccess ? (
          <div className="warning-banner">পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে।</div>
        ) : null}
        <FormField label="বর্তমান পাসওয়ার্ড" error={errors.currentPassword?.message}>
          <TextInput type="password" {...register('currentPassword')} />
        </FormField>
        <FormField label="নতুন পাসওয়ার্ড" error={errors.newPassword?.message}>
          <TextInput type="password" {...register('newPassword')} />
        </FormField>
        <FormField
          label="নতুন পাসওয়ার্ড নিশ্চিত করুন"
          error={errors.confirmPassword?.message}
        >
          <TextInput type="password" {...register('confirmPassword')} />
        </FormField>
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {isSubmitting || mutation.isPending
            ? 'সংরক্ষণ হচ্ছে...'
            : 'পাসওয়ার্ড পরিবর্তন করুন'}
        </Button>
      </form>

      {memberProfileQuery.isLoading ? (
        <LoadingState label="সদস্য প্রোফাইল লোড হচ্ছে..." />
      ) : null}

      {memberProfileQuery.isError ? (
        <EmptyState
          title="সদস্য প্রোফাইল পাওয়া যায়নি"
          description={errorMessage(memberProfileQuery.error)}
        />
      ) : null}

      {memberProfileQuery.data ? (
        <MemberProfilePanel profile={memberProfileQuery.data} cardTemplateName="আমার সদস্য কার্ড" />
      ) : null}
    </div>
  )
}
