import { useCallback } from 'react';
import { toBlob } from 'html-to-image';
import { CopyImageToClipboard } from '../../wailsjs/go/main/App';
import { STRINGS } from '../constants/strings';

interface UseExportImageOptions {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

interface UseExportImageReturn {
    handleExportImage: () => Promise<void>;
}

/**
 * Hook for exporting the editor content as an image to clipboard
 * Uses Go backend for clipboard access to avoid browser permission issues
 */
export function useExportImage({
    onSuccess,
    onError,
}: UseExportImageOptions = {}): UseExportImageReturn {

    const handleExportImage = useCallback(async () => {
        console.log('[ExportImage] handleExportImage called');

        // Find the BlockNote editor element
        const editorElement = document.querySelector('.bn-editor') as HTMLElement;
        console.log('[ExportImage] editorElement:', editorElement);

        if (!editorElement) {
            console.error('[ExportImage] Editor element not found');
            onError?.(new Error('Editor element not found'));
            return;
        }

        try {
            // Detect current theme from app-container
            const appContainer = document.querySelector('.app-container');
            const isDarkMode = appContainer?.classList.contains('dark');
            const backgroundColor = isDarkMode ? '#111111' : '#ffffff';

            console.log('[ExportImage] Theme:', isDarkMode ? 'dark' : 'light', 'Background:', backgroundColor);

            // Convert the editor DOM to a PNG blob
            const blob = await toBlob(editorElement, {
                backgroundColor,
                pixelRatio: 2, // Higher resolution for better quality
                cacheBust: true,
            });

            if (!blob) {
                throw new Error('Failed to generate image');
            }

            // Convert blob to base64 for sending to Go backend
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const dataUrl = reader.result as string;
                    // Remove the data:image/png;base64, prefix
                    const base64 = dataUrl.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
            });
            reader.readAsDataURL(blob);

            const base64Data = await base64Promise;

            // Call Go backend to copy image to clipboard
            await CopyImageToClipboard(base64Data);

            console.log('[ExportImage] Image copied to clipboard successfully');
            onSuccess?.();
        } catch (error) {
            console.error(STRINGS.STATUS.EXPORT_IMAGE_FAILED, error);
            onError?.(error instanceof Error ? error : new Error('Export failed'));
        }
    }, [onSuccess, onError]);

    return {
        handleExportImage,
    };
}
