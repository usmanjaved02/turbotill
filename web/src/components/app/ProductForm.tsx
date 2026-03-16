import { useMemo, useState } from 'react'
import type { Product, ProductInput } from '../../types'
import { formatCurrency } from '../../utils/format'
import { Button } from '../common/Button'

interface ProductFormProps {
  initialValue?: Partial<Product>
  loading?: boolean
  onSubmit: (payload: ProductInput) => Promise<void> | void
  onSaveDraft?: (payload: ProductInput) => Promise<void> | void
  onCancel?: () => void
  submitLabel?: string
}

export const ProductForm = ({
  initialValue,
  loading,
  onSubmit,
  onSaveDraft,
  onCancel,
  submitLabel = 'Publish product',
}: ProductFormProps) => {
  const [form, setForm] = useState<ProductInput>({
    name: initialValue?.name ?? '',
    sku: initialValue?.sku ?? '',
    category: initialValue?.category ?? '',
    description: initialValue?.description ?? '',
    price: initialValue?.price ?? 0,
    currency: initialValue?.currency ?? 'USD',
    discount: initialValue?.discount ?? 0,
    status: initialValue?.status ?? 'published',
    image: initialValue?.image ?? '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const finalPrice = useMemo(() => {
    const discount = form.discount ? form.discount / 100 : 0
    return form.price - form.price * discount
  }, [form.price, form.discount])

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (!form.name.trim()) nextErrors.name = 'Product name is required.'
    if (!form.sku.trim()) nextErrors.sku = 'SKU is required.'
    if (!form.category.trim()) nextErrors.category = 'Category is required.'
    if (form.price <= 0) nextErrors.price = 'Price must be greater than 0.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validate()) return
    await onSubmit(form)
  }

  return (
    <form className="grid two-col form-layout" onSubmit={handleSubmit}>
      <section className="card stack-sm product-form-main">
        <div className="product-form-section">
          <div className="product-form-section-head">
            <div>
              <span className="section-kicker">Basic info</span>
              <h3>Product details</h3>
            </div>
            <p className="muted">Add the product information your agents and operators will rely on during order capture.</p>
          </div>

          <label>
            Product name
            <input
              className={`input ${errors.name ? 'input-error' : ''}`}
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Classic Cheese Pizza"
            />
            {errors.name ? <small className="error-text">{errors.name}</small> : null}
          </label>

          <div className="grid two-col">
            <label>
              SKU
              <input
                className={`input ${errors.sku ? 'input-error' : ''}`}
                value={form.sku}
                onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))}
                placeholder="PIZ-CHS-12"
              />
              {errors.sku ? <small className="error-text">{errors.sku}</small> : null}
            </label>
            <label>
              Category
              <input
                className={`input ${errors.category ? 'input-error' : ''}`}
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                placeholder="Pizza"
              />
              {errors.category ? <small className="error-text">{errors.category}</small> : null}
            </label>
          </div>

          <label>
            Description
            <textarea
              className="input"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Describe the product clearly so agents can reference it accurately while taking orders."
            />
          </label>
        </div>

        <div className="product-form-section">
          <div className="product-form-section-head">
            <div>
              <span className="section-kicker">Pricing</span>
              <h3>Commercial settings</h3>
            </div>
            <p className="muted">Set what the customer pays and whether agents should be able to sell the item right now.</p>
          </div>

          <div className="grid two-col">
            <label>
              Price
              <input
                className={`input ${errors.price ? 'input-error' : ''}`}
                type="number"
                min={0}
                value={form.price}
                onChange={(event) => setForm((prev) => ({ ...prev, price: Number(event.target.value) }))}
              />
              {errors.price ? <small className="error-text">{errors.price}</small> : null}
            </label>
            <label>
              Currency
              <select
                className="input"
                value={form.currency}
                onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value as ProductInput['currency'] }))}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </label>

            <label>
              Optional discount (%)
              <input
                className="input"
                type="number"
                min={0}
                max={90}
                value={form.discount}
                onChange={(event) => setForm((prev) => ({ ...prev, discount: Number(event.target.value) }))}
              />
            </label>
          </div>
        </div>

        <div className="product-form-section">
          <div className="product-form-section-head">
            <div>
              <span className="section-kicker">Publishing</span>
              <h3>Availability settings</h3>
            </div>
            <p className="muted">Choose whether the product is live for agents, saved as draft, or kept archived.</p>
          </div>

          <label>
            Status
            <select
              className="input"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as ProductInput['status'] }))}
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label>
            Product image URL
            <input
              className="input"
              placeholder="https://image-url"
              value={form.image}
              onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.value }))}
            />
          </label>
        </div>

        <div className="row end gap-sm product-form-footer">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          {onSaveDraft ? (
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => onSaveDraft({ ...form, status: 'draft' })}
            >
              Save draft
            </Button>
          ) : null}
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </section>

      <aside className="card stack-sm preview-card sticky-card product-preview-panel">
        <div className="product-preview-head">
          <div>
            <span className="section-kicker">Live Preview</span>
            <h3>What agents will see</h3>
          </div>
          <div className={`product-preview-status status-${form.status}`}>
            <span>{form.status}</span>
          </div>
        </div>
        <div className="preview-image">{form.image ? <img src={form.image} alt={form.name} /> : 'Image preview'}</div>
        <div className="stack-xs">
          <strong>{form.name || 'Untitled Product'}</strong>
          <p className="muted">{form.category || 'No category selected yet'}</p>
        </div>
        <p>{form.description || 'Description preview will appear here once you add product details.'}</p>
        <div className="product-preview-metrics">
          <div className="product-preview-metric">
            <span>Final price</span>
            <strong>{formatCurrency(finalPrice, form.currency)}</strong>
          </div>
          <div className="product-preview-metric">
            <span>Status</span>
            <strong>{form.status}</strong>
          </div>
          <div className="product-preview-metric">
            <span>SKU</span>
            <strong>{form.sku || 'Pending'}</strong>
          </div>
        </div>
        {form.discount ? <p className="muted">Discount applied: {form.discount}%</p> : null}
        <div className="product-preview-note">
          <strong>Publishing note</strong>
          <p>Published products can be assigned to agents immediately. Drafts stay private until you are ready.</p>
        </div>
      </aside>
    </form>
  )
}
