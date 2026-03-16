import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ProductForm } from '../../components/app/ProductForm'
import { useApp } from '../../context/AppContext'
import type { ProductInput } from '../../types'

export const ProductEditPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    state: { products },
    updateProduct,
    appLoading,
  } = useApp()

  const product = products.find((item) => item.id === id)
  if (!product) return <Navigate to="/app/products" replace />

  const handleSave = async (payload: ProductInput) => {
    await updateProduct(product.id, payload)
    navigate(`/app/products/${product.id}`)
  }

  return (
    <div className="stack-lg">
      <section>
        <h1>Edit Product</h1>
      </section>

      <ProductForm
        initialValue={product}
        loading={appLoading}
        onSubmit={handleSave}
        onSaveDraft={handleSave}
        onCancel={() => navigate(`/app/products/${product.id}`)}
        submitLabel="Save changes"
      />
    </div>
  )
}
