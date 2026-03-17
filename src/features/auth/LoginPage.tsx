import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema } from '@shared/index'
import type { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { AppLogo } from '@/components/AppLogo'
import { Button } from '@/components/ui/Button'
import { FormField, TextInput } from '@/components/ui/FormField'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/providers/useAuth'

type LoginValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const { login, profile, error } = useAuth()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(values: LoginValues) {
    try {
      await login(values)
      navigate('/app', { replace: true })
    } catch (submitError) {
      setError('root', { message: errorMessage(submitError) })
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-page__hero">
        <AppLogo profile={profile} />
        <div className="auth-metric-grid">
          <div className="auth-metric">
            <strong>ক্লাউডফ্লেয়ার-নেটিভ</strong>
            <p>Workers, D1, KV, R2, Queue এবং Durable Object ভিত্তিক স্থাপনা।</p>
          </div>
          <div className="auth-metric">
            <strong>বাংলা-প্রথম অভিজ্ঞতা</strong>
            <p>ডেস্কটপ ও মোবাইল উভয় প্ল্যাটফর্মের জন্য রেসপনসিভ প্রশাসনিক ইন্টারফেস।</p>
          </div>
        </div>
      </section>

      <section className="auth-page__content">
        <form className="auth-card form-grid" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <h1>সাইন ইন</h1>
            <p>লাইব্রেরি ব্যবস্থাপনা সিস্টেমে প্রবেশ করতে আপনার তথ্য দিন।</p>
          </div>
          {error ? <div className="warning-banner">{error}</div> : null}
          {errors.root?.message ? <div className="error-banner">{errors.root.message}</div> : null}
          <FormField label="ইমেইল" error={errors.email?.message}>
            <TextInput placeholder="admin@library.org" {...register('email')} />
          </FormField>
          <FormField label="পাসওয়ার্ড" error={errors.password?.message}>
            <TextInput type="password" placeholder="••••••••••••" {...register('password')} />
          </FormField>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'সাইন ইন হচ্ছে...' : 'সাইন ইন করুন'}
          </Button>
          <p className="muted">পাসওয়ার্ড ভুলে গেলে অ্যাডমিন বা সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
        </form>
      </section>
    </div>
  )
}
