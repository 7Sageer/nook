import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { WindowMinimise, WindowToggleMaximise, Quit, WindowIsMaximised } from '../../wailsjs/runtime/runtime';

interface WindowControlsProps {
    theme?: 'light' | 'dark';
}

export function WindowControls({ theme }: WindowControlsProps) {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const updateState = async () => {
            try {
                const maximized = await WindowIsMaximised();
                setIsMaximized(maximized);
            } catch (e) {
                console.error(e);
            }
        };

        // Initial check
        updateState();

        // Listen for resize events (covers manual resize, snap, and wails actions)
        window.addEventListener('resize', updateState);
        return () => window.removeEventListener('resize', updateState);
    }, []);

    const handleMaximize = async () => {
        WindowToggleMaximise();
        // State update will be triggered by resize event, but we can optimistically flip it too
        // setIsMaximized(!isMaximized); 
    };

    return (
        <div className="window-controls">
            <button
                className="window-control-btn minimize"
                onClick={() => WindowMinimise()}
                title="Minimize"
                tabIndex={-1}
            >
                <Minus size={16} />
            </button>
            <button
                className="window-control-btn maximize"
                onClick={handleMaximize}
                title={isMaximized ? "Restore Down" : "Maximize"}
                tabIndex={-1}
            >
                {isMaximized ? (
                    <Copy size={14} style={{ transform: 'rotate(180deg)' }} />
                ) : (
                    <Square size={14} />
                )}
            </button>
            <button
                className="window-control-btn close"
                onClick={() => Quit()}
                title="Close"
                tabIndex={-1}
            >
                <X size={16} />
            </button>
        </div>
    );
}
