import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { featureFlagSchema, shellSettingsSchema, type AppRole, type FeatureFlags } from '@shared/index'
import type { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { CheckboxInput, FormField, SelectInput, TextAreaInput, TextInput } from '@/components/ui/FormField'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiPut, apiRequest, errorMessage, mediaUrl } from '@/lib/api'

type ShellSettingsValues = z.infer<typeof shellSettingsSchema>

interface SettingsPayload {
  settings: ShellSettingsValues
  featureFlags: FeatureFlags
}

const roleOptions: AppRole[] = ['librarian', 'officer', 'manager', 'admin', 'super_admin']

export function SettingsPage() {
  const queryClient = useQueryClient()
  const [assetError, setAssetError] = useState<string | null>(null)
  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => apiRequest<SettingsPayload>('/api/admin/settings'),
  })

  const shellForm = useForm<ShellSettingsValues>({
    resolver: zodResolver(shellSettingsSchema) as any,
  })
  const flagsForm = useForm<FeatureFlags>({
    resolver: zodResolver(featureFlagSchema) as any,
  })

  const socialLinks = useFieldArray({
    control: shellForm.control,
    name: 'socialLinks',
  })

  useEffect(() => {
    if (settingsQuery.data) {
      shellForm.reset(settingsQuery.data.settings)
      flagsForm.reset(settingsQuery.data.featureFlags)
    }
  }, [settingsQuery.data, shellForm, flagsForm])

  const saveShellMutation = useMutation({
    mutationFn: (values: ShellSettingsValues) => apiPut('/api/admin/settings/shell', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
    },
  })

  const saveFlagsMutation = useMutation({
    mutationFn: (values: FeatureFlags) => apiPut('/api/admin/settings/flags', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
    },
  })

  async function uploadAsset(fieldName: 'logo' | 'favicon', file: File) {
    setAssetError(null)
    try {
      const formData = new FormData()
      formData.append(fieldName, file)
      const response = await fetch('/api/admin/settings/assets', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? 'Upload failed')
      }

      shellForm.setValue(
        fieldName === 'logo' ? 'profile.logoKey' : 'profile.faviconKey',
        payload.data[fieldName] ?? null,
        { shouldDirty: true },
      )
    } catch (uploadError) {
      setAssetError(errorMessage(uploadError))
    }
  }

  if (settingsQuery.isLoading) {
    return <LoadingState label="সাইট সেটিংস লোড হচ্ছে..." />
  }

  const data = settingsQuery.data
  if (!data) {
    return <EmptyState title="সেটিংস পাওয়া যায়নি" description="পরে আবার চেষ্টা করুন।" />
  }

  return (
    <div className="page-stack">
      <div className="page-header content-card">
        <h1>সাইট ও অ্যাডমিন কনফিগারেশন</h1>
        <p>সাইট নাম, লোগো, favicon, metadata, social links, menu order, widget visibility এবং public feature toggles নিয়ন্ত্রণ করুন।</p>
      </div>

      {assetError ? <div className="error-banner">{assetError}</div> : null}

      <form
        className="page-stack"
        onSubmit={shellForm.handleSubmit(async (values) => {
          try {
            await saveShellMutation.mutateAsync(values as ShellSettingsValues)
          } catch (submitError) {
            shellForm.setError('root', { message: errorMessage(submitError) })
          }
        })}
      >
        {shellForm.formState.errors.root?.message ? (
          <div className="error-banner">{shellForm.formState.errors.root.message}</div>
        ) : null}

        <section className="split-grid">
          <div className="content-card section-grid">
            <h2>সাইট পরিচিতি</h2>
            <div className="form-grid form-grid--two">
              <FormField label="সাইটের নাম (বাংলা)">
                <TextInput {...shellForm.register('profile.siteNameBn')} />
              </FormField>
              <FormField label="সাইটের নাম (English)">
                <TextInput {...shellForm.register('profile.siteNameEn')} />
              </FormField>
            </div>
            <div className="form-grid form-grid--two">
              <FormField label="ট্যাগলাইন (বাংলা)">
                <TextInput {...shellForm.register('profile.taglineBn')} />
              </FormField>
              <FormField label="ট্যাগলাইন (English)">
                <TextInput {...shellForm.register('profile.taglineEn')} />
              </FormField>
            </div>
          </div>

          <div className="content-card section-grid">
            <h2>ব্র্যান্ড অ্যাসেট</h2>
            <div className="asset-preview">
              {shellForm.watch('profile.logoKey') ? (
                <img src={mediaUrl(shellForm.watch('profile.logoKey')) ?? ''} alt="" />
              ) : (
                <p className="muted">লোগো আপলোড করা হয়নি</p>
              )}
              <TextInput
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void uploadAsset('logo', file)
                  }
                }}
              />
            </div>
            <div className="asset-preview">
              {shellForm.watch('profile.faviconKey') ? (
                <img src={mediaUrl(shellForm.watch('profile.faviconKey')) ?? ''} alt="" />
              ) : (
                <p className="muted">favicon আপলোড করা হয়নি</p>
              )}
              <TextInput
                type="file"
                accept="image/png,image/svg+xml,image/x-icon"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void uploadAsset('favicon', file)
                  }
                }}
              />
            </div>
          </div>
        </section>

        <section className="content-card section-grid">
          <h2>Metadata</h2>
          <div className="form-grid form-grid--two">
            <FormField label="Meta title (বাংলা)">
              <TextInput {...shellForm.register('metadata.metaTitleBn')} />
            </FormField>
            <FormField label="Meta title (English)">
              <TextInput {...shellForm.register('metadata.metaTitleEn')} />
            </FormField>
          </div>
          <div className="form-grid form-grid--two">
            <FormField label="Meta description (বাংলা)">
              <TextAreaInput {...shellForm.register('metadata.metaDescriptionBn')} />
            </FormField>
            <FormField label="Meta description (English)">
              <TextAreaInput {...shellForm.register('metadata.metaDescriptionEn')} />
            </FormField>
          </div>
          <FormField label="Canonical URL">
            <TextInput placeholder="https://library.example.org" {...shellForm.register('metadata.canonicalUrl')} />
          </FormField>
        </section>

        <section className="content-card section-grid">
          <div className="content-card__header">
            <div>
              <h2>Social Links</h2>
              <p className="muted">পাবলিক ল্যান্ডিং অংশে দেখানোর জন্য।</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                socialLinks.append({
                  id: `link-${Date.now()}`,
                  label: '',
                  url: 'https://',
                })
              }
            >
              লিংক যোগ
            </Button>
          </div>
          {socialLinks.fields.map((field, index) => (
            <div className="form-grid form-grid--two" key={field.id}>
              <FormField label="লেবেল">
                <TextInput {...shellForm.register(`socialLinks.${index}.label`)} />
              </FormField>
              <FormField label="URL">
                <TextInput {...shellForm.register(`socialLinks.${index}.url`)} />
              </FormField>
              <div className="inline-actions">
                <Button type="button" variant="ghost" onClick={() => socialLinks.remove(index)}>
                  মুছুন
                </Button>
              </div>
            </div>
          ))}
        </section>

        <section className="split-grid">
          <div className="content-card section-grid">
            <h2>Menu Order ও Visibility</h2>
            {(shellForm.watch('menuConfig') ?? []).map((item, index) => (
              <div className="form-grid form-grid--two" key={item.key}>
                <CheckboxInput
                  label={item.key}
                  checked={shellForm.watch(`menuConfig.${index}.enabled`)}
                  onChange={(event) =>
                    shellForm.setValue(`menuConfig.${index}.enabled`, event.target.checked, { shouldDirty: true })
                  }
                />
                <FormField label="ক্রম">
                  <TextInput
                    type="number"
                    value={shellForm.watch(`menuConfig.${index}.order`)}
                    onChange={(event) =>
                      shellForm.setValue(`menuConfig.${index}.order`, Number(event.target.value), { shouldDirty: true })
                    }
                  />
                </FormField>
              </div>
            ))}
          </div>

          <div className="content-card section-grid">
            <h2>Dashboard Widget Visibility</h2>
            {(shellForm.watch('dashboardWidgets') ?? []).map((widget, index) => (
              <div className="form-grid form-grid--two" key={widget.key}>
                <CheckboxInput
                  label={widget.key}
                  checked={shellForm.watch(`dashboardWidgets.${index}.enabled`)}
                  onChange={(event) =>
                    shellForm.setValue(`dashboardWidgets.${index}.enabled`, event.target.checked, { shouldDirty: true })
                  }
                />
                <FormField label="ন্যূনতম রোল">
                  <SelectInput
                    value={shellForm.watch(`dashboardWidgets.${index}.minRole`)}
                    onChange={(event) =>
                      shellForm.setValue(`dashboardWidgets.${index}.minRole`, event.target.value as AppRole, { shouldDirty: true })
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
              </div>
            ))}
          </div>
        </section>

        <div className="page-actions">
          <Button type="submit" disabled={saveShellMutation.isPending}>
            {saveShellMutation.isPending ? 'সংরক্ষণ হচ্ছে...' : 'সাইট সেটিংস সংরক্ষণ'}
          </Button>
        </div>
      </form>

      <form
        className="content-card section-grid"
        onSubmit={flagsForm.handleSubmit(async (values) => {
          try {
            await saveFlagsMutation.mutateAsync(values as FeatureFlags)
          } catch (submitError) {
            flagsForm.setError('root', { message: errorMessage(submitError) })
          }
        })}
      >
        <h2>Feature Toggles</h2>
        {flagsForm.formState.errors.root?.message ? (
          <div className="error-banner">{flagsForm.formState.errors.root.message}</div>
        ) : null}
        {Object.entries(flagsForm.watch()).map(([key, value]) => (
          <CheckboxInput
            key={key}
            label={key}
            checked={Boolean(value)}
            onChange={(event) =>
              flagsForm.setValue(key as keyof FeatureFlags, event.target.checked, { shouldDirty: true })
            }
          />
        ))}
        <div className="page-actions">
          <Button type="submit" disabled={saveFlagsMutation.isPending}>
            {saveFlagsMutation.isPending ? 'সংরক্ষণ হচ্ছে...' : 'ফিচার টগল সংরক্ষণ'}
          </Button>
        </div>
      </form>
    </div>
  )
}
