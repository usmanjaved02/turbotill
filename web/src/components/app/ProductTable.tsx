import type { Product } from '../../types'
import { formatCurrency, formatDate } from '../../utils/format'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'

interface ProductTableProps {
  products: Product[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export const ProductTable = ({ products, onView, onEdit, onDelete }: ProductTableProps) => {
  return (
    <div className="table-wrap card">
      <table>
        <thead>
          <tr>
            <th>Product name</th>
            <th>SKU</th>
            <th>Category</th>
            <th>Price</th>
            <th>Status</th>
            <th>Created date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            return (
              <tr key={product.id}>
                <td>
                  <div className="table-product-cell">
                    <strong>{product.name}</strong>
                    <span>{product.description}</span>
                  </div>
                </td>
                <td>{product.sku}</td>
                <td>{product.category}</td>
                <td>{formatCurrency(product.price, product.currency)}</td>
                <td>
                  <Badge tone={product.status === 'published' ? 'success' : 'warning'}>{product.status}</Badge>
                </td>
                <td>{formatDate(product.createdAt)}</td>
                <td>
                  <div className="row gap-xs">
                    <Button variant="ghost" size="sm" onClick={() => onView(product.id)}>
                      View
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => onEdit(product.id)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => onDelete(product.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
