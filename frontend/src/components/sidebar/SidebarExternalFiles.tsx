import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X } from 'lucide-react';
import { STRINGS } from '../../constants/strings';
import type { ExternalFileInfo } from '../../contexts/ExternalFileContext';

interface SidebarExternalFilesProps {
    externalFiles: ExternalFileInfo[];
    activeExternalPath: string | null;
    onSelectExternal?: (path: string) => void;
    onCloseExternal?: (path: string) => void;
}

export function SidebarExternalFiles({
    externalFiles,
    activeExternalPath,
    onSelectExternal,
    onCloseExternal,
}: SidebarExternalFilesProps) {
    if (externalFiles.length === 0) return null;

    return (
        <div className="external-file-section">
            <div className="section-label">{STRINGS.LABELS.EXTERNAL_FILE}</div>
            <AnimatePresence mode="popLayout">
                {externalFiles.map((file) => {
                    const isActive = activeExternalPath === file.path;
                    return (
                        <motion.div
                            key={file.path}
                            layout
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                            className={`external-file-item ${isActive ? 'active' : ''}`}
                            onClick={() => onSelectExternal?.(file.path)}
                        >
                            <FileText size={16} />
                            <span className="external-file-name" title={file.path}>
                                {file.name}
                            </span>
                            {isActive && onCloseExternal && (
                                <button
                                    className="close-external-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCloseExternal(file.path);
                                    }}
                                    title={STRINGS.TOOLTIPS.CLOSE_EXTERNAL}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
