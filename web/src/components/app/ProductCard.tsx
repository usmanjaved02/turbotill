import type { Product } from '../../types'
import { formatCurrency, formatDate } from '../../utils/format'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'

interface ProductCardProps {
  product: Product
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export const ProductCard = ({ product, onView, onEdit, onDelete }: ProductCardProps) => {
  return (
    <article className="card product-card">
      <div className="product-card-media">
        <div className="product-card-media-badge">{product.category}</div>
        <div className="product-card-media-art">{product.name.slice(0, 1)}</div>
      </div>
      <div className="split-row">
        <div className="stack-xs">
          <h3>{product.name}</h3>
          <p className="muted">SKU {product.sku}</p>
        </div>
        <Badge tone={product.status === 'published' ? 'success' : product.status === 'draft' ? 'warning' : 'danger'}>
          {product.status}
        </Badge>
      </div>
      <p className="product-card-copy">{product.description}</p>
      <div className="product-meta-grid">
        <div className="product-meta-tile">
          <p className="muted">SKU</p>
          <strong>{product.sku}</strong>
        </div>
        <div className="product-meta-tile">
          <p className="muted">Price</p>
          <strong>{formatCurrency(product.price, product.currency)}</strong>
        </div>
        <div className="product-meta-tile">
          <p className="muted">Status</p>
          <strong>{product.status}</strong>
        </div>
        <div className="product-meta-tile">
          <p className="muted">Created</p>
          <strong>{formatDate(product.createdAt)}</strong>
        </div>
      </div>
      <div className="row end gap-sm">
        <Button size="sm" variant="ghost" onClick={() => onView(product.id)}>
          View
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onEdit(product.id)}>
          Edit
        </Button>
        <Button size="sm" variant="danger" onClick={() => onDelete(product.id)}>
          Delete
        </Button>
      </div>
    </article>
  )
}
