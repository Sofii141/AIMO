"""
Final Recommendations Agent — AIMO
────────────────────────────────────
Generates personalized, empathetic recommendations for the student based on:
  - The structured context gathered by agente_contexto
  - The clinical risk classification from agente_clasificador

Routing by risk level:
  - LOW    → Groq LLaMA (openai/gpt-oss-120b)
  - MEDIUM → AWS Bedrock (configured via BEDROCK_MODEL_ID)
  - HIGH   → Groq LLaMA, brief message directing to university appointment page
"""

import os
import json
from src.config_api import get_groq_client, get_default_params, get_bedrock_client
from src.logger import get_logger

logger = get_logger("aimo.recomendaciones")

UNIVERSITY_APPT_URL = (
    "https://portal.unicauca.edu.co/versionP/bienestar-universitario/"
    "salud-para-estudiantes/psicologia-y-psiquiatria"
)

BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.amazon.nova-pro-v1:0")


def _load_prompt() -> str:
    ruta = os.path.join(
        os.path.dirname(__file__), '..', 'prompts', 'aimo_recommendations.txt'
    )
    try:
        with open(ruta, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        logger.warning("No se encontró aimo_recommendations.txt — usando prompt mínimo")
        return (
            "Eres un asistente de apoyo emocional para estudiantes universitarios. "
            "Genera recomendaciones empáticas y personalizadas en español."
        )


def _build_input(context_data: dict, clasificacion: dict) -> str:
    context_clean = {k: v for k, v in context_data.items() if k != 'complete'}
    return json.dumps(
        {"context_summary": context_clean, "risk_assessment": clasificacion},
        ensure_ascii=False, indent=2,
    )


def _generar_via_groq(system_prompt: str, input_text: str) -> str:
    client = get_groq_client()
    params = get_default_params()
    params["temperature"] = 0.7
    params["stream"] = False
    params["max_completion_tokens"] = 1200
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": input_text},
    ]
    completion = client.chat.completions.create(messages=messages, **params)
    return completion.choices[0].message.content or ""


def _generar_via_bedrock(system_prompt: str, input_text: str) -> str:
    client = get_bedrock_client()
    response = client.converse(
        modelId=BEDROCK_MODEL_ID,
        system=[{"text": system_prompt}],
        messages=[{"role": "user", "content": [{"text": input_text}]}],
        inferenceConfig={"maxTokens": 1200, "temperature": 0.7},
    )
    return response["output"]["message"]["content"][0]["text"]


def _generar_riesgo_alto(context_data: dict, clasificacion: dict) -> str:
    context_clean = {k: v for k, v in context_data.items() if k != 'complete'}
    system = (
        "Eres un asistente de apoyo emocional para estudiantes universitarios. "
        "El estudiante está atravesando una situación emocionalmente grave. "
        "Escribe un mensaje MUY BREVE (máximo 3 oraciones) en español que: "
        "1. Reconozca con calidez lo difícil de su situación, mencionando un detalle específico. "
        "2. Le diga de forma directa y tranquilizadora que debe hablar con un profesional hoy. "
        "No hagas recomendaciones de autocuidado. No uses términos clínicos. "
        "Solo el mensaje de texto, sin JSON ni etiquetas."
    )
    user_msg = json.dumps(
        {"context_summary": context_clean, "risk_assessment": clasificacion},
        ensure_ascii=False, indent=2,
    )

    opening = "Lo que estás viviendo es muy difícil, y mereces apoyo real ahora mismo."
    try:
        client = get_groq_client()
        params = get_default_params()
        params["temperature"] = 0.4
        params["stream"] = False
        params["max_completion_tokens"] = 200
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user_msg},
            ],
            **params,
        )
        opening = (completion.choices[0].message.content or "").strip()
    except Exception as e:
        logger.error("Error generando mensaje riesgo alto: %s", e)

    return (
        f"{opening}\n\n"
        "Por favor, agenda una cita con el servicio de psicología de la "
        "Universidad del Cauca. Están disponibles para acompañarte de forma "
        f"confidencial y sin juicios:\n{UNIVERSITY_APPT_URL}"
    )


def generar_recomendaciones(context_data: dict, clasificacion: dict) -> str:
    """
    Generates final personalized recommendations routed by risk level:
      low    → Groq LLaMA
      medium → AWS Bedrock
      high   → Groq LLaMA, appointment redirect only
    """
    risk_level = clasificacion.get("risk_level", "medium")
    logger.info("Generando recomendaciones — risk_level=%s", risk_level)

    if risk_level == "high":
        response = _generar_riesgo_alto(context_data, clasificacion)
        logger.info("Respuesta riesgo alto generada (%d chars)", len(response))
        return response

    system_prompt = _load_prompt()
    input_text    = _build_input(context_data, clasificacion)

    try:
        if risk_level == "low":
            response = _generar_via_groq(system_prompt, input_text)
            backend = "Groq"
        else:
            response = _generar_via_bedrock(system_prompt, input_text)
            backend = "Bedrock"

        logger.info("Recomendaciones generadas vía %s (%d chars)", backend, len(response))
        return response

    except Exception as e:
        logger.error("Error generando recomendaciones (%s): %s", risk_level, e)
        return (
            "Gracias por compartir conmigo cómo te sientes. "
            "Te recomiendo hablar con el psicólogo de la Universidad del Cauca: "
            f"{UNIVERSITY_APPT_URL}"
        )
