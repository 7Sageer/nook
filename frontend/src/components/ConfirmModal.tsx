import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { AlertTriangle, X } from 'lucide-react';
import './ConfirmModal.css';
import { STRINGS } from '../constants/strings';

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
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className={`modal-overlay ${theme}`} onClick={onCancel}>
      <div className={`modal-content ${theme}`} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onCancel}>
          <X size={18} />
        </button>
        <div className="modal-icon">
          <AlertTriangle size={24} />
        </div>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onCancel}>
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
