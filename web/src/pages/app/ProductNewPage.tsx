import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProductForm } from '../../components/app/ProductForm'
import { Button } from '../../components/common/Button'
import { useApp } from '../../context/AppContext'
import type { ProductInput } from '../../types'

export const ProductNewPage = () => {
  const navigate = useNavigate()
  const { createProduct, openShopifyModal, appLoading } = useApp()
  const [method, setMethod] = useState<'manual' | 'shopify'>('manual')

  const save = async (payload: ProductInput) => {
    const product = await createProduct(payload)
    navigate(`/app/products/${product.id}`)
  }

  return (
    <div className="stack-lg">
      <section className="card product-new-hero">
        <div className="split-row">
          <div className="stack-sm">
            <span className="section-kicker">Catalog Setup</span>
            <h1>Add Product</h1>
            <p className="muted product-new-hero-copy">
              Create a clean catalog entry your agents can sell immediately. Keep pricing and product details accurate
              before enabling order capture.
            </p>
          </div>
          <div className="product-new-hero-note">
            <strong>Recommended workflow</strong>
            <p>Start with 3 to 5 core products, then create your first agent once the catalog is ready.</p>
          </div>
        </div>
      </section>

      <section className="grid two-col product-method-grid">
        <button className={`mode-card product-method-card ${method === 'manual' ? 'active' : ''}`} onClick={() => setMethod('manual')}>
          <span className="section-kicker">Recommended</span>
          <strong>Add Manually</strong>
          <p>Create products one-by-one with full control over pricing and product messaging.</p>
          <ul className="product-method-points">
            <li>Fastest way to launch your first catalog</li>
            <li>Perfect for curated or smaller inventories</li>
            <li>Best for validating your agent workflow</li>
          </ul>
        </button>
        <button
          className={`mode-card product-method-card ${method === 'shopify' ? 'active' : ''}`}
          onClick={() => {
            setMethod('shopify')
            openShopifyModal()
          }}
        >
          <span className="section-kicker">Coming Soon</span>
          <strong>Connect Shopify Store</strong>
          <p>Sync products automatically once the integration is available.</p>
          <ul className="product-method-points">
            <li>Automatic catalog import and inventory sync</li>
            <li>Ideal for larger commerce catalogs</li>
            <li>Join the waitlist to get notified first</li>
          </ul>
        </button>
      </section>

      {method === 'manual' ? (
        <ProductForm
          loading={appLoading}
          onSubmit={save}
          onSaveDraft={save}
          onCancel={() => navigate('/app/products')}
          submitLabel="Publish product"
        />
      ) : (
        <section className="card stack-sm">
          <h3>Shopify sync is coming soon</h3>
          <p>Use manual creation for now. We will notify you once sync becomes available.</p>
          <Button variant="secondary" onClick={() => setMethod('manual')}>
            Back to manual setup
          </Button>
        </section>
      )}
    </div>
  )
}
