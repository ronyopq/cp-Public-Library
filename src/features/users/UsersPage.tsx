import { useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  adminResetPasswordSchema,
  type ManagedUser,
  type PermissionKey,
  type RoleRecord,
  userCreateSchema,
  userEditSchema,
} from '@shared/index'
import type { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { CheckboxInput, FormField, SelectInput, TextInput } from '@/components/ui/FormField'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { useLocalStorageState } from '@/hooks/useLocalStorageState'
import { apiPatch, apiPost, apiRequest, errorMessage } from '@/lib/api'

type UserCreateValues = z.infer<typeof userCreateSchema>
type UserEditValues = z.infer<typeof userEditSchema>
type ResetPasswordValues = z.infer<typeof adminResetPasswordSchema>

interface UserListingPayload {
  items: ManagedUser[]
  page: number
  pageSize: number
  total: number
}

interface RolesPayload {
  roles: RoleRecord[]
  permissions: Array<{ id: string; permissionKey: PermissionKey; moduleName: string }>
}

function StatusBadge({ status }: { status: ManagedUser['status'] }) {
  const tone =
    status === 'active' ? 'success' : status === 'suspended' ? 'warning' : 'danger'
  return <Badge tone={tone}>{status}</Badge>
}

function errorText(message: unknown) {
  return typeof message === 'string' ? message : undefined
}

function UserFormModal({
  open,
  mode,
  roles,
  permissions,
  initialUser,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'create' | 'edit'
  roles: RoleRecord[]
  permissions: Array<{ permissionKey: PermissionKey; moduleName: string }>
  initialUser?: ManagedUser | null
  onClose: () => void
  onSubmit: (values: UserCreateValues | UserEditValues) => Promise<void>
}) {
  const isCreate = mode === 'create'
  const form = useForm<any>({
    resolver: zodResolver(isCreate ? userCreateSchema : userEditSchema) as any,
    defaultValues: isCreate
      ? {
          email: '',
          fullNameBn: '',
          fullNameEn: '',
          phone: '',
          password: '',
          status: 'active',
          mustChangePassword: true,
          roles: ['librarian'],
          permissionOverrides: [],
        }
      : {
          fullNameBn: initialUser?.fullNameBn ?? '',
          fullNameEn: initialUser?.fullNameEn ?? '',
          phone: initialUser?.phone ?? '',
          status: initialUser?.status ?? 'active',
          mustChangePassword: initialUser?.mustChangePassword ?? false,
          roles: initialUser?.roles ?? ['librarian'],
          permissionOverrides: initialUser?.permissionOverrides ?? [],
        },
  })

  const overrides = useFieldArray({
    control: form.control,
    name: 'permissionOverrides',
  })
  const selectedRoles = (useWatch({
    control: form.control,
    name: 'roles',
  }) ?? []) as string[]
  const mustChangePassword = Boolean(
    useWatch({
      control: form.control,
      name: 'mustChangePassword',
    }),
  )

  return (
    <Modal
      open={open}
      title={isCreate ? 'নতুন ব্যবহারকারী তৈরি' : 'ব্যবহারকারী সম্পাদনা'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            বাতিল
          </Button>
          <Button type="submit" form={`user-form-${mode}`}>
            {isCreate ? 'তৈরি করুন' : 'সংরক্ষণ করুন'}
          </Button>
        </>
      }
    >
      <form
        id={`user-form-${mode}`}
        className="form-grid"
        onSubmit={form.handleSubmit(async (values) =>
          onSubmit(values as UserCreateValues | UserEditValues),
        )}
      >
        {isCreate ? (
          <div className="form-grid form-grid--two">
            <FormField label="ইমেইল" error={errorText(form.formState.errors.email?.message)}>
              <TextInput {...form.register('email')} />
            </FormField>
            <FormField
              label="প্রাথমিক পাসওয়ার্ড"
              error={errorText(form.formState.errors.password?.message)}
            >
              <TextInput type="password" {...form.register('password')} />
            </FormField>
          </div>
        ) : null}

        <div className="form-grid form-grid--two">
          <FormField
            label="নাম (বাংলা)"
            error={errorText(form.formState.errors.fullNameBn?.message)}
          >
            <TextInput {...form.register('fullNameBn')} />
          </FormField>
          <FormField
            label="নাম (English)"
            error={errorText(form.formState.errors.fullNameEn?.message)}
          >
            <TextInput {...form.register('fullNameEn')} />
          </FormField>
        </div>

        <div className="form-grid form-grid--two">
          <FormField label="মোবাইল" error={errorText(form.formState.errors.phone?.message)}>
            <TextInput {...form.register('phone')} />
          </FormField>
          <FormField label="স্ট্যাটাস" error={errorText(form.formState.errors.status?.message)}>
            <SelectInput {...form.register('status')}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="suspended">suspended</option>
            </SelectInput>
          </FormField>
        </div>

        <div className="shell-card">
          <h3>রোল</h3>
          <div className="section-grid">
            {roles.map((role) => (
              <CheckboxInput
                key={role.id}
                label={`${role.nameBn} (${role.roleKey})`}
                checked={selectedRoles.includes(role.roleKey)}
                onChange={(event) => {
                  const current = (form.getValues('roles') ?? []) as string[]
                  const next = event.target.checked
                    ? [...new Set([...current, role.roleKey])]
                    : current.filter((item: string) => item !== role.roleKey)
                  form.setValue('roles', next as any, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }}
              />
            ))}
          </div>
        </div>

        <CheckboxInput
          label="পরবর্তী লগইনে পাসওয়ার্ড পরিবর্তন বাধ্যতামূলক"
          checked={mustChangePassword}
          onChange={(event) =>
            form.setValue('mustChangePassword', event.target.checked, { shouldDirty: true })
          }
        />

        <div className="shell-card">
          <div className="content-card__header">
            <div>
              <h3>Permission Override</h3>
              <p className="muted">
                বিশেষ পরিস্থিতিতে নির্দিষ্ট permission এর জন্য allow বা deny override দিন।
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                overrides.append({
                  permissionKey: permissions[0]?.permissionKey ?? 'catalog.view_public',
                  effect: 'allow',
                })
              }
            >
              Override যোগ
            </Button>
          </div>
          <div className="section-grid">
            {overrides.fields.map((field, index) => (
              <div className="form-grid form-grid--two" key={field.id}>
                <FormField label="Permission">
                  <SelectInput {...form.register(`permissionOverrides.${index}.permissionKey`)}>
                    {permissions.map((permission) => (
                      <option key={permission.permissionKey} value={permission.permissionKey}>
                        {permission.permissionKey}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Effect">
                  <SelectInput {...form.register(`permissionOverrides.${index}.effect`)}>
                    <option value="allow">allow</option>
                    <option value="deny">deny</option>
                  </SelectInput>
                </FormField>
                <div className="inline-actions">
                  <Button type="button" variant="ghost" onClick={() => overrides.remove(index)}>
                    মুছুন
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}

function ResetPasswordModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (values: ResetPasswordValues) => Promise<void>
}) {
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(adminResetPasswordSchema) as any,
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
      requireChangeAtNextLogin: true,
    },
  })
  const requireChangeAtNextLogin = Boolean(
    useWatch({
      control: form.control,
      name: 'requireChangeAtNextLogin',
    }),
  )

  return (
    <Modal
      open={open}
      title="পাসওয়ার্ড রিসেট"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            বাতিল
          </Button>
          <Button type="submit" form="reset-password-form">
            রিসেট করুন
          </Button>
        </>
      }
    >
      <form
        id="reset-password-form"
        className="form-grid"
        onSubmit={form.handleSubmit(async (values) => onSubmit(values))}
      >
        <FormField
          label="নতুন পাসওয়ার্ড"
          error={errorText(form.formState.errors.newPassword?.message)}
        >
          <TextInput type="password" {...form.register('newPassword')} />
        </FormField>
        <FormField
          label="পাসওয়ার্ড নিশ্চিত করুন"
          error={errorText(form.formState.errors.confirmPassword?.message)}
        >
          <TextInput type="password" {...form.register('confirmPassword')} />
        </FormField>
        <CheckboxInput
          label="পরবর্তী লগইনে আবার পরিবর্তন করতে হবে"
          checked={requireChangeAtNextLogin}
          onChange={(event) =>
            form.setValue('requireChangeAtNextLogin', event.target.checked, { shouldDirty: true })
          }
        />
      </form>
    </Modal>
  )
}

export function UsersPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useLocalStorageState('plms-users-filters', {
    search: '',
    page: 1,
    pageSize: 10,
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<ManagedUser | null>(null)
  const [deactivateUser, setDeactivateUser] = useState<ManagedUser | null>(null)

  const rolesQuery = useQuery({
    queryKey: ['roles-and-permissions'],
    queryFn: () => apiRequest<RolesPayload>('/api/admin/roles'),
  })

  const usersQuery = useQuery({
    queryKey: ['managed-users', filters],
    queryFn: () =>
      apiRequest<UserListingPayload>(
        `/api/admin/users?search=${encodeURIComponent(filters.search)}&page=${filters.page}&pageSize=${filters.pageSize}`,
      ),
  })

  const createMutation = useMutation({
    mutationFn: (values: UserCreateValues) => apiPost('/api/admin/users', values),
    onSuccess: async () => {
      setCreateOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['managed-users'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ userId, values }: { userId: string; values: UserEditValues }) =>
      apiPatch(`/api/admin/users/${userId}`, values),
    onSuccess: async () => {
      setEditingUser(null)
      setDeactivateUser(null)
      await queryClient.invalidateQueries({ queryKey: ['managed-users'] })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, values }: { userId: string; values: ResetPasswordValues }) =>
      apiPost(`/api/admin/users/${userId}/reset-password`, values),
    onSuccess: async () => {
      setResetPasswordUser(null)
    },
  })

  if (rolesQuery.isLoading || usersQuery.isLoading) {
    return <LoadingState label="ব্যবহারকারী মডিউল লোড হচ্ছে..." />
  }

  if (rolesQuery.isError || usersQuery.isError) {
    return (
      <EmptyState
        title="ইউজার ডেটা লোড করা যায়নি"
        description={
          errorMessage(rolesQuery.error ?? usersQuery.error) ||
          'পরে আবার চেষ্টা করুন অথবা সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।'
        }
      />
    )
  }

  const roles = rolesQuery.data?.roles ?? []
  const permissions = rolesQuery.data?.permissions ?? []
  const items = usersQuery.data?.items ?? []

  return (
    <div className="page-stack">
      <div className="page-header content-card">
        <h1>ইউজার ম্যানেজমেন্ট</h1>
        <p>
          ব্যবহারকারী তৈরি, রোল অ্যাসাইন, পাসওয়ার্ড রিসেট এবং নিরাপদ নিষ্ক্রিয়করণ।
        </p>
      </div>

      <section className="content-card">
        <div className="content-card__header">
          <TextInput
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
            placeholder="নাম, ইমেইল বা মোবাইল দিয়ে খুঁজুন"
          />
          <Button variant="secondary" type="button" onClick={() => setCreateOpen(true)}>
            নতুন ইউজার
          </Button>
        </div>
        <DataTable
          items={items}
          empty={
            <EmptyState
              title="কোনো ইউজার নেই"
              description="নতুন ইউজার তৈরি করে শুরু করুন।"
            />
          }
          columns={[
            {
              key: 'identity',
              header: 'পরিচয়',
              render: (item) => (
                <div>
                  <strong>{item.fullNameBn}</strong>
                  <p className="muted">{item.email}</p>
                </div>
              ),
            },
            {
              key: 'role',
              header: 'রোল',
              render: (item) => (
                <div>
                  <Badge tone="info">{item.primaryRole}</Badge>
                  <p className="muted">{item.roles.join(', ')}</p>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'স্ট্যাটাস',
              render: (item) => <StatusBadge status={item.status} />,
            },
            {
              key: 'actions',
              header: 'অ্যাকশন',
              render: (item) => (
                <div className="inline-actions">
                  <Button variant="ghost" type="button" onClick={() => setEditingUser(item)}>
                    সম্পাদনা
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setResetPasswordUser(item)}
                  >
                    পাসওয়ার্ড রিসেট
                  </Button>
                  {item.status === 'active' ? (
                    <Button
                      variant="danger"
                      type="button"
                      onClick={() => setDeactivateUser(item)}
                    >
                      নিষ্ক্রিয়
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      </section>

      <UserFormModal
        open={createOpen}
        mode="create"
        roles={roles}
        permissions={permissions}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (values) => {
          await createMutation.mutateAsync(values as UserCreateValues).catch((error) => {
            throw new Error(errorMessage(error))
          })
        }}
      />

      <UserFormModal
        open={Boolean(editingUser)}
        mode="edit"
        roles={roles}
        permissions={permissions}
        initialUser={editingUser}
        onClose={() => setEditingUser(null)}
        onSubmit={async (values) => {
          if (!editingUser) {
            return
          }

          await updateMutation.mutateAsync({
            userId: editingUser.id,
            values: values as UserEditValues,
          })
        }}
      />

      <ResetPasswordModal
        open={Boolean(resetPasswordUser)}
        onClose={() => setResetPasswordUser(null)}
        onSubmit={async (values) => {
          if (!resetPasswordUser) {
            return
          }

          await resetPasswordMutation.mutateAsync({
            userId: resetPasswordUser.id,
            values,
          })
        }}
      />

      <ConfirmDialog
        open={Boolean(deactivateUser)}
        title="ইউজার নিষ্ক্রিয় করবেন?"
        description="এই ইউজার আর লগইন করতে পারবে না, কিন্তু অডিট রেকর্ড সংরক্ষিত থাকবে।"
        confirmLabel="নিষ্ক্রিয় করুন"
        loading={updateMutation.isPending}
        onCancel={() => setDeactivateUser(null)}
        onConfirm={() => {
          if (!deactivateUser) {
            return
          }

          void updateMutation.mutateAsync({
            userId: deactivateUser.id,
            values: {
              fullNameBn: deactivateUser.fullNameBn,
              fullNameEn: deactivateUser.fullNameEn ?? '',
              phone: deactivateUser.phone ?? '',
              status: 'inactive',
              mustChangePassword: deactivateUser.mustChangePassword,
              roles: deactivateUser.roles,
              permissionOverrides: deactivateUser.permissionOverrides,
            },
          })
        }}
      />
    </div>
  )
}
