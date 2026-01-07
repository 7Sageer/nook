import React, { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import './Toast.css';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
    duration?: number;  // 显示时长（毫秒），默认 5000
    onClick?: () => void;  // 点击回调
}

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration: number;
    onClick?: () => void;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
    const icons = {
        success: <CheckCircle size={18} />,
        error: <AlertCircle size={18} />,
        warning: <AlertTriangle size={18} />,
        info: <Info size={18} />,
    };

    useEffect(() => {
        const timer = setTimeout(onClose, toast.duration);
        return () => clearTimeout(timer);
    }, [onClose, toast.duration]);

    const handleClick = () => {
        if (toast.onClick) {
            toast.onClick();
            onClose();
        }
    };

    return (
        <div
            className={`toast toast-${toast.type} ${toast.onClick ? 'toast-clickable' : ''}`}
            onClick={toast.onClick ? handleClick : undefined}
        >
            <span className="toast-icon">{icons[toast.type]}</span>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={(e) => { e.stopPropagation(); onClose(); }}>
                <X size={14} />
            </button>
        </div>
    );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info', options?: ToastOptions) => {
        const id = Date.now().toString() + Math.random().toString(36).slice(2);
        setToasts(prev => [...prev, {
            id,
            message,
            type,
            duration: options?.duration ?? 5000,
            onClick: options?.onClick,
        }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="toast-container">
                {toasts.map(toast => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
};
