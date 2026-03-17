import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { setupSchema } from '@shared/index'
import type { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { AppLogo } from '@/components/AppLogo'
import { Button } from '@/components/ui/Button'
import { FormField, TextInput } from '@/components/ui/FormField'
import { apiPost, errorMessage } from '@/lib/api'
import { useAuth } from '@/providers/useAuth'

type SetupValues = z.infer<typeof setupSchema>

export function SetupPage() {
  const navigate = useNavigate()
  const { bootstrapRequired, profile, refreshSession } = useAuth()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
  })

  async function onSubmit(values: SetupValues) {
    try {
      await apiPost('/api/public/setup/bootstrap', values)
      await refreshSession()
      navigate('/app', { replace: true })
    } catch (submitError) {
      setError('root', { message: errorMessage(submitError) })
    }
  }

  if (!bootstrapRequired) {
    navigate('/login', { replace: true })
  }

  return (
    <div className="auth-page">
      <section className="auth-page__hero">
        <AppLogo profile={profile} />
        <div className="auth-metric-grid">
          <div className="auth-metric">
            <strong>প্রথম ধাপ</strong>
            <p>সাইট ব্র্যান্ডিং ও প্রথম Super Admin তৈরি করার জন্য এই একবারের সেটআপ।</p>
          </div>
        </div>
      </section>
      <section className="auth-page__content">
        <form className="auth-card form-grid" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <h1>প্রাথমিক সেটআপ</h1>
            <p>লাইব্রেরির নাম, প্রথম অ্যাডমিন এবং সাইন-ইন তথ্য নির্ধারণ করুন।</p>
          </div>
          {errors.root?.message ? <div className="error-banner">{errors.root.message}</div> : null}
          <div className="form-grid form-grid--two">
            <FormField label="লাইব্রেরির নাম (বাংলা)" error={errors.libraryNameBn?.message}>
              <TextInput {...register('libraryNameBn')} />
            </FormField>
            <FormField label="লাইব্রেরির নাম (English)" error={errors.libraryNameEn?.message}>
              <TextInput {...register('libraryNameEn')} />
            </FormField>
          </div>
          <div className="form-grid form-grid--two">
            <FormField label="Super Admin নাম (বাংলা)" error={errors.adminNameBn?.message}>
              <TextInput {...register('adminNameBn')} />
            </FormField>
            <FormField label="Super Admin নাম (English)" error={errors.adminNameEn?.message}>
              <TextInput {...register('adminNameEn')} />
            </FormField>
          </div>
          <div className="form-grid form-grid--two">
            <FormField label="ইমেইল" error={errors.email?.message}>
              <TextInput {...register('email')} />
            </FormField>
            <FormField label="মোবাইল নম্বর" error={errors.phone?.message}>
              <TextInput {...register('phone')} />
            </FormField>
          </div>
          <FormField label="পাসওয়ার্ড" error={errors.password?.message} hint="কমপক্ষে ১২ অক্ষর, বড় হাতের অক্ষর, ছোট হাতের অক্ষর এবং সংখ্যা থাকতে হবে।">
            <TextInput type="password" {...register('password')} />
          </FormField>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'সেটআপ হচ্ছে...' : 'সেটআপ সম্পন্ন করুন'}
          </Button>
        </form>
      </section>
    </div>
  )
}
