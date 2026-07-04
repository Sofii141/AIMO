/**
 * api.js — Capa de servicio para el backend Flask de AIMO.
 *
 * Centraliza todas las llamadas de red: base URL, timeout, verificación de
 * res.ok y clasificación de errores. Los componentes no deben usar fetch
 * directamente, sino estas funciones.
 */

/** Base del API. En dev queda '' y el proxy de Vite redirige /api → Flask. */
const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Tiempo máximo por petición antes de abortar (ms).
 * El turno que cierra la conversación dispara el pipeline completo del backend
 * (clasificación + recomendaciones vía Groq + evaluación final con gpt-4), que
 * puede tardar ~20s o más. 180s deja margen sin quedar en espera indefinida.
 */
const REQUEST_TIMEOUT = 180_000;

/**
 * Error tipado para que la UI pueda diferenciar el mensaje según el fallo.
 *   kind: 'timeout'  — la petición superó REQUEST_TIMEOUT
 *         'network'  — no se pudo conectar / respuesta no parseable
 *         'http'     — el servidor respondió con un status != 2xx
 */
export class ApiError extends Error {
  constructor(kind, message, status = null) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * POST genérico con timeout y clasificación de errores.
 * @returns {Promise<any>} JSON parseado en caso de éxito.
 * @throws {ApiError}
 */
async function postJson(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new ApiError('http', `El servidor respondió con HTTP ${res.status}`, res.status);
    }

    return await res.json();
  } catch (err) {
    // Errores HTTP ya vienen tipados: los propagamos tal cual.
    if (err instanceof ApiError) throw err;
    // AbortController dispara AbortError al vencer el timeout.
    if (err?.name === 'AbortError') {
      throw new ApiError('timeout', `La petición a ${path} superó el tiempo límite`);
    }
    // Cualquier otra cosa (DNS, servidor caído, JSON inválido) = fallo de red.
    throw new ApiError('network', `No se pudo conectar con el servidor (${path})`);
  } finally {
    clearTimeout(timer);
  }
}

/** Envía un mensaje del usuario al pipeline de AIMO. */
export function sendMessage(message, sessionId) {
  return postJson('/api/chat', { message, session_id: sessionId });
}

/** Reinicia la sesión de conversación en el backend. */
export function resetSession(sessionId) {
  return postJson('/api/reset', { session_id: sessionId });
}
