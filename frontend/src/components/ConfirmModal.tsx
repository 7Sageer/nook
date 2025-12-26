import React, { useEffect, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { AlertTriangle, X } from 'lucide-react';
import './ConfirmModal.css';
import { getStrings } from '../constants/strings';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  const { theme, language } = useSettings();
  const STRINGS = getStrings(language);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus management and keyboard handling
  useEffect(() => {
    if (isOpen) {
      // Focus the cancel button when modal opens
      cancelButtonRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCancel();
        }
        // Focus trap
        if (e.key === 'Tab' && modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className={`modal-overlay ${theme}`}
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={`modal-content ${theme}`}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-message"
      >
        <button
          className="modal-close"
          onClick={onCancel}
          aria-label={STRINGS.BUTTONS.CANCEL}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <div className="modal-icon" aria-hidden="true">
          <AlertTriangle size={24} />
        </div>
        <h3 id="modal-title" className="modal-title">{title}</h3>
        <p id="modal-message" className="modal-message">{message}</p>
        <div className="modal-actions">
          <button
            ref={cancelButtonRef}
            className="modal-btn cancel"
            onClick={onCancel}
          >
            {STRINGS.BUTTONS.CANCEL}
          </button>
          <button className="modal-btn confirm" onClick={onConfirm}>
            {STRINGS.BUTTONS.CONFIRM}
          </button>
        </div>
      </div>
    </div>
  );
};
