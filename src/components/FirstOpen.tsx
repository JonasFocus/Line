import { useEffect, useId, useRef, useState } from 'react'

import {
  nextFirstOpenSlide,
  normalizeWriterName,
  previousFirstOpenSlide,
  type FirstOpenSlide,
  WRITER_NAME_MAX_LENGTH,
} from '../firstOpen'

const SLIDES: FirstOpenSlide[] = [0, 1, 2]

type FirstOpenProps = {
  onComplete: (name: string) => void
}

function shortcut(keys: string) {
  return <kbd className="first-open-kbd">{keys}</kbd>
}

export function FirstOpen({ onComplete }: FirstOpenProps) {
  const headingId = useId()
  const inputId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const [slide, setSlide] = useState<FirstOpenSlide>(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [draftName, setDraftName] = useState('')
  const [leaving, setLeaving] = useState(false)
  const name = normalizeWriterName(draftName)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (slide === 0) inputRef.current?.focus()
      else nextRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [slide])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'),
      ).filter((node) => {
        const slideNode = node.closest('.first-open-slide')
        return !slideNode || slideNode.classList.contains('is-active')
      })
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    panel.addEventListener('keydown', onKeyDown)
    return () => panel.removeEventListener('keydown', onKeyDown)
  }, [slide])

  const go = (next: FirstOpenSlide) => {
    setDirection(next < slide ? 'back' : 'forward')
    setSlide(next)
  }

  const continueFromName = () => {
    if (!name) {
      inputRef.current?.focus()
      return
    }
    go(nextFirstOpenSlide(slide))
  }

  const finish = () => {
    if (!name || leaving) return
    setLeaving(true)
    window.setTimeout(() => onComplete(name), 220)
  }

  return (
    <div className={`first-open ${leaving ? 'is-leaving' : ''}`}>
      <div
        aria-labelledby={headingId}
        aria-modal="true"
        className="first-open-panel"
        data-direction={direction}
        ref={panelRef}
        role="dialog"
      >
        <div aria-label="Welcome steps" className="first-open-progress">
          {SLIDES.map((item) => (
            <span
              aria-current={item === slide ? 'step' : undefined}
              className={`first-open-dot ${item === slide ? 'is-current' : ''} ${item < slide ? 'is-done' : ''}`}
              key={item}
            />
          ))}
        </div>

        <div className="first-open-stage">
          <section
            aria-hidden={slide !== 0}
            className={`first-open-slide ${slide === 0 ? 'is-active' : ''}`}
          >
            <p className="first-open-kicker">Line</p>
            <h2 className="first-open-title" id={slide === 0 ? headingId : undefined}>What should we call you?</h2>
            <p className="first-open-copy">Kept on this Mac. Nothing is sent anywhere.</p>
            <label className="first-open-field" htmlFor={inputId}>
              <span className="sr-only">Your name</span>
              <input
                autoCapitalize="words"
                autoComplete="name"
                id={inputId}
                maxLength={WRITER_NAME_MAX_LENGTH}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    continueFromName()
                  }
                }}
                placeholder="Your name"
                ref={inputRef}
                spellCheck={false}
                tabIndex={slide === 0 ? 0 : -1}
                value={draftName}
              />
            </label>
          </section>

          <section
            aria-hidden={slide !== 1}
            className={`first-open-slide ${slide === 1 ? 'is-active' : ''}`}
          >
            <p className="first-open-kicker">Welcome</p>
            <h2 className="first-open-title" id={slide === 1 ? headingId : undefined}>
              Hello{name ? `, ${name}` : ''}.
            </h2>
            <p className="first-open-copy">
              Line is a quiet Markdown workspace. Your files stay on disk, and the library is only a way to find them.
            </p>
          </section>

          <section
            aria-hidden={slide !== 2}
            className={`first-open-slide ${slide === 2 ? 'is-active' : ''}`}
          >
            <p className="first-open-kicker">Start</p>
            <h2 className="first-open-title" id={slide === 2 ? headingId : undefined}>Three things to know.</h2>
            <ul className="first-open-guide">
              <li>
                <span>New document</span>
                {shortcut('⌘N')}
              </li>
              <li>
                <span>Save to disk</span>
                {shortcut('⌘S')}
              </li>
              <li>
                <span>Preview Markdown</span>
                {shortcut('⌘3')}
              </li>
            </ul>
          </section>
        </div>

        <div className="first-open-actions">
          {slide > 0 ? (
            <button
              className="first-open-back"
              onClick={() => go(previousFirstOpenSlide(slide))}
              type="button"
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {slide === 0 ? (
            <button className="first-open-next" disabled={!name} onClick={continueFromName} ref={nextRef} type="button">
              Continue
            </button>
          ) : slide === 1 ? (
            <button className="first-open-next" onClick={() => go(2)} ref={nextRef} type="button">
              Continue
            </button>
          ) : (
            <button className="first-open-next" onClick={finish} ref={nextRef} type="button">
              Start writing
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
