import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody, CardHeader, CardHeading, CardLabel, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import {
  createUserAccount,
  deleteUserAccount,
  isAdmin,
  updateUserAccount,
  useStore,
} from '@/lib/store'
import type { AppUser, UserRole } from '@/lib/types'
import { Plus, Save, Shield, Trash2, UserRound } from 'lucide-react'

type FormState = {
  username: string
  displayName: string
  role: UserRole
  disabled: boolean
  password: string
}

const EMPTY_FORM: FormState = {
  username: '',
  displayName: '',
  role: 'viewer',
  disabled: false,
  password: '',
}

export default function UsersPage() {
  const currentUser = useStore((s) => s.currentUser)
  const users = useStore((s) => s.users)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  useEffect(() => {
    if (!users.length) {
      setSelectedUserId(null)
      return
    }
    if (!selectedUserId || !users.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(users[0].id)
    }
  }, [selectedUserId, users])

  const selectedUser = useMemo(
    () => (selectedUserId ? users.find((user) => user.id === selectedUserId) : undefined),
    [selectedUserId, users],
  )

  useEffect(() => {
    if (creating) {
      setForm(EMPTY_FORM)
      setError('')
      return
    }

    if (selectedUser) {
      setForm({
        username: selectedUser.username,
        displayName: selectedUser.displayName,
        role: selectedUser.role,
        disabled: selectedUser.disabled,
        password: '',
      })
      setError('')
    }
  }, [creating, selectedUser])

  if (!isAdmin(currentUser)) {
    return (
      <>
        <TopBar subtitle="Administration" title="Users" />
        <div className="flex flex-1 items-center justify-center px-6">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>
                <CardLabel>Restricted</CardLabel>
                <CardHeading>Administrator access required</CardHeading>
              </CardTitle>
            </CardHeader>
            <CardBody className="text-sm text-[var(--color-fg-subtle)]">
              This page is only available to administrator accounts.
            </CardBody>
          </Card>
        </div>
      </>
    )
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      if (creating) {
        const created = await createUserAccount({
          username: form.username.trim(),
          displayName: form.displayName.trim() || undefined,
          password: form.password,
          role: form.role,
          disabled: form.disabled,
        })
        setCreating(false)
        setSelectedUserId(created.id)
        return
      }

      if (!selectedUser) return
      const updated = await updateUserAccount(selectedUser.id, {
        username: form.username.trim(),
        displayName: form.displayName.trim() || null,
        role: form.role,
        disabled: form.disabled,
        password: form.password.trim() ? form.password : undefined,
      })
      setSelectedUserId(updated.id)
      setForm((prev) => ({ ...prev, password: '' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedUser) return
    if (!window.confirm(`Delete user ${selectedUser.username}?`)) return

    setDeleting(true)
    setError('')
    try {
      await deleteUserAccount(selectedUser.id)
      setSelectedUserId(null)
      setCreating(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <TopBar
        subtitle="Administration"
        title="Users"
        meta={
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {users.length} accounts
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCreating(true)
              setSelectedUserId(null)
            }}
          >
            <Plus className="size-3.5" />
            Add user
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-72 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-bg-2)]/40">
          <div className="border-b border-[var(--color-line)] px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
              Accounts
            </span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {users.map((user) => {
              const active = !creating && user.id === selectedUserId
              return (
                <button
                  key={user.id}
                  onClick={() => {
                    setCreating(false)
                    setSelectedUserId(user.id)
                  }}
                  className={`w-full border-l-2 px-4 py-2.5 text-left transition-colors ${
                    active
                      ? 'border-[var(--color-accent)] bg-[var(--color-surface)]'
                      : 'border-transparent hover:bg-[var(--color-surface)]/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium text-[var(--color-fg)]">{user.displayName}</div>
                    <Badge tone={user.role === 'admin' ? 'accent' : user.role === 'editor' ? 'info' : 'neutral'}>
                      {user.role}
                    </Badge>
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
                    @{user.username}
                  </div>
                  {user.disabled && (
                    <div className="mt-1 text-[11px] text-[var(--color-err)]">Disabled</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>
                <CardLabel>{creating ? 'New account' : 'User details'}</CardLabel>
                <CardHeading>{creating ? 'Create user' : selectedUser?.displayName ?? 'Select a user'}</CardHeading>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge tone={form.role === 'admin' ? 'accent' : form.role === 'editor' ? 'info' : 'neutral'}>
                  {form.role}
                </Badge>
                {selectedUser && (
                  <Badge tone={selectedUser.disabled ? 'err' : 'ok'}>
                    {selectedUser.disabled ? 'disabled' : 'active'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {selectedUser || creating ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Username">
                      <Input
                        value={form.username}
                        onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                        placeholder="username"
                      />
                    </Field>
                    <Field label="Display name">
                      <Input
                        value={form.displayName}
                        onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                        placeholder="Display name"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={creating ? 'Password' : 'Reset password'}>
                      <Input
                        type="password"
                        value={form.password}
                        onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                        placeholder={creating ? 'At least 10 characters' : 'Leave blank to keep current password'}
                      />
                    </Field>
                    <Field label="Role">
                      <RolePicker value={form.role} onChange={(role) => setForm((prev) => ({ ...prev, role }))} />
                    </Field>
                  </div>

                  <label className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)]">
                    <input
                      type="checkbox"
                      checked={form.disabled}
                      onChange={(event) => setForm((prev) => ({ ...prev, disabled: event.target.checked }))}
                    />
                    Disable this account
                  </label>

                  {selectedUser && (
                    <div className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] p-4 md:grid-cols-2">
                      <Stat label="Created" value={new Date(selectedUser.createdAt).toLocaleString()} />
                      <Stat label="Last login" value={selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : 'Never'} />
                    </div>
                  )}

                  {error && (
                    <div className="rounded-[var(--radius-sm)] border border-[var(--color-err)]/30 bg-[var(--color-err)]/10 px-3 py-2 text-sm text-[var(--color-err)]">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-[var(--color-fg-subtle)]">
                      <UserRound className="size-3.5" />
                      Viewer is read-only, editor can manage inventory, admin can manage users.
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedUser && (
                        <Button variant="destructive" size="sm" onClick={() => void handleDelete()} disabled={deleting}>
                          <Trash2 className="size-3.5" />
                          {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                      )}
                      <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
                        <Save className="size-3.5" />
                        {saving ? 'Saving...' : creating ? 'Create user' : 'Save changes'}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-[var(--color-fg-subtle)]">
                  Select an account from the left or create a new one.
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {label}
      </span>
      {children}
    </label>
  )
}

function RolePicker({
  value,
  onChange,
}: {
  value: UserRole
  onChange: (value: UserRole) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(['viewer', 'editor', 'admin'] as const).map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => onChange(role)}
          className={`rounded-[var(--radius-xs)] border px-2 py-2 text-xs capitalize transition-colors ${
            value === role
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent-strong)]'
              : 'border-[var(--color-line)] text-[var(--color-fg-muted)] hover:border-[var(--color-line-strong)]'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <Shield className="size-3.5" />
            {role}
          </span>
        </button>
      ))}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div className="mt-1 text-sm text-[var(--color-fg)]">{value}</div>
    </div>
  )
}
