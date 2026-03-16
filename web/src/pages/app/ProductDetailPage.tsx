import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { DeleteConfirmModal } from '../../components/app/DeleteConfirmModal'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { useApp } from '../../context/AppContext'
import { formatCurrency, formatDate } from '../../utils/format'

export const ProductDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    state: { products, agents },
    deleteProduct,
  } = useApp()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const product = products.find((item) => item.id === id)
  if (!product) return <Navigate to="/app/products" replace />

  const linkedAgents = agents.filter(
    (agent) => agent.productAccess === 'all' || agent.productIds.includes(product.id),
  )

  return (
    <div className="stack-lg">
      <section className="split-row">
        <div>
          <h1>{product.name}</h1>
          <p className="muted">SKU: {product.sku}</p>
        </div>
        <div className="row gap-sm">
          <Link to={`/app/products/${product.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Delete
          </Button>
        </div>
      </section>

      <section className="grid two-col">
        <article className="card stack-sm">
          <h3>Product summary</h3>
          <p>{product.description}</p>
          <div className="review-grid">
            <p>
              <span className="muted">Price:</span> {formatCurrency(product.price, product.currency)}
            </p>
            <p>
              <span className="muted">Status:</span> <Badge tone="success">{product.status}</Badge>
            </p>
            <p>
              <span className="muted">Category:</span> {product.category}
            </p>
            <p>
              <span className="muted">Created:</span> {formatDate(product.createdAt)}
            </p>
          </div>
        </article>

        <article className="card stack-sm">
          <h3>Linked agents using this product</h3>
          {linkedAgents.length === 0 ? (
            <p className="muted">No linked agents yet.</p>
          ) : (
            <ul className="line-list">
              {linkedAgents.map((agent) => (
                <li key={agent.id}>{agent.name}</li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <DeleteConfirmModal
        open={confirmOpen}
        description="Deleting this product may impact agent product access rules."
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await deleteProduct(product.id)
          navigate('/app/products')
        }}
      />
    </div>
  )
}
