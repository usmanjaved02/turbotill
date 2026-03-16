import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DeleteConfirmModal } from '../../components/app/DeleteConfirmModal'
import { ProductCard } from '../../components/app/ProductCard'
import { ProductTable } from '../../components/app/ProductTable'
import { Button } from '../../components/common/Button'
import { Skeleton } from '../../components/common/Skeleton'
import { useApp } from '../../context/AppContext'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { api, ApiClientError } from '../../services/api'
import type { CurrencyCode, ProductInput, ProductStatus } from '../../types'
import { formatCurrency } from '../../utils/format'

const CSV_HEADERS = ['name', 'sku', 'category', 'description', 'price', 'currency', 'discount', 'status', 'image'] as const
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const escapeCsvCell = (value: string | number | undefined) => {
  const raw = String(value ?? '')
  if (!raw.includes(',') && !raw.includes('"') && !raw.includes('\n') && !raw.includes('\r')) {
    return raw
  }
  return `"${raw.replaceAll('"', '""')}"`
}

const downloadCsvFile = (filename: string, rows: string[][]) => {
  const content = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const parseCsvContent = (content: string): string[][] => {
  const rows: string[][] = []
  let currentCell = ''
  let currentRow: string[] = []
  let inQuotes = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const next = content[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim())
      currentCell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1
      }
      currentRow.push(currentCell.trim())
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow)
      }
      currentCell = ''
      currentRow = []
      continue
    }

    currentCell += char
  }

  currentRow.push(currentCell.trim())
  if (currentRow.some((cell) => cell !== '')) {
    rows.push(currentRow)
  }

  return rows
}

