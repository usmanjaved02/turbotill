import { useState } from 'react'
import { Button } from '../common/Button'

interface ScriptEmbedCardProps {
  code: string
  onRegenerate: () => void
  embedded?: boolean
}

export const ScriptEmbedCard = ({ code, onRegenerate, embedded = false }: ScriptEmbedCardProps) => {
  const [copied, setCopied] = useState(false)

  return (
    <section className={embedded ? 'stack-sm agent-embedded-block' : 'card stack-sm'}>
      <h3>Script Embed</h3>
      <p className="muted">Use this snippet in any webpage to enable order-taking on your site.</p>
      <pre className="code-block">{code}</pre>
      <div className="row gap-sm">
        <Button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
          }}
        >
          {copied ? 'Copied' : 'Copy code'}
        </Button>
        <Button type="button" variant="secondary" onClick={onRegenerate}>
          Regenerate
        </Button>
      </div>
      <ol className="line-list">
        <li>Paste script before the closing body tag.</li>
        <li>Publish your page.</li>
        <li>Test with a sample order.</li>
      </ol>
    </section>
  )
}
