import { X } from 'lucide-react';

/**
 * Modal — Envoltura compartida para los paneles overlay de AIMO.
 *
 * Encapsula el patrón repetido: overlay que cierra al hacer click, contenido
 * que detiene la propagación, y header con título + botón de cierre.
 *
 * Las clases son parametrizables para respetar los estilos existentes:
 *   - Paneles de investigación (AdminPanel) usan las clases ap-*.
 *   - RecommendationsModal usa las clases rec-*.
 *
 * Props:
 *   isOpen          — si es false, no renderiza nada.
 *   onClose         — callback al cerrar (overlay o botón de cierre).
 *   title           — texto del título (opcional).
 *   ariaLabel       — aria-label del role="dialog".
 *   children        — contenido del panel (tabs, body, footer, etc.).
 *   overlayClassName / panelClassName / headerClassName / titleClassName
 *                   — permiten reproducir los estilos ap-* o rec-*.
 *   closeAriaLabel  — aria-label del botón de cierre.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  ariaLabel,
  children,
  overlayClassName = 'ap-overlay',
  panelClassName = 'ap-panel',
  headerClassName = 'ap-header',
  titleClassName = 'ap-title',
  closeAriaLabel = 'Cerrar',
}) {
  if (!isOpen) return null;

  return (
    <div className={overlayClassName} onClick={onClose}>
      <div
        className={panelClassName}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={ariaLabel}
      >
        <div className={headerClassName}>
          {title != null && <span className={titleClassName}>{title}</span>}
          <button className="ap-close" onClick={onClose} aria-label={closeAriaLabel}>
            <X size={16} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
