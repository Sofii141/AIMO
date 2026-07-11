import { useState, useEffect } from "react";

/**
 * AimoCharacter
 * Muestra el PNG de AIMO según la fase actual.
 *
 * Robustez ante fallos de carga (p. ej. sin internet):
 *   A) Si un PNG de fase (thinking/talking) falla, cae a /aimo.png,
 *      que ya está cargado desde el intro — mismo personaje, no un dibujo distinto.
 *   B) Al montar se precargan las 3 imágenes mientras hay conexión, para que
 *      queden en caché y no fallen al cambiar de fase aunque luego se caiga el internet.
 *
 * Las imágenes viven en  frontend/public/  (aimo.png, aimo-thinking.png, aimo-talking.png)
 */
const BASE_IMAGE = "/aimo.png";
const ALL_IMAGES = [BASE_IMAGE, "/aimo-thinking.png", "/aimo-talking.png"];

export default function AimoCharacter({ phase }) {
  const [imgFailed, setImgFailed] = useState(false);

  // B) Precarga de las 3 imágenes al montar (una sola vez).
  useEffect(() => {
    ALL_IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Elegimos qué imagen mostrar según la fase actual del juego.
  let currentImage = BASE_IMAGE; // Imagen por defecto (esperando/intro)
  if (phase === "loading") {
    currentImage = "/aimo-thinking.png"; // Pensando
  } else if (phase === "responding") {
    currentImage = "/aimo-talking.png"; // Respondiendo
  }

  // A) Si la imagen de fase falló, mostramos la base (aimo.png).
  const displayImage = imgFailed ? BASE_IMAGE : currentImage;

  // Si la fase cambia, reseteamos el error para reintentar la imagen de esa fase.
  useEffect(() => {
    setImgFailed(false);
  }, [currentImage]);

  return (
    <div className="aimo-character">
      <div className="aimo-motion">
        <div className="aimo-visual">
          <img
            className="aimo-img"
            src={displayImage}
            alt="AIMO"
            // Solo marcamos fallo si la que falló no era ya la base, para evitar bucles.
            onError={() => {
              if (currentImage !== BASE_IMAGE) setImgFailed(true);
            }}
            draggable={false}
          />
        </div>
      </div>
      <div className="aimo-ground-shadow" aria-hidden />
    </div>
  );
}
