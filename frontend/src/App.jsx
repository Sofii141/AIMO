/**
 * App — Componente raíz de AIMO.
 *
 * Gestiona el flujo de fases de la conversación, el historial de mensajes,
 * y los modales de investigación (AdminPanel, RecommendationsModal).
 *
 * Fases:
 *   intro      — pausa inicial antes de habilitar el input
 *   user_turn  — esperando mensaje del usuario
 *   loading    — petición en curso al backend
 *   responding — AIMO escribiendo la respuesta (typewriter en chat)
 *   complete   — pipeline finalizado, input deshabilitado
 */
import { useState, useEffect, useRef } from "react";
import WorldBackground from "./components/WorldBackground";
import AimoCharacter from "./components/AimoCharacter";
import SpeechBubble from "./components/SpeechBubble";
import MessageItem from "./components/MessageItem";
import UserInput from "./components/UserInput";
import AdminPanel from "./components/AdminPanel";
import RecommendationsModal from "./components/RecommendationsModal";
import { RotateCcw, Star, Sparkles, AlertTriangle } from "lucide-react";
import { sendMessage, resetSession, ApiError } from "./services/api";
import "./App.css";

const PHASES = {
  INTRO:    "intro",
  USER:     "user_turn",
  LOAD:     "loading",
  RESPOND:  "responding",
  COMPLETE: "complete",
};

/**
 * Modo mock controlado por env. Si VITE_USE_MOCK === 'true' se usan respuestas
 * simuladas; por defecto (ausencia o cualquier otro valor) se llama al API real.
 */
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

/**
 * Disclaimers éticos/legales de la UI. Cada uno es fuente única para los lugares
 * que deben decir lo mismo, sin forzar que todos usen el mismo texto:
 *   FULL  — versión completa bajo el personaje.
 *   SHORT — versión compacta para el título del chat y el footer.
 */
const DISCLAIMER_FULL =
  "AIMO puede cometer errores. Sus respuestas son orientativas y no reemplazan la atención de un profesional de salud mental.";
const DISCLAIMER_SHORT =
  "AIMO puede cometer errores · No reemplaza a un profesional de salud mental";

/**
 * Respuesta mock para desarrollo sin backend (VITE_USE_MOCK=true).
 * Refleja el contrato real que consume el resto de la app: métricas AERI
 * actuales (relevance + semantically_appropriate, sin empathic_concern),
 * clasificación de riesgo/emoción, cadena de pensamiento y cierre de pipeline
 * con recomendaciones — para que AdminPanel y RecommendationsModal
 * se vean completos.
 */
function mockResponse() {
  return {
    response:
      "Escucho que estás cargando algo que pesa. No tienes que enfrentarlo solo. ¿Qué es lo que sientes con más fuerza ahora mismo?",
    evaluation: {
      composite_score: 3.9,
      perspective_taking: {
        score: 4,
        justification:
          "El agente refleja el estado emocional del usuario de forma contextualizada.",
      },
      fantasy: {
        score: 3,
        justification: "La respuesta usa lenguaje empático funcional.",
      },
      personal_distress: {
        score: 2,
        justification:
          "El agente mantiene la compostura, con mínima reactividad emocional.",
      },
      relevance: {
        score: 4,
        justification:
          "La respuesta se mantiene en el tema que trae el usuario y lo profundiza.",
      },
      semantically_appropriate: {
        score: 4,
        justification:
          "Transmite calidez y seguridad psicológica, sin positividad tóxica.",
      },
    },
    classification: {
      emotion: "sadness",
      intensity: 3,
      crisis_signal: false,
      risk_level: "medium",
      signals: [
        "Menciona sentir una carga emocional sostenida",
        "Lenguaje que sugiere sentirse sobrepasado",
      ],
      recommended_action: "caution",
    },
    pipeline_complete: true,
    recommendations:
      "Basado en lo que compartiste, aquí tienes algunas ideas para esta semana:\n\n" +
      "1. Habla con alguien de confianza sobre lo que estás sintiendo.\n" +
      "2. Prueba una pausa breve de respiración cuando la carga se sienta intensa.\n" +
      "3. Considera agendar una cita con un profesional de salud mental.\n\n" +
      "Recuerda: pedir ayuda es un acto de fuerza, no de debilidad. No estás solo en esto.",
  };
}

