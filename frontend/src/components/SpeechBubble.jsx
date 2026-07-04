/**
 * SpeechBubble
 *
 * Muestra el texto de presentación de AIMO quemado.
 * Cuando la fase es "loading", oculta el texto (conservando su espacio para
 * no cambiar el tamaño de la burbuja) y muestra los tres puntos animados
 * centrados para indicar que AIMO está pensando.
 *
 * Props:
 *   phase: string — fase actual del juego ("intro" | "user_turn" | "loading" | "responding")
 */

const STATIC_TEXT =
  "¡Hola! Soy AIMO, tu compañero de apoyo emocional. Estoy aquí para escucharte sin juzgarte.";

export default function SpeechBubble({ phase }) {
  const isLoading = phase === "loading";

  return (
    <div
      className={`speech-bubble-pixel${isLoading ? " bubble-thinking" : ""}`}
      role="status"
      aria-live="polite"
    >
      {/* Texto quemado: se oculta (sin perder su espacio) mientras piensa */}
      <span
        className={`bubble-static-text${isLoading ? " bubble-text-hidden" : ""}`}
        aria-hidden={isLoading}
      >
        {STATIC_TEXT}
      </span>

      {/* Overlay de puntos: solo visible cuando AIMO está pensando */}
      {isLoading && (
        <span className="bubble-loading-overlay" aria-label="AIMO pensando">
          <span className="dot-pulse" />
          <span className="dot-pulse" />
          <span className="dot-pulse" />
        </span>
      )}
    </div>
  );
}