import type { AgentType } from '../types'

export interface AgentTypeOption {
  value: AgentType
  label: string
  shortDescription: string
  details: string
  available: boolean
}

export const AGENT_TYPE_OPTIONS: AgentTypeOption[] = [
  {
    value: 'terminal',
    label: 'Terminal Agent',
    shortDescription: 'General order desk agent for your internal team workflow.',
    details: 'Best for staff-assisted calls and fast order capture in your terminal or operator console.',
    available: true
  },
  {
    value: 'table_order_taker',
    label: 'Table Order Taker Agent',
    shortDescription: 'QR-based table ordering assistant for dine-in customers.',
    details: 'Customers scan a table QR and place orders directly from mobile with the live agent.',
    available: true
  },
  {
    value: 'whatsapp_call_attendant',
    label: 'WhatsApp Call Attendant Agent',
    shortDescription: 'Handle inbound WhatsApp voice calls with AI assistance.',
    details: 'Coming soon. Use this when WhatsApp call intake is enabled for your workspace.',
    available: false
  }
]

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  terminal: 'Terminal Agent',
  table_order_taker: 'Table Order Taker',
  whatsapp_call_attendant: 'WhatsApp Call Attendant'
}

