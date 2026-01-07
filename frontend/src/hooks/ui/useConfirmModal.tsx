import { useState, useCallback } from 'react';
import { ConfirmModal } from '../../components/modals/ConfirmModal';

interface ConfirmOptions {
    title: string;
    message: string;
}

interface UseConfirmModalReturn {
    isOpen: boolean;
    openModal: (options: ConfirmOptions, onConfirm: () => void) => void;
    closeModal: () => void;
    ConfirmModalComponent: React.FC;
}

export function useConfirmModal(): UseConfirmModalReturn {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({ title: '', message: '' });
    const [onConfirmCallback, setOnConfirmCallback] = useState<(() => void) | null>(null);

    const openModal = useCallback((opts: ConfirmOptions, onConfirm: () => void) => {
        setOptions(opts);
        setOnConfirmCallback(() => onConfirm);
        setIsOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setIsOpen(false);
        setOnConfirmCallback(null);
    }, []);

    const handleConfirm = useCallback(() => {
        if (onConfirmCallback) {
            onConfirmCallback();
        }
        closeModal();
    }, [onConfirmCallback, closeModal]);

    const ConfirmModalComponent: React.FC = () => (
        <ConfirmModal
            isOpen={isOpen}
            title={options.title}
            message={options.message}
            onConfirm={handleConfirm}
            onCancel={closeModal}
        />
    );

    return {
        isOpen,
        openModal,
        closeModal,
        ConfirmModalComponent,
    };
}
