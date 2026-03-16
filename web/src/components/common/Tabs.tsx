import { type ReactNode } from 'react'

export interface TabItem {
  key: string
  label: string
  content: ReactNode
}

interface TabsProps {
  tabs: TabItem[]
  activeKey: string
  onChange: (key: string) => void
}

export const Tabs = ({ tabs, activeKey, onChange }: TabsProps) => {
  const activeTab = tabs.find((tab) => tab.key === activeKey) ?? tabs[0]

  return (
    <section className="tabs-wrap">
      <div className="tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            role="tab"
            key={tab.key}
            aria-selected={activeKey === tab.key}
            className={`tab-btn ${activeKey === tab.key ? 'active' : ''}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-panel">{activeTab.content}</div>
    </section>
  )
}
