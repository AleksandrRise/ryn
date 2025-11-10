/**
 * Modal Component
 * Displays overlay modal dialogs for confirmations and alerts
 */

import React from 'react';
import { AlertTriangleIcon } from './Icons';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel: () => void;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onCancel();
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'show' : ''}`} onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon">
            <AlertTriangleIcon size={24} />
          </div>
          <h3 className="modal-title">{title}</h3>
        </div>
        <div className="modal-content">
          {message}
        </div>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          {onConfirm && (
            <button className="modal-btn modal-btn-confirm" onClick={handleConfirm}>
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
