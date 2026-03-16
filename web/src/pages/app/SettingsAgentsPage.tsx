import { useState } from 'react'
import { Button } from '../../components/common/Button'
import { ToggleSwitch } from '../../components/common/ToggleSwitch'

export const SettingsAgentsPage = () => {
  const [defaults, setDefaults] = useState({
    autoConfirmOrders: false,
    sendWebhookByDefault: true,
    enableFallbackGreeting: true,
    notifyOnFailures: true,
  })

  return (
    <div className="stack-lg">
      <h1>Agent Preferences</h1>

      <section className="card stack-sm">
        <h3>Default agent behavior</h3>
        <ToggleSwitch
          checked={defaults.autoConfirmOrders}
          onChange={(checked) => setDefaults((prev) => ({ ...prev, autoConfirmOrders: checked }))}
          label="Auto-confirm newly captured orders"
        />
        <ToggleSwitch
          checked={defaults.enableFallbackGreeting}
          onChange={(checked) => setDefaults((prev) => ({ ...prev, enableFallbackGreeting: checked }))}
          label="Enable fallback greeting"
        />
      </section>

      <section className="card stack-sm">
        <h3>Default order notifications</h3>
        <ToggleSwitch
          checked={defaults.sendWebhookByDefault}
          onChange={(checked) => setDefaults((prev) => ({ ...prev, sendWebhookByDefault: checked }))}
          label="Send webhook notifications by default"
        />
        <ToggleSwitch
          checked={defaults.notifyOnFailures}
          onChange={(checked) => setDefaults((prev) => ({ ...prev, notifyOnFailures: checked }))}
          label="Notify team on delivery failures"
        />
      </section>

      <div className="row end">
        <Button>Save preferences</Button>
      </div>
    </div>
  )
}
