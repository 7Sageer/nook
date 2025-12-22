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
            const outerBackgroundColor = isDarkMode ? '#1a1a1a' : '#f5f5f5';

            console.log('[ExportImage] Theme:', isDarkMode ? 'dark' : 'light', 'Background:', backgroundColor);

            // Configuration for beautification
            const padding = 48;        // Outer padding
            const borderRadius = 16;   // Border radius for the inner card
            const innerPadding = 24;   // Padding inside the card
            const titleBarHeight = 40; // Mac-style title bar height
            const pixelRatio = 2;      // Higher resolution for better quality

            // Step 1: Create raw image from the editor element
            // Use special options to handle external images (CORS issues)
            const rawBlob = await toBlob(editorElement, {
                backgroundColor,
                pixelRatio,
                cacheBust: true,
                // Include external images by fetching them without CORS restrictions
                includeQueryParams: true,
                skipAutoScale: true,
                // Filter out problematic elements that might cause CORS issues
                filter: (node: Node) => {
                    // Skip external stylesheets that might cause issues
                    if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') {
                        return false;
                    }
                    return true;
                },
            }).catch(async () => {
                // Fallback: If initial attempt fails, try without external images
                console.warn('[ExportImage] Failed with external images, retrying without them');
                return toBlob(editorElement, {
                    backgroundColor,
                    pixelRatio,
                    cacheBust: true,
                    filter: (node: Node) => {
                        // Skip external images
                        if (node instanceof HTMLImageElement) {
                            const src = node.src || node.getAttribute('src') || '';
                            if (src.startsWith('http://') || src.startsWith('https://')) {
                                return false;
                            }
                        }
                        if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') {
                            return false;
                        }
                        return true;
                    },
                });
            });

            if (!rawBlob) {
                throw new Error('Failed to generate raw image');
            }

            // Step 2: Load the raw image and apply beautification using Canvas
            const rawImageUrl = URL.createObjectURL(rawBlob);
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = rawImageUrl;
            });
            URL.revokeObjectURL(rawImageUrl);

            // Step 3: Create canvas with room for padding, shadow, and title bar
            const shadowBlur = 32;
            const shadowOffsetY = 8;
            const canvasWidth = img.width + (padding + innerPadding) * 2 * pixelRatio;
            const canvasHeight = img.height + (padding + innerPadding) * 2 * pixelRatio + shadowBlur * pixelRatio + titleBarHeight * pixelRatio;

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                throw new Error('Failed to get canvas context');
            }

            // Step 4: Draw outer background
            ctx.fillStyle = outerBackgroundColor;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Step 5: Draw inner card with rounded corners and shadow
            const cardX = padding * pixelRatio;
            const cardY = padding * pixelRatio;
            const cardWidth = img.width + innerPadding * 2 * pixelRatio;
            const cardHeight = img.height + innerPadding * 2 * pixelRatio + titleBarHeight * pixelRatio;
            const radius = borderRadius * pixelRatio;

            // Shadow
            ctx.save();
            ctx.shadowColor = isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = shadowBlur * pixelRatio;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = shadowOffsetY * pixelRatio;

            // Draw rounded rectangle path for card
            ctx.beginPath();
            ctx.moveTo(cardX + radius, cardY);
            ctx.lineTo(cardX + cardWidth - radius, cardY);
            ctx.quadraticCurveTo(cardX + cardWidth, cardY, cardX + cardWidth, cardY + radius);
            ctx.lineTo(cardX + cardWidth, cardY + cardHeight - radius);
            ctx.quadraticCurveTo(cardX + cardWidth, cardY + cardHeight, cardX + cardWidth - radius, cardY + cardHeight);
            ctx.lineTo(cardX + radius, cardY + cardHeight);
            ctx.quadraticCurveTo(cardX, cardY + cardHeight, cardX, cardY + cardHeight - radius);
            ctx.lineTo(cardX, cardY + radius);
            ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
            ctx.closePath();

            ctx.fillStyle = backgroundColor;
            ctx.fill();
            ctx.restore();

            // Step 6: Draw Mac-style title bar
            const titleBarY = cardY;
            const titleBarContentHeight = titleBarHeight * pixelRatio;
            const titleBarBgColor = isDarkMode ? '#1e1e1e' : '#f0f0f0';
            const titleBarBorderColor = isDarkMode ? '#333333' : '#e0e0e0';

            // Draw title bar background with top rounded corners
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cardX + radius, titleBarY);
            ctx.lineTo(cardX + cardWidth - radius, titleBarY);
            ctx.quadraticCurveTo(cardX + cardWidth, titleBarY, cardX + cardWidth, titleBarY + radius);
            ctx.lineTo(cardX + cardWidth, titleBarY + titleBarContentHeight);
            ctx.lineTo(cardX, titleBarY + titleBarContentHeight);
            ctx.lineTo(cardX, titleBarY + radius);
            ctx.quadraticCurveTo(cardX, titleBarY, cardX + radius, titleBarY);
            ctx.closePath();
            ctx.fillStyle = titleBarBgColor;
            ctx.fill();
            ctx.restore();

            // Draw bottom border of title bar
            ctx.beginPath();
            ctx.moveTo(cardX, titleBarY + titleBarContentHeight);
            ctx.lineTo(cardX + cardWidth, titleBarY + titleBarContentHeight);
            ctx.strokeStyle = titleBarBorderColor;
            ctx.lineWidth = 1 * pixelRatio;
            ctx.stroke();

            // Draw traffic light buttons (red, yellow, green)
            const buttonRadius = 6 * pixelRatio;
            const buttonSpacing = 20 * pixelRatio;
            const buttonY = titleBarY + titleBarContentHeight / 2;
            const buttonStartX = cardX + 16 * pixelRatio;

            const trafficLightColors = ['#ff5f57', '#ffbd2e', '#28c840'];
            trafficLightColors.forEach((color, index) => {
                ctx.beginPath();
                ctx.arc(buttonStartX + index * buttonSpacing, buttonY, buttonRadius, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            });

            // Step 7: Clip to content area and draw the content image
            const contentAreaY = titleBarY + titleBarContentHeight;
            ctx.save();
            ctx.beginPath();
            ctx.rect(cardX, contentAreaY, cardWidth, cardHeight - titleBarContentHeight);
            ctx.clip();

            // Draw the content image
            const imageX = cardX + innerPadding * pixelRatio;
            const imageY = contentAreaY + innerPadding * pixelRatio;
            ctx.drawImage(img, imageX, imageY);
            ctx.restore();

            // Step 8: Draw watermark
            const watermarkText = `Made with ${STRINGS.APP_NAME} by 7Sageer`;
            const watermarkFontSize = 12 * pixelRatio;
            ctx.font = `${watermarkFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.fillStyle = isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.35)';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            const watermarkX = cardX + cardWidth - 16 * pixelRatio;
            const watermarkY = cardY + cardHeight - 12 * pixelRatio;
            ctx.fillText(watermarkText, watermarkX, watermarkY);

            // Step 7: Convert canvas to blob
            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob(resolve, 'image/png');
            });

            if (!blob) {
                throw new Error('Failed to generate beautified image');
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
