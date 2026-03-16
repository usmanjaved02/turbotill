import { useState, type ChangeEvent } from 'react'
import { Button } from '../../components/common/Button'
import { ToggleSwitch } from '../../components/common/ToggleSwitch'
import { useApp } from '../../context/AppContext'
import type { CurrencyCode } from '../../types'
import { resolveAssetUrl } from '../../utils/assets'

export const SettingsWorkspacePage = () => {
  const {
    state: { user },
    updateWorkspace,
    uploadWorkspaceLogo,
    pushToast,
    appLoading
  } = useApp()
  const [form, setForm] = useState({
    logo: user?.businessLogo ?? '',
    name: user?.businessName ?? '',
    currency: user?.defaultCurrency ?? 'USD',
    timezone: user?.timezone ?? 'America/New_York',
    emailAlerts: user?.notificationPreferences.emailAlerts ?? true,
    smsAlerts: user?.notificationPreferences.smsAlerts ?? false,
  })
  const [saved, setSaved] = useState(false)
  const [logoPreview, setLogoPreview] = useState(resolveAssetUrl(user?.businessLogo))

  const handleLogoSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const previewUrl = URL.createObjectURL(file)
    setLogoPreview(previewUrl)

    try {
      await uploadWorkspaceLogo(file)
    } catch (error) {
      setLogoPreview(resolveAssetUrl(user?.businessLogo))
      pushToast({
        type: 'error',
        title: 'Unable to upload logo',
        message: error instanceof Error ? error.message : 'Try again in a moment.'
      })
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="stack-lg">
      <h1>Workspace Settings</h1>

      <form
        className="card stack-sm"
        onSubmit={async (event) => {
          event.preventDefault()
          try {
            await updateWorkspace({
              businessName: form.name,
              businessLogo: form.logo.trim() || undefined,
              defaultCurrency: form.currency,
              timezone: form.timezone,
              notificationPreferences: {
                emailAlerts: form.emailAlerts,
                smsAlerts: form.smsAlerts
              }
            })
            setSaved(true)
            setTimeout(() => setSaved(false), 1800)
          } catch (error) {
            pushToast({
              type: 'error',
              title: 'Unable to save workspace',
              message: error instanceof Error ? error.message : 'Try again in a moment.'
            })
          }
        }}
      >
        <div className="grid two-col">
          <div className="workspace-logo-card">
            <div className="workspace-logo-preview">
              {logoPreview ? <img src={logoPreview} alt="Workspace logo" /> : <span>{form.name.slice(0, 1) || 'W'}</span>}
            </div>
            <label className="upload-inline">
              <span className="text-link">Upload logo</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoSelected} />
            </label>
          </div>
          <label>
            Business logo
            <input
              className="input"
              value={form.logo}
              onChange={(event) => setForm((prev) => ({ ...prev, logo: event.target.value }))}
              placeholder="Logo URL"
            />
          </label>
          <label>
            Business name
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>
          <label>
            Default currency
            <select
              className="input"
              value={form.currency}
              onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value as CurrencyCode }))}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
          <label>
            Timezone
            <select
              className="input"
              value={form.timezone}
              onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
            >
              <option value="America/New_York">America/New_York</option>
              <option value="America/Chicago">America/Chicago</option>
              <option value="Europe/London">Europe/London</option>
            </select>
          </label>
        </div>

        <div className="stack-sm">
          <h3>Notification preferences</h3>
          <ToggleSwitch
            checked={form.emailAlerts}
            onChange={(checked) => setForm((prev) => ({ ...prev, emailAlerts: checked }))}
            label="Email alerts"
          />
          <ToggleSwitch
            checked={form.smsAlerts}
            onChange={(checked) => setForm((prev) => ({ ...prev, smsAlerts: checked }))}
            label="SMS alerts"
          />
        </div>

        {saved ? <p className="success-text">Workspace changes saved.</p> : null}
        <div className="row end">
          <Button type="submit" disabled={appLoading}>
            {appLoading ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