export default function App() {
  // ── Estado de la conversación ──────────────────────────────────────────────
  const [phase,          setPhase]          = useState(PHASES.INTRO);
  const [messages,       setMessages]       = useState([]);
  const [typingMsgIndex, setTypingMsgIndex] = useState(-1);

  // ── Estado de modales ──────────────────────────────────────────────────────
  const [adminOpen,        setAdminOpen]        = useState(false);
  const [recsOpen,         setRecsOpen]         = useState(false);

  // ── Estado del pipeline (añadido por compañeros) ───────────────────────────
  /** Texto de las recomendaciones finales generadas al cerrar el pipeline */
  const [finalRecs,        setFinalRecs]        = useState(null);
  /** true cuando el backend indica que la conversación ha terminado */
  const [pipelineComplete, setPipelineComplete] = useState(false);
  /** Aviso sutil cuando el reset del backend no se pudo confirmar */
  const [resetWarning,     setResetWarning]     = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const sessionId      = useRef(`s_${Date.now()}`);
  const convoBottomRef = useRef(null);

  // ── Efectos ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Pausa breve de intro; la burbuja de AIMO es estática, no necesita typewriter
    const t = setTimeout(() => setPhase(PHASES.USER), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Only snap to bottom when a new user message is added.
    // AIMO's typing scroll is handled inside MessageItem (per character).
    convoBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSend = async (userMsg) => {
    setPhase(PHASES.LOAD);
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);

    try {
      let data;
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 1800));
        data = mockResponse();
      } else {
        data = await sendMessage(userMsg, sessionId.current);
      }

      const newMsg = {
        role:           "aimo",
        text:           data.response,
        evaluation:     data.evaluation     ?? null,
        classification: data.classification ?? null,  // clasificación de riesgo (compañeros)
      };

      setMessages((prev) => {
        const next = [...prev, newMsg];
        setTypingMsgIndex(next.length - 1);
        return next;
      });
      setPhase(PHASES.RESPOND);

      // Si el backend indica que el pipeline terminó (compañeros)
      if (data.pipeline_complete) {
        setFinalRecs(data.recommendations ?? null);
        setPipelineComplete(true);
        if (data.recommendations) setRecsOpen(true);
      }

    } catch (err) {
      console.error("[AIMO]", err);
      // El servidor respondió pero con error (HTTP) vs. no hubo conexión/timeout.
      const isServerError = err instanceof ApiError && err.kind === "http";
      const errMsg = isServerError
        ? "¡Ups! Mis servidores tuvieron un problema procesando tu mensaje. Dame un momento e inténtalo otra vez."
        : "¡Ups! No pude conectarme (parece un problema de conexión o tardé demasiado). ¿Puedes intentarlo de nuevo?";
      setMessages((prev) => {
        const next = [...prev, { role: "aimo", text: errMsg }];
        setTypingMsgIndex(next.length - 1);
        return next;
      });
      setPhase(PHASES.RESPOND);
    }
  };

  /** Llamado por MessageItem cuando termina su animación typewriter */
  const handleTypingDone = () => {
    setTypingMsgIndex(-1);
    setPhase(pipelineComplete ? PHASES.COMPLETE : PHASES.USER);
  };

  const handleReset = async () => {
    setResetWarning(false);
    if (!USE_MOCK) {
      try {
        await resetSession(sessionId.current);
      } catch (err) {
        console.error("[AIMO reset]", err);
        // El reset local sigue adelante, pero avisamos que el backend no confirmó.
        setResetWarning(true);
        setTimeout(() => setResetWarning(false), 6000);
      }
    }
    sessionId.current = `s_${Date.now()}`;
    setMessages([]);
    setTypingMsgIndex(-1);
    setFinalRecs(null);
    setPipelineComplete(false);
    setRecsOpen(false);
    setPhase(PHASES.USER);
  };

  const evalCount = messages.filter(
    (m) => m.role === "aimo" && m.evaluation,
  ).length;

  const isComplete = phase === PHASES.COMPLETE || pipelineComplete;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="game-root">
      <WorldBackground />

      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-brand" aria-label="AIMO">
          <span className="brand-pixel" aria-hidden />
          <span className="brand-name">AIMO</span>
        </div>

        <div className="top-right-hud">
          <button
            className="hud-btn"
            onClick={handleReset}
            aria-label="Reiniciar conversación"
          >
            <span className="admin-icon"><RotateCcw size={14} aria-hidden /></span>
            <span className="admin-label">REINICIAR</span>
          </button>

          <button
            className="hud-btn"
            onClick={() => setAdminOpen(true)}
            aria-label="Panel de métricas AERI"
          >
            <span className="admin-icon"><Star size={14} aria-hidden /></span>
            <span className="admin-label">ADMIN</span>
            {evalCount > 0 && <span className="admin-badge">{evalCount}</span>}
          </button>
        </div>
      </header>

      {/* ── Main: columna AIMO + columna chat ── */}
      <main className="app-main">
        <section className={`character-col phase-${phase}`}>
          <div className="speech-wrap-aimo">
            <SpeechBubble phase={phase} />
          </div>
          <AimoCharacter phase={phase} />
          <p className="aimo-disclaimer">{DISCLAIMER_FULL}</p>
        </section>

        <section className="chat-col">
          <div className="chat-title">
            <span className="chat-title-label">CONVERSACIÓN</span>
            <span className="chat-title-disclaimer">{DISCLAIMER_SHORT}</span>
          </div>
          <div className="chat-scroll" role="log" aria-live="polite">
            {messages.length === 0 ? (
              <div className="chat-empty">AIMO está listo para escucharte.</div>
            ) : (
              messages.map((msg, i) => (
                <MessageItem
                  key={i}
                  message={msg}
                  isTyping={i === typingMsgIndex}
                  onTypingDone={
                    i === typingMsgIndex ? handleTypingDone : undefined
                  }
                />
              ))
            )}
            {phase === PHASES.LOAD && (
              <div className="msg-bubble-wrap wrap-aimo">
                <div className="msg-pixel-bubble bubble-aimo typing-indicator">
                  <span className="dot-pulse" />
                  <span className="dot-pulse" />
                  <span className="dot-pulse" />
                </div>
              </div>
            )}
            <div ref={convoBottomRef} />
          </div>
        </section>
      </main>

      {/* ── Footer: input del usuario ── */}
      <footer className="rpg-input-col">
        <UserInput
          enabled={phase === PHASES.USER}
          complete={isComplete}
          onSend={handleSend}
        />
        <p className="footer-disclaimer">{DISCLAIMER_SHORT}</p>
      </footer>

      {/* ── Modales de investigación ── */}
      {adminOpen && (
        <AdminPanel messages={messages} onClose={() => setAdminOpen(false)} />
      )}

      {recsOpen && (
        <RecommendationsModal
          text={finalRecs}
          onClose={() => setRecsOpen(false)}
        />
      )}

      {/* Aviso sutil: el reset local se hizo, pero el backend no confirmó */}
      {resetWarning && (
        <div className="reset-warning-toast" role="status" aria-live="polite">
          <AlertTriangle size={14} aria-hidden /> Se reinició la conversación aquí, pero el servidor pudo no completar el reinicio.
        </div>
      )}

      {/* Botón flotante para reabrir recomendaciones tras cerrar el modal */}
      {pipelineComplete && !recsOpen && (
        <button
          className="rec-reopen-btn"
          onClick={() => setRecsOpen(true)}
          aria-label="Ver recomendaciones"
        >
          <Sparkles size={14} aria-hidden /> VER RECOMENDACIONES
        </button>
      )}
    </div>
  );
}