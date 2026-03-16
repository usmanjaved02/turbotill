import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactElement } from 'react'
import { ComingSoonModal } from '../components/app/ComingSoonModal'
import { ToastContainer } from '../components/common/ToastContainer'
import { useApp } from '../context/AppContext'
import { AppLayout } from '../layouts/AppLayout'
import { PublicLayout } from '../layouts/PublicLayout'
import { AboutPage } from '../pages/public/AboutPage'
import { ContactPage } from '../pages/public/ContactPage'
import { FeaturesPage } from '../pages/public/FeaturesPage'
import { HowItWorksPage } from '../pages/public/HowItWorksPage'
import { LandingPage } from '../pages/public/LandingPage'
import { PricingPage } from '../pages/public/PricingPage'
import { TableOrderPage } from '../pages/public/TableOrderPage'
import { LoginPage } from '../pages/auth/LoginPage'
import { SignupPage } from '../pages/auth/SignupPage'
import { DashboardPage } from '../pages/app/DashboardPage'
import { TourPage } from '../pages/app/TourPage'
import { ProductsPage } from '../pages/app/ProductsPage'
import { ProductNewPage } from '../pages/app/ProductNewPage'
import { ProductDetailPage } from '../pages/app/ProductDetailPage'
import { ProductEditPage } from '../pages/app/ProductEditPage'
import { AgentsPage } from '../pages/app/AgentsPage'
import { AgentNewPage } from '../pages/app/AgentNewPage'
import { AgentDetailPage } from '../pages/app/AgentDetailPage'
import { AgentEditPage } from '../pages/app/AgentEditPage'
import { AgentLivePage } from '../pages/app/AgentLivePage'
import { OrdersPage } from '../pages/app/OrdersPage'
import { OrderDetailPage } from '../pages/app/OrderDetailPage'
import { IntegrationsPage } from '../pages/app/IntegrationsPage'
import { AuditLogsPage } from '../pages/app/AuditLogsPage'
import { SettingsProfilePage } from '../pages/app/SettingsProfilePage'
import { SettingsWorkspacePage } from '../pages/app/SettingsWorkspacePage'
import { SettingsAgentsPage } from '../pages/app/SettingsAgentsPage'

const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const {
    state: { isAuthenticated },
    isBootstrapping
  } = useApp()
  const location = useLocation()
  if (isBootstrapping) return <div className="card">Loading workspace...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

const PublicOnlyRoute = ({ children }: { children: ReactElement }) => {
  const {
    state: { isAuthenticated },
    isBootstrapping
  } = useApp()

  if (isBootstrapping) return <div className="card">Loading workspace...</div>
  if (isAuthenticated) return <Navigate to="/app/dashboard" replace />
  return children
}

const NotFoundPage = () => <div className="card">Page not found.</div>

export const AppRouter = () => {
  const { shopifyModalOpen, closeShopifyModal } = useApp()

  return (
    <>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>

        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <SignupPage />
            </PublicOnlyRoute>
          }
        />

        <Route path="/table-order" element={<TableOrderPage />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="tour" element={<TourPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductNewPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="products/:id/edit" element={<ProductEditPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="agents/new" element={<AgentNewPage />} />
          <Route path="agents/:id" element={<AgentDetailPage />} />
          <Route path="agents/:id/edit" element={<AgentEditPage />} />
          <Route path="agents/:id/live" element={<AgentLivePage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="settings/profile" element={<SettingsProfilePage />} />
          <Route path="settings/workspace" element={<SettingsWorkspacePage />} />
          <Route path="settings/agents" element={<SettingsAgentsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <ComingSoonModal open={shopifyModalOpen} feature="Shopify Integration" onClose={closeShopifyModal} />
      <ToastContainer />
    </>
  )
}
