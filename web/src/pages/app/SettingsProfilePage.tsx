import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Skeleton } from '../../components/common/Skeleton'
import { useApp } from '../../context/AppContext'
import { api } from '../../services/api'
import type { OrganizationUser, OrganizationUserInput } from '../../types'
import { resolveAssetUrl } from '../../utils/assets'
import { getPasswordValidationMessage, isValidEmail } from '../../utils/authValidation'
import { formatDateTime } from '../../utils/format'

const INITIAL_ORG_USER_FORM: OrganizationUserInput = {
  fullName: '',
  email: '',
  password: '',
  role: 'manager',
  phone: ''
}

export const SettingsProfilePage = () => {
  const {
    state: { user, isAuthenticated },
    updateProfile,
    uploadAvatar,
    pushToast,
    appLoading
  } = useApp()

  const [form, setForm] = useState({
    name: user?.fullName ?? '',
    email: user?.email ?? '',
    currentPassword: '',
    newPassword: '',
    business: user?.businessName ?? '',
    phone: user?.phone ?? ''
  })
  const [saved, setSaved] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(resolveAssetUrl(user?.avatarUrl))

  const [organizationUsers, setOrganizationUsers] = useState<OrganizationUser[]>([])
  const [orgUsersLoading, setOrgUsersLoading] = useState(true)
  const [orgUsersError, setOrgUsersError] = useState('')
  const [createUserForm, setCreateUserForm] = useState<OrganizationUserInput>(INITIAL_ORG_USER_FORM)
  const [creatingUser, setCreatingUser] = useState(false)
  const [createUserError, setCreateUserError] = useState('')

  const canManageOrgUsers = useMemo(() => user?.role === 'owner' || user?.role === 'admin', [user?.role])

  useEffect(() => {
    setForm({
      name: user?.fullName ?? '',
      email: user?.email ?? '',
      currentPassword: '',
      newPassword: '',
      business: user?.businessName ?? '',
      phone: user?.phone ?? ''
    })
    setAvatarPreview(resolveAssetUrl(user?.avatarUrl))
  }, [user])

  const loadOrganizationUsers = useCallback(async () => {
    if (!isAuthenticated) return

    setOrgUsersLoading(true)
    setOrgUsersError('')
    try {
      const result = await api.auth.listOrganizationUsers()
      setOrganizationUsers(result.users)
    } catch (error) {
      setOrgUsersError(error instanceof Error ? error.message : 'Unable to load organization users.')
    } finally {
      setOrgUsersLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void loadOrganizationUsers()
  }, [loadOrganizationUsers])

  const handleAvatarSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)

    try {
      await uploadAvatar(file)
    } catch (error) {
      setAvatarPreview(resolveAssetUrl(user?.avatarUrl))
      pushToast({
        type: 'error',
        title: 'Unable to upload avatar',
        message: error instanceof Error ? error.message : 'Try again in a moment.'
      })
    } finally {
      event.target.value = ''
    }
  }

  const handleCreateOrganizationUser = async () => {
    if (!canManageOrgUsers) return

    setCreateUserError('')
    if (!createUserForm.fullName.trim()) {
      setCreateUserError('Full name is required.')
      return
    }

    if (!createUserForm.email.trim() || !isValidEmail(createUserForm.email)) {
      setCreateUserError('Please enter a valid email address.')
      return
    }

    const passwordMessage = getPasswordValidationMessage(createUserForm.password)
    if (!createUserForm.password || passwordMessage) {
      setCreateUserError(passwordMessage ?? 'Password is required.')
      return
    }

    setCreatingUser(true)
    try {
      const payload: OrganizationUserInput = {
        fullName: createUserForm.fullName.trim(),
        email: createUserForm.email.trim().toLowerCase(),
        password: createUserForm.password,
        role: createUserForm.role,
        phone: createUserForm.phone?.trim() ? createUserForm.phone.trim() : undefined
      }
      const result = await api.auth.createOrganizationUser(payload)
      setOrganizationUsers((prev) => [result.user, ...prev])
      setCreateUserForm({ ...INITIAL_ORG_USER_FORM, role: createUserForm.role })
      pushToast({
        type: 'success',
        title: 'Organization user created',
        message: `${result.user.fullName} can now log in with this email and password.`
      })
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Unable to create user',
        message: error instanceof Error ? error.message : 'Try again in a moment.'
      })
    } finally {
      setCreatingUser(false)
    }
  }

  return (
    <div className="stack-lg">
      <h1>Profile Settings</h1>

      <form
        className="card stack-sm"
        onSubmit={async (event) => {
          event.preventDefault()
          try {
            await updateProfile({
              fullName: form.name,
              businessName: form.business,
              email: form.email,
              phone: form.phone.trim() || undefined,
              currentPassword: form.currentPassword || undefined,
              newPassword: form.newPassword || undefined
            })
            setSaved(true)
            setForm((prev) => ({
              ...prev,
              currentPassword: '',
              newPassword: ''
            }))
            setTimeout(() => setSaved(false), 1800)
          } catch (error) {
            pushToast({
              type: 'error',
              title: 'Unable to save profile',
              message: error instanceof Error ? error.message : 'Try again in a moment.'
            })
          }
        }}
      >
        <div className="split-row">
          <div className="stack-sm">
            <p className="muted">Manage your account details and keep your workspace profile up to date.</p>
            {user ? <Badge tone="info">{user.role}</Badge> : null}
          </div>
          <div className="profile-upload-card">
            <div className="profile-avatar-large">
              {avatarPreview ? <img src={avatarPreview} alt="Profile avatar" /> : <span>{user?.fullName?.slice(0, 1) ?? 'U'}</span>}
            </div>
            <label className="upload-inline">
              <span className="text-link">Upload avatar</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarSelected} />
            </label>
          </div>
        </div>
        <div className="grid two-col">
          <label>
            Name
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>
          <label>
            Email
            <input
              className="input"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </label>
          <label>
            Current password
            <input
              className="input"
              type="password"
              value={form.currentPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
              placeholder="Required only to change password"
            />
          </label>
          <label>
            New password
            <input
              className="input"
              type="password"
              value={form.newPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              placeholder="Leave empty to keep current password"
            />
          </label>
          <label>
            Business name
            <input
              className="input"
              value={form.business}
              onChange={(event) => setForm((prev) => ({ ...prev, business: event.target.value }))}
            />
          </label>
          <label>
            Phone
            <input
              className="input"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </label>
        </div>
        {saved ? <p className="success-text">Changes saved.</p> : null}
        <div className="row end">
          <Button type="submit" disabled={appLoading}>
            {appLoading ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </form>

      <section className="card stack-sm">
        <div className="split-row">
          <div className="stack-sm">
            <h3>Organization Users</h3>
            <p className="muted">Create login access for your team and assign the right role.</p>
          </div>
          <Button variant="ghost" onClick={() => void loadOrganizationUsers()} disabled={orgUsersLoading}>
            Refresh list
          </Button>
        </div>

        {canManageOrgUsers ? (
          <div className="stack-sm">
            <div className="grid two-col">
              <label>
                Full name
                <input
                  className="input"
                  value={createUserForm.fullName}
                  onChange={(event) => setCreateUserForm((prev) => ({ ...prev, fullName: event.target.value }))}
                  placeholder="Enter team member name"
                />
              </label>
              <label>
                Email
                <input
                  className="input"
                  type="email"
                  value={createUserForm.email}
                  onChange={(event) => setCreateUserForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="name@company.com"
                />
              </label>
              <label>
                Password
                <input
                  className="input"
                  type="password"
                  value={createUserForm.password}
                  onChange={(event) => setCreateUserForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Set temporary password"
                />
              </label>
              <label>
                Role
                <select
                  className="input"
                  value={createUserForm.role}
                  onChange={(event) =>
                    setCreateUserForm((prev) => ({
                      ...prev,
                      role: event.target.value as OrganizationUserInput['role']
                    }))
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              <label>
                Phone (optional)
                <input
                  className="input"
                  value={createUserForm.phone ?? ''}
                  onChange={(event) => setCreateUserForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="03xx xxxxxxx"
                />
              </label>
            </div>
            <div className="row end">
              <Button type="button" onClick={() => void handleCreateOrganizationUser()} disabled={creatingUser}>
                {creatingUser ? 'Creating...' : 'Create User'}
              </Button>
            </div>
            {createUserError ? <p className="error-text">{createUserError}</p> : null}
          </div>
        ) : (
          <p className="muted">Only owner/admin can create organization users.</p>
        )}

        {orgUsersLoading ? (
          <div className="session-list">
            <div className="session-item">
              <Skeleton height={18} />
              <Skeleton height={12} />
              <Skeleton height={12} />
            </div>
            <div className="session-item">
              <Skeleton height={18} />
              <Skeleton height={12} />
              <Skeleton height={12} />
            </div>
          </div>
        ) : orgUsersError ? (
          <div className="session-empty">
            <p className="muted">{orgUsersError}</p>
            <Button variant="secondary" onClick={() => void loadOrganizationUsers()}>
              Retry
            </Button>
          </div>
        ) : organizationUsers.length === 0 ? (
          <div className="session-empty">
            <p className="muted">No organization users found yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Last login</th>
                </tr>
              </thead>
              <tbody>
                {organizationUsers.map((orgUser) => (
                  <tr key={orgUser.id}>
                    <td>{orgUser.fullName}</td>
                    <td>{orgUser.email}</td>
                    <td>
                      <Badge tone="neutral">{orgUser.role}</Badge>
                    </td>
                    <td>{formatDateTime(orgUser.createdAt)}</td>
                    <td>{orgUser.lastLoginAt ? formatDateTime(orgUser.lastLoginAt) : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
