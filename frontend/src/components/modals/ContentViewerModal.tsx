import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { X, FileText, Link, Loader2, Bot } from 'lucide-react';
import './ContentViewerModal.css';

interface ContentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  blockType: 'bookmark' | 'file' | 'folder';
  url?: string;
  loading?: boolean;
  error?: string;
}

export const ContentViewerModal: React.FC<ContentViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  content,
  blockType,
  url,
  loading,
  error,
}) => {
  const { theme } = useSettings();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className={`modal-overlay ${theme}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={`content-viewer-modal ${theme}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="content-viewer-title"
      >
        <div className="content-viewer-header">
          <div className="content-viewer-icon">
            {blockType === 'bookmark' ? <Link size={18} /> : <FileText size={18} />}
          </div>
          <h3 id="content-viewer-title" className="content-viewer-title">
            {title || (blockType === 'bookmark' ? 'Bookmark Content' : 'File Content')}
          </h3>
          <button
            ref={closeButtonRef}
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {url && (
          <div className="content-viewer-url">
            <span>{url}</span>
          </div>
        )}

        <div className="content-viewer-body">
          {loading ? (
            <div className="content-viewer-loading">
              <Loader2 size={24} className="animate-spin" />
              <span>Loading content...</span>
            </div>
          ) : error ? (
            <div className="content-viewer-error">
              <span>{error}</span>
            </div>
          ) : (
            <pre className="content-viewer-text">{content}</pre>
          )}
        </div>

        <div className="content-viewer-footer">
          <span className="content-viewer-hint">
            <Bot size={12} />
            This is the extracted content that AI can read
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
