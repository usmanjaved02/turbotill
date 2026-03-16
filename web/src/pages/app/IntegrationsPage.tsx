import { Button } from '../../components/common/Button'
import { useApp } from '../../context/AppContext'

export const IntegrationsPage = () => {
  const { openShopifyModal, pushToast } = useApp()

  return (
    <div className="stack-lg">
      <section>
        <h1>Integrations</h1>
        <p>Connect order events and catalog sources with your systems.</p>
      </section>

      <section className="grid two-col">
        <article className="card muted-card stack-sm">
          <div className="split-row">
            <h3>Shopify</h3>
            <span className="badge badge-warning">Coming Soon</span>
          </div>
          <p>Catalog and inventory sync will be available soon.</p>
          <Button variant="secondary" onClick={openShopifyModal}>
            Join waitlist
          </Button>
        </article>

        <article className="card stack-sm">
          <h3>Webhooks</h3>
          <p>Configure global order notifications for external systems.</p>
          <div className="row gap-sm">
            <Button
              onClick={() =>
                pushToast({
                  type: 'success',
                  title: 'Saved',
                  message: 'Global webhook settings placeholder updated.',
                })
              }
            >
              Configure webhook
            </Button>
            <Button variant="ghost">View docs</Button>
          </div>
        </article>

        <article className="card stack-sm">
          <h3>Embedded Script</h3>
          <p>Deploy script agents on storefronts and campaign pages.</p>
          <Button variant="secondary">Manage snippets</Button>
        </article>

        <article className="card stack-sm">
          <h3>Future integrations</h3>
          <p>POS systems, call-center tools, and analytics pipelines are planned.</p>
          <Button variant="ghost">Request integration</Button>
        </article>
      </section>
    </div>
  )
}
