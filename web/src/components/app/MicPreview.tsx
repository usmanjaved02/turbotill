import { useState } from 'react'
import { Button } from '../common/Button'
import { MicIcon } from '../common/Icons'

interface MicPreviewProps {
  embedded?: boolean
}

export const MicPreview = ({ embedded = false }: MicPreviewProps) => {
  const [listening, setListening] = useState(false)

  return (
    <section className={embedded ? 'stack-sm agent-embedded-block' : 'card stack-sm'}>
      <h3>Mic Agent Preview</h3>
      <p className="muted">Use our voice/mic interface where customers speak and orders are captured instantly.</p>
      <div className="mic-preview">
        <button className={`mic-btn ${listening ? 'active' : ''}`} aria-label="Microphone preview">
          <MicIcon />
        </button>
        <div>
          <p className="muted">Transcript</p>
          <div className="transcript-box">
            {listening
              ? 'Customer: I need two premium bean packs and one vanilla syrup.'
              : 'Press start listening to simulate voice intake.'}
          </div>
        </div>
        <div>
          <p className="muted">Captured Order Summary</p>
          <ul className="line-list">
            <li>Premium Arabica Beans 1kg x2</li>
            <li>Vanilla Syrup 500ml x1</li>
          </ul>
        </div>
      </div>
      <div className="row gap-sm">
        <Button type="button" onClick={() => setListening(true)} disabled={listening}>
          Start listening
        </Button>
        <Button type="button" variant="secondary" onClick={() => setListening(false)} disabled={!listening}>
          Stop listening
        </Button>
      </div>
    </section>
  )
}
