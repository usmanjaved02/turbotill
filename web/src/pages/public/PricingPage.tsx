import { CTASection } from '../../components/marketing/CTASection'
import { PricingCard } from '../../components/marketing/PricingCard'

export const PricingPage = () => {
  return (
    <div className="stack-xl">
      <section>
        <span className="eyebrow">Pricing</span>
        <h1>Simple plans for growing order operations</h1>
        <p>Choose the plan that matches your volume, channels, and team size.</p>
      </section>

      <section className="grid three-col">
        <PricingCard
          plan="Starter"
          price="$39/mo"
          summary="For new teams launching category-based order agents."
          features={['2 agents', 'Up to 500 orders/mo', 'Terminal + Table categories', 'Basic webhook support']}
        />
        <PricingCard
          plan="Growth"
          price="$129/mo"
          summary="For growing operations with daily live voice traffic."
          features={[
            '10 agents',
            'Up to 5,000 orders/mo',
            'Voice preview + table QR workflows',
            'Advanced filtering + exports',
            'Priority email support',
          ]}
          highlighted
        />
        <PricingCard
          plan="Business"
          price="Custom"
          summary="For large operations with custom integrations and controls."
          features={['Unlimited agents', 'Custom order limits', 'SLA + onboarding', 'Enterprise security']}
        />
      </section>

      <section className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Capability</th>
              <th>Starter</th>
              <th>Growth</th>
              <th>Business</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Agent Modes</td>
              <td>Terminal + Table</td>
              <td>Terminal + Table + Embedded UI</td>
              <td>All current + upcoming channels</td>
            </tr>
            <tr>
              <td>Voice & Language Options</td>
              <td>Standard</td>
              <td>Extended with preview testing</td>
              <td>Extended + rollout guidance</td>
            </tr>
            <tr>
              <td>Table QR workflows</td>
              <td>Basic</td>
              <td>Advanced table controls</td>
              <td>Advanced + policy support</td>
            </tr>
            <tr>
              <td>Webhook Testing</td>
              <td>Basic</td>
              <td>Advanced</td>
              <td>Advanced + audit</td>
            </tr>
            <tr>
              <td>Onboarding Support</td>
              <td>Self-serve</td>
              <td>Guided</td>
              <td>Dedicated success manager</td>
            </tr>
          </tbody>
        </table>
      </section>

      <CTASection
        title="Need a custom rollout?"
        description="Book a demo for workflow mapping, integration architecture, and launch planning."
      />
    </div>
  )
}
