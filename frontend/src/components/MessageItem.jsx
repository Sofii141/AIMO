import { useEffect, useRef } from "react";
import { useTypewriter } from "../hooks/useTypewriter";

const TYPEWRITER_SPEED = 18; // ms per character — fast but readable

// Detecta URLs http(s) para convertirlas en enlaces clicables.
const URL_RE = /(https?:\/\/[^\s]+)/g;

// Convierte las URLs de un fragmento de texto plano en enlaces que abren
// en una pestaña nueva. El resto del texto se mantiene igual.
function linkify(text, keyPrefix) {
  return text.split(URL_RE).map((part, i) => {
    if (URL_RE.test(part)) {
      URL_RE.lastIndex = 0; // el flag /g mantiene estado entre .test()
      return (
        <a
          key={`${keyPrefix}-${i}`}
          className="msg-link"
          href={part}
          target="_blank"
          rel="noopener noreferrer"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

// Línea compuesta solo por --- , *** o ___ (separadores del prompt).
const HR_RE = /^(-{3,}|\*{3,}|_{3,})$/;

// Simple inline markdown renderer: **bold**, links, line breaks
function renderMarkdown(text) {
  return text.split("\n").map((line, lineIdx) => {
    // Ocultar las líneas separadoras (---) que vienen del prompt
    if (HR_RE.test(line.trim())) return null;
    // Split on **...** pairs
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return linkify(part, `${lineIdx}-${i}`);
    });
    return (
      <span key={lineIdx}>
        {lineIdx > 0 && <br />}
        {rendered}
      </span>
    );
  });
}

export default function MessageItem({ message, isTyping, onTypingDone, className = "" }) {
  const isUser = message.role === "user";
  // Typewriter driven by the shared hook (handles its own cleanup on unmount).
  const { displayed, type } = useTypewriter();
  // Ref attached to this bubble — used for continuous scroll while typing
  const bubbleRef = useRef(null);

  // While this message is the "typing" one, animate it; otherwise render full text.
  useEffect(() => {
    if (isTyping) {
      type(message.text, TYPEWRITER_SPEED, onTypingDone);
    }
  }, [isTyping]); // eslint-disable-line

  const text = isTyping ? displayed : message.text;

  // Scroll this bubble into view on every character while typing
  useEffect(() => {
    if (isTyping && bubbleRef.current) {
      bubbleRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [text, isTyping]);

  return (
    <article
      ref={bubbleRef}
      className={`msg-item msg-bubble-wrap ${isUser ? "wrap-user" : "wrap-aimo"} ${className}`.trim()}
    >
      <p
        className={`msg-item-text msg-pixel-bubble ${isUser ? "bubble-user" : "bubble-aimo"}`}
      >
        <span className="msg-role-prefix">{isUser ? "[ TÚ ]" : "[ AIMO ]"}</span>{" "}
        {renderMarkdown(text)}
        {isTyping && <span className="tw-cursor" aria-hidden>_</span>}
      </p>
    </article>
  );
}