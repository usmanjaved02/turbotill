import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { Sidebar } from '../components/app/Sidebar'
import { SidebarOnboarding } from '../components/app/SidebarOnboarding'
import { Topbar } from '../components/app/Topbar'
import { Drawer } from '../components/common/Drawer'

export const AppLayout = () => {
  const [search, setSearch] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="app-shell">
      <Sidebar className="desktop-sidebar" />
      <div className="app-content">
        <Topbar onSearchChange={setSearch} onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="app-main">
          <Outlet context={{ search }} />
        </main>
      </div>
      <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Navigation">
        <Sidebar className="mobile-sidebar" onNavigate={() => setMobileNavOpen(false)} />
      </Drawer>
      <SidebarOnboarding />
    </div>
  )
}
