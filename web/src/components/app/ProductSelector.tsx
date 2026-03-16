import { useMemo, useState } from 'react'
import type { Product } from '../../types'

interface ProductSelectorProps {
  products: Product[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export const ProductSelector = ({ products, selectedIds, onChange }: ProductSelectorProps) => {
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () => products.filter((product) => product.name.toLowerCase().includes(query.toLowerCase())),
    [products, query],
  )

  const selectedProducts = products.filter((product) => selectedIds.includes(product.id))

  return (
    <section className="stack-sm">
      <input
        className="input"
        placeholder="Search products"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="chip-wrap">
        {selectedProducts.map((product) => (
          <button
            className="chip"
            key={product.id}
            onClick={() => onChange(selectedIds.filter((id) => id !== product.id))}
          >
            {product.name} x
          </button>
        ))}
      </div>

      <div className="selector-list">
        {filtered.map((product) => {
          const checked = selectedIds.includes(product.id)
          return (
            <label key={product.id} className="selector-item">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  if (checked) onChange(selectedIds.filter((id) => id !== product.id))
                  else onChange([...selectedIds, product.id])
                }}
              />
              <span>{product.name}</span>
            </label>
          )
        })}
      </div>
    </section>
  )
}
