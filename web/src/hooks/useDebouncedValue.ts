import { useEffect, useState } from 'react'

export const useDebouncedValue = <T>(value: T, delay = 250) => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])

  return debounced
}
