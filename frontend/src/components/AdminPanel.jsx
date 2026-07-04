import { useState, useEffect, useRef } from 'react'
import { Star, BarChart3, ShieldAlert, Diamond, Circle } from 'lucide-react'
import Modal from './Modal'

/**
 * AdminPanel — Research panel with two tabs:
 *   MÉTRICAS — AERI + G-Eval scores per turn
 *   RIESGO   — Clinical risk classification per turn
 */

// ── Metrics tab ───────────────────────────────────────────────────────────────

const METRICS = [
  { key: 'perspective_taking',       label: 'Perspective Taking',       abbr: 'PT',  cls: 'g', note: '',              invert: false },
  { key: 'fantasy',                  label: 'Fantasy',                  abbr: 'FT',  cls: 'g', note: '',              invert: false },
  { key: 'personal_distress',        label: 'Personal Distress',        abbr: 'PD',  cls: 'r', note: '↓ menor=mejor', invert: true  },
  { key: 'relevance',                label: 'Relevance',                abbr: 'REL', cls: 'c', note: '',              invert: false },
  { key: 'semantically_appropriate', label: 'Semantically Approp.',     abbr: 'SA',  cls: 'c', note: '',              invert: false },
]

function ScoreBar({ score, cls, invert }) {
  const pct = invert ? ((6 - score) / 5) * 100 : (score / 5) * 100
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.width = '0%'
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => { el.style.width = `${pct}%` })
    )
    return () => cancelAnimationFrame(id)
  }, [pct])

  return (
    <div className="ap-bar-wrap">
      <div ref={ref} className={`ap-bar-fill ap-${cls}`} style={{ width: '0%' }} />
    </div>
  )
}

