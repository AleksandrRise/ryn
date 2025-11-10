/**
 * Toast Component
 * Displays temporary notification messages
 */

import React, { useEffect } from 'react';
import './Toast.css';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  show: boolean;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  show,
  onClose,
  duration = 3000
}) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  return (
    <div className={`toast ${show ? 'show' : ''} ${type}`}>
      {message}
    </div>
  );
};

export default Toast;
