import type { ReactNode } from 'react'
import { useInView } from '../../hooks/useInView'

export const Reveal = ({ children }: { children: ReactNode }) => {
  const { ref, isInView } = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className={`reveal ${isInView ? 'visible' : ''}`}>
      {children}
    </div>
  )
}