function EvalCard({ turn, evaluation, text }) {
  if (!evaluation) return null
  const composite = evaluation.composite_score ?? 'N/A'

  return (
    <div className="ap-card">
      <p className="ap-response-preview">
        <span className="ap-preview-label">AIMO:</span> {text.slice(0, 100)}{text.length > 100 ? '…' : ''}
      </p>

      <div className="ap-card-hdr">
        <span className="ap-turn">TURNO {turn}</span>
        <div className="ap-composite-wrap">
          <span className="ap-composite-label"><Diamond size={11} aria-hidden /> SCORE COMPUESTO</span>
          <span className="ap-composite-score">{composite}<span className="ap-den">/5</span></span>
        </div>
      </div>

      <div className="ap-formula-hint">
        Ponderado: PT×0.30 + REL×0.25 + (6−PD)×0.20 + SA×0.15 + FT×0.10
      </div>

      <div className="ap-metrics-list">
        {METRICS.map(({ key, label, abbr, cls, note, invert }) => {
          const m = evaluation[key]
          if (!m) return null
          return (
            <div className="ap-metric" key={key}>
              <div className="ap-metric-row">
                <span className={`ap-abbr ap-${cls}`}>{abbr}</span>
                <span className="ap-metric-label">{label}</span>
                <span className={`ap-score ap-${cls}`}>{m.score}<span className="ap-den">/5</span></span>
                {note && <span className="ap-note">{note}</span>}
              </div>
              <ScoreBar score={m.score} cls={cls} invert={invert} />
              <p className="ap-just">» {m.justification}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Risk tab ──────────────────────────────────────────────────────────────────

const RISK_META = {
  low:    { cls: 'risk-low',    label: 'BAJO',  color: '#22c55e' },
  medium: { cls: 'risk-medium', label: 'MEDIO', color: '#eab308' },
  high:   { cls: 'risk-high',   label: 'ALTO',  color: '#ef4444' },
}

const ACTION_META = {
  continue: { cls: 'action-continue', label: 'CONTINUAR' },
  caution:  { cls: 'action-caution',  label: 'PRECAUCIÓN' },
  escalate: { cls: 'action-escalate', label: 'ESCALAR' },
}

function RiskCard({ turn, classification, text }) {
  if (!classification) return null
  const { risk_level, signals = [], recommended_action } = classification
  const risk   = RISK_META[risk_level]   ?? RISK_META.medium
  const action = ACTION_META[recommended_action] ?? ACTION_META.caution

  return (
    <div className="ap-card">
      <p className="ap-response-preview">
        <span className="ap-preview-label">AIMO:</span> {text.slice(0, 100)}{text.length > 100 ? '…' : ''}
      </p>

      <div className="ap-card-hdr">
        <span className="ap-turn">TURNO {turn}</span>
        <span className={`em-badge ${action.cls}`}>{action.label}</span>
      </div>

      <div className="em-grid">
        <div className="em-field">
          <span className="em-label">NIVEL DE RIESGO</span>
          <span className={`em-badge ${risk.cls}`}>
            <Circle size={11} fill={risk.color} color={risk.color} aria-hidden /> {risk.label}
          </span>
        </div>
      </div>

      {signals.length > 0 && (
        <div className="em-signals">
          <span className="em-label">SEÑALES DETECTADAS</span>
          <ul className="em-signals-list">
            {signals.map((s, i) => (
              <li key={i} className="em-signal-item">» {s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function AdminPanel({ messages, onClose }) {
  const [activeTab, setActiveTab] = useState('metricas')

  const aimoMessages = messages.filter(m => m.role === 'aimo')

  const evals = aimoMessages
    .map((m, i) => ({ turn: i + 1, evaluation: m.evaluation, text: m.text }))
    .filter(e => e.evaluation)

  const risks = aimoMessages
    .map((m, i) => ({ turn: i + 1, classification: m.classification, text: m.text }))
    .filter(e => e.classification)

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={<><Star size={15} aria-hidden /> PANEL ADMIN — INVESTIGACIÓN</>}
      ariaLabel="Panel de métricas"
      panelClassName="ap-panel admin-panel"
      closeAriaLabel="Cerrar panel"
    >
        {/* Tabs */}
        <div className="ap-tabs">
          <button
            className={`ap-tab${activeTab === 'metricas' ? ' ap-tab-active' : ''}`}
            onClick={() => setActiveTab('metricas')}
          >
            <BarChart3 size={13} aria-hidden /> MÉTRICAS {evals.length > 0 && `(${evals.length})`}
          </button>
          <button
            className={`ap-tab${activeTab === 'riesgo' ? ' ap-tab-active' : ''}`}
            onClick={() => setActiveTab('riesgo')}
          >
            <ShieldAlert size={13} aria-hidden /> RIESGO {risks.length > 0 && `(${risks.length})`}
          </button>
        </div>

        <div className="ap-body">

          {activeTab === 'metricas' && (
            <>
              <div className="ap-info-banner" style={{ marginTop: 0 }}>
                <span><BarChart3 size={12} aria-hidden /> AERI (Lee &amp; Yi, 2023) · Relevance · Semantically Appropriate · Pesos: Davis (1980) + Abd-alrazaq (2019)</span>
              </div>

              {evals.length === 0 ? (
                <div className="ap-empty">
                  <span><Star size={32} aria-hidden /></span>
                  <p>No hay evaluaciones aún.<br />Conversa con AIMO para ver<br />las métricas aquí.</p>
                </div>
              ) : (
                evals.map(({ turn, evaluation, text }) => (
                  <EvalCard key={turn} turn={turn} evaluation={evaluation} text={text} />
                ))
              )}
            </>
          )}

          {activeTab === 'riesgo' && (
            <>
              <div className="ap-info-banner" style={{ marginTop: 0 }}>
                <span><ShieldAlert size={12} aria-hidden /> Clasificación de riesgo clínico · SPRC (2014) · WHO-DAS (2010) · aimo_classifier</span>
              </div>

              {risks.length === 0 ? (
                <div className="ap-empty">
                  <span><ShieldAlert size={32} aria-hidden /></span>
                  <p>La clasificación de riesgo<br />aparecerá al finalizar<br />la conversación.</p>
                </div>
              ) : (
                risks.map(({ turn, classification, text }) => (
                  <RiskCard key={turn} turn={turn} classification={classification} text={text} />
                ))
              )}
            </>
          )}

        </div>
    </Modal>
  )
}