const parseProductCsv = (content: string): ProductInput[] => {
  const rows = parseCsvContent(content)
  if (rows.length < 2) {
    throw new Error('CSV file is empty. Add at least one product row.')
  }

  const header = rows[0].map((cell) => cell.toLowerCase())
  const requiredColumns = ['name', 'sku', 'category', 'description', 'price']
  const missingColumns = requiredColumns.filter((column) => !header.includes(column))

  if (missingColumns.length > 0) {
    throw new Error(`Missing required column(s): ${missingColumns.join(', ')}`)
  }

  const readColumn = (row: string[], name: string) => {
    const index = header.indexOf(name)
    return index >= 0 ? (row[index] ?? '').trim() : ''
  }

  const seenSku = new Set<string>()
  return rows.slice(1).map((row, rowIndex) => {
    const rowNo = rowIndex + 2
    const name = readColumn(row, 'name')
    const sku = readColumn(row, 'sku')
    const category = readColumn(row, 'category')
    const description = readColumn(row, 'description')
    const priceRaw = readColumn(row, 'price')
    const currencyRaw = readColumn(row, 'currency').toUpperCase()
    const discountRaw = readColumn(row, 'discount')
    const statusRaw = readColumn(row, 'status').toLowerCase()
    const image = readColumn(row, 'image')

    if (!name || !sku || !category || !description || !priceRaw) {
      throw new Error(`Row ${rowNo}: name, sku, category, description, and price are required.`)
    }

    const normalizedSku = sku.toLowerCase()
    if (seenSku.has(normalizedSku)) {
      throw new Error(`Row ${rowNo}: duplicate SKU "${sku}" found in file.`)
    }
    seenSku.add(normalizedSku)

    const price = Number(priceRaw)
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Row ${rowNo}: price must be greater than 0.`)
    }

    const currency: CurrencyCode = currencyRaw === '' ? 'USD' : (currencyRaw as CurrencyCode)
    if (!['USD', 'EUR', 'GBP'].includes(currency)) {
      throw new Error(`Row ${rowNo}: currency must be USD, EUR, or GBP.`)
    }

    let discount: number | undefined
    if (discountRaw) {
      const parsedDiscount = Number(discountRaw)
      if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 90) {
        throw new Error(`Row ${rowNo}: discount must be between 0 and 90.`)
      }
      discount = parsedDiscount
    }

    const status: ProductStatus = statusRaw === '' ? 'published' : (statusRaw as ProductStatus)
    if (!['draft', 'published', 'archived'].includes(status)) {
      throw new Error(`Row ${rowNo}: status must be draft, published, or archived.`)
    }

    if (image) {
      try {
        new URL(image)
      } catch {
        throw new Error(`Row ${rowNo}: image must be a valid URL.`)
      }
    }

    return {
      name,
      sku,
      category,
      description,
      price,
      currency,
      ...(discount !== undefined ? { discount } : {}),
      status,
      ...(image ? { image } : {})
    }
  })
}

export const ProductsPage = () => {
  const {
    state: { products },
    deleteProduct,
    createProductsBulk,
    openShopifyModal,
    pushToast,
    appLoading,
  } = useApp()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('newest')
  const [view, setView] = useState<'table' | 'card'>('table')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [paginatedProducts, setPaginatedProducts] = useState<typeof products>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState<number>(10)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const csvInputRef = useRef<HTMLInputElement | null>(null)

  const debouncedQuery = useDebouncedValue(query)

  const categories = useMemo(() => Array.from(new Set(products.map((product) => product.category))), [products])
  const publishedCount = useMemo(() => products.filter((product) => product.status === 'published').length, [products])
  const draftCount = useMemo(() => products.filter((product) => product.status === 'draft').length, [products])
  const averagePrice = useMemo(() => {
    if (products.length === 0) {
      return 0
    }
    return products.reduce((sum, product) => sum + product.price, 0) / products.length
  }, [products])

  const fetchProducts = useCallback(
    async (targetPage: number) => {
      setListLoading(true)
      setListError(null)
      try {
        const result = await api.products.list({
          page: targetPage,
          limit,
          q: debouncedQuery.trim() || undefined,
          category: category === 'all' ? undefined : category,
          status: status === 'all' ? undefined : (status as ProductStatus),
          sort: sort as 'newest' | 'oldest' | 'price' | 'name'
        })

        const resolvedTotal = result.total ?? result.products.length
        const resolvedTotalPages = Math.max((result.totalPages ?? Math.ceil(resolvedTotal / limit)) || 1, 1)

        if (targetPage > resolvedTotalPages && resolvedTotal > 0) {
          setPage(resolvedTotalPages)
          return
        }

        setPaginatedProducts(result.products)
        setTotal(resolvedTotal)
        setTotalPages(resolvedTotalPages)
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : 'Unable to load products right now. Please try again.'
        setListError(message)
      } finally {
        setListLoading(false)
      }
    },
    [limit, debouncedQuery, category, status, sort]
  )

  useEffect(() => {
    void fetchProducts(page)
  }, [fetchProducts, page])

  useEffect(() => {
    if (page !== 1) {
      setPage(1)
    }
  }, [debouncedQuery, category, status, sort, limit, page])

  const hasActiveFilter = Boolean(debouncedQuery.trim()) || category !== 'all' || status !== 'all'
  const visibleCountLabel = hasActiveFilter
    ? `${total} matching current filters`
    : `${total} products in catalog`

  const handleTemplateDownload = () => {
    downloadCsvFile('products-template.csv', [Array.from(CSV_HEADERS)])
  }

  const handleUploadCsvClick = () => {
    csvInputRef.current?.click()
  }

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setBulkUploading(true)
    try {
      const content = await file.text()
      const parsedProducts = parseProductCsv(content)
      if (parsedProducts.length === 0) {
        throw new Error('CSV file has no valid rows to import.')
      }

      await createProductsBulk(parsedProducts)
      if (page !== 1) {
        setPage(1)
      } else {
        await fetchProducts(1)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process CSV file.'
      pushToast({
        type: 'error',
        title: 'CSV upload failed',
        message
      })
    } finally {
      event.target.value = ''
      setBulkUploading(false)
    }
  }

  return (
    <div className="stack-lg">
      <section className="card products-hero">
        <div className="split-row">
          <div className="stack-sm">
            <span className="section-kicker">Catalog Workspace</span>
            <h1>Products</h1>
            <p className="muted products-hero-copy">
              Keep your order catalog clean, searchable, and ready for agents. Products you manage here become the
              inventory your agents can actually sell.
            </p>
          </div>
          <div className="row gap-sm wrap">
            <Button variant="secondary" onClick={openShopifyModal}>
              Connect Shopify (Coming Soon)
            </Button>
            <Button variant="ghost" onClick={handleTemplateDownload}>
              Download CSV Template
            </Button>
            <Button variant="secondary" onClick={handleUploadCsvClick} disabled={bulkUploading || appLoading}>
              {bulkUploading ? 'Uploading CSV...' : 'Upload CSV'}
            </Button>
            <Button onClick={() => navigate('/app/products/new')}>Add Product</Button>
          </div>
        </div>
        <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={handleCsvUpload} />
        <div className="products-kpi-grid">
          <article className="products-kpi-card">
            <span>Total catalog</span>
            <strong>{products.length}</strong>
            <p>{visibleCountLabel}</p>
          </article>
          <article className="products-kpi-card">
            <span>Published</span>
            <strong>{publishedCount}</strong>
            <p>Ready for live agent selling</p>
          </article>
          <article className="products-kpi-card">
            <span>Draft items</span>
            <strong>{draftCount}</strong>
            <p>Products not live yet</p>
          </article>
          <article className="products-kpi-card">
            <span>Average price</span>
            <strong>{formatCurrency(averagePrice || 0)}</strong>
            <p>Average unit price in catalog</p>
          </article>
        </div>
      </section>

      <section className="card products-controls">
        <div className="products-controls-top">
          <div className="products-search-shell">
            <input
              className="input"
              placeholder="Search by product name or SKU"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <p className="muted">Quickly narrow the catalog before assigning products to agents.</p>
          </div>
          <div className="products-view-switch">
            <Button size="sm" variant={view === 'table' ? 'primary' : 'secondary'} onClick={() => setView('table')}>
              Table
            </Button>
            <Button size="sm" variant={view === 'card' ? 'primary' : 'secondary'} onClick={() => setView('card')}>
              Cards
            </Button>
          </div>
        </div>
        <div className="products-filter-grid">
          <label className="products-filter">
            <span>Category</span>
            <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="products-filter">
            <span>Status</span>
            <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="products-filter">
            <span>Sort by</span>
            <select className="input" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="price">Price</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card products-banner">
        <div>
          <strong>Shopify catalog sync is on the roadmap</strong>
          <p className="muted">Join the waitlist to get automatic product import and inventory sync when it launches.</p>
        </div>
        <Button variant="ghost" onClick={openShopifyModal}>
          Join waitlist
        </Button>
      </section>

      {listError ? (
        <section className="card">
          <p className="muted">{listError}</p>
        </section>
      ) : listLoading ? (
        <div className="stack-sm">
          <Skeleton height={24} />
          <Skeleton height={24} />
          <Skeleton height={24} />
        </div>
      ) : paginatedProducts.length === 0 ? (
        <section className="card products-empty-state">
          <div className="products-empty-body">
            <div className="stack-sm">
              <span className="section-kicker">Catalog is empty</span>
              <h2>No products yet</h2>
              <p className="muted">
                Add your first product to start assigning inventory to agents, capturing orders accurately, and keeping
                pricing consistent across every ordering channel.
              </p>
              <div className="products-empty-actions">
                <Button onClick={() => navigate('/app/products/new')}>Add first product</Button>
                <Button variant="secondary" onClick={openShopifyModal}>
                  Join Shopify waitlist
                </Button>
              </div>
            </div>
            <div className="products-empty-checklist">
              <div>
                <strong>Recommended first setup</strong>
                <p>Create a small starter catalog before building your first agent.</p>
              </div>
              <ul>
                <li>Add product name, SKU, and category</li>
                <li>Set live price and product status</li>
                <li>Publish the product so agents can sell it</li>
              </ul>
            </div>
          </div>
        </section>
      ) : view === 'table' ? (
        <ProductTable
          products={paginatedProducts}
          onView={(id) => navigate(`/app/products/${id}`)}
          onEdit={(id) => navigate(`/app/products/${id}/edit`)}
          onDelete={setDeleteId}
        />
      ) : (
        <div className="grid two-col">
          {paginatedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onView={(id) => navigate(`/app/products/${id}`)}
              onEdit={(id) => navigate(`/app/products/${id}/edit`)}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      )}

      {!listLoading && total > 0 ? (
        <section className="card">
          <div className="split-row">
            <p className="muted">
              Page {page} of {totalPages} • {total} product{total === 1 ? '' : 's'}
            </p>
            <div className="row gap-sm wrap">
              <label className="row gap-xs">
                <span className="muted">Per page</span>
                <select className="input" value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="ghost" onClick={() => setPage((prev) => Math.max(prev - 1, 1))} disabled={page === 1}>
                Previous
              </Button>
              <Button
                variant="secondary"
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <DeleteConfirmModal
        open={Boolean(deleteId)}
        description="This action will remove the product and update agent access lists."
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return
          await deleteProduct(deleteId)
          if (paginatedProducts.length === 1 && page > 1) {
            setPage((prev) => Math.max(prev - 1, 1))
          } else {
            await fetchProducts(page)
          }
          setDeleteId(null)
        }}
      />
    </div>
  )
}
