import { Sparkles } from 'lucide-react'
import Modal from './Modal'

// Detecta URLs http(s) para convertirlas en enlaces clicables.
const URL_RE = /(https?:\/\/[^\s]+)/g

/**
 * Convierte el texto de una línea en nodos React, transformando cualquier
 * URL en un enlace clicable que abre en una pestaña nueva. El resto del
 * texto se mantiene tal cual.
 */
function linkify(line) {
  return line.split(URL_RE).map((part, i) => {
    if (URL_RE.test(part)) {
      URL_RE.lastIndex = 0 // el flag /g mantiene estado entre .test()
      return (
        <a
          key={i}
          className="rec-link"
          href={part}
          target="_blank"
          rel="noopener noreferrer"
        >
          {part}
        </a>
      )
    }
    return part
  })
}

/**
 * RecommendationsModal — Shows the final AIMO recommendations in a
 * scrollable, readable panel. Auto-opens when the pipeline completes.
 */
export default function RecommendationsModal({ text, onClose }) {
  // Split on newlines so numbered lists and paragraphs render correctly
  const lines = (text ?? '').split('\n')

  return (
    <Modal
      isOpen={!!text}
      onClose={onClose}
      title={<><Sparkles size={15} aria-hidden /> RECOMENDACIONES DE AIMO</>}
      ariaLabel="Recomendaciones de AIMO"
      overlayClassName="rec-overlay"
      panelClassName="rec-panel"
      headerClassName="rec-header"
      titleClassName="rec-title"
    >
      {/* Content */}
      <div className="rec-body">
        {lines.map((line, i) => {
          const trimmed = line.trim()
          if (!trimmed) return <div key={i} className="rec-spacer" />
          // Ocultar las líneas separadoras (--- / *** / ___) del prompt
          if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) return null
          // Style numbered items (1. 2. 3.) differently
          const isItem = /^\d+\./.test(trimmed)
          return (
            <p key={i} className={isItem ? 'rec-item' : 'rec-text2'}>
              {linkify(trimmed)}
            </p>
          )
        })}
      </div>

      {/* Footer */}
      <div className="rec-footer">
        <span className="rec-footer-note"><Sparkles size={12} aria-hidden /> CONVERSACIÓN FINALIZADA — Reinicia para comenzar de nuevo</span>
      </div>
    </Modal>
  )
}