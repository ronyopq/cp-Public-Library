import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { changePasswordSchema } from '@shared/index'
import type { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { FormField, TextInput } from '@/components/ui/FormField'
import { apiPost, errorMessage } from '@/lib/api'
import { useAuth } from '@/providers/useAuth'

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
    mutationFn: (values: ChangePasswordValues) =>
      apiPost('/api/auth/change-password', values),
    onSuccess: async () => {
      reset()
      await refreshSession()
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
        <div className="warning-banner">এই সেশনের আগে আপনাকে পাসওয়ার্ড পরিবর্তন করতে হবে।</div>
      ) : null}

      <form className="content-card form-grid" onSubmit={handleSubmit(onSubmit)}>
        {errors.root?.message ? <div className="error-banner">{errors.root.message}</div> : null}
        {mutation.isSuccess ? <div className="warning-banner">পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে।</div> : null}
        <FormField label="বর্তমান পাসওয়ার্ড" error={errors.currentPassword?.message}>
          <TextInput type="password" {...register('currentPassword')} />
        </FormField>
        <FormField label="নতুন পাসওয়ার্ড" error={errors.newPassword?.message}>
          <TextInput type="password" {...register('newPassword')} />
        </FormField>
        <FormField label="নতুন পাসওয়ার্ড নিশ্চিত করুন" error={errors.confirmPassword?.message}>
          <TextInput type="password" {...register('confirmPassword')} />
        </FormField>
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {isSubmitting || mutation.isPending ? 'সংরক্ষণ হচ্ছে...' : 'পাসওয়ার্ড পরিবর্তন করুন'}
        </Button>
      </form>
    </div>
  )
}
