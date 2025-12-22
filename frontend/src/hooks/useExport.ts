import { useCallback, MutableRefObject } from 'react';
import { BlockNoteEditor } from '@blocknote/core';
import { toBlob } from 'html-to-image';
import {
    ExportMarkdownFile,
    ExportHTMLFile,
    PrintHTML,
    CopyImageToClipboard,
    SaveImageFile
} from '../../wailsjs/go/main/App';
import { STRINGS } from '../constants/strings';
import { DocumentMeta } from '../types/document';

// ========== Types ==========

interface UseExportOptions {
    editorRef: MutableRefObject<BlockNoteEditor | null>;
    documentTitle?: string;
    documents?: DocumentMeta[];
    activeId?: string | null;
    onSuccess?: (message: string) => void;
    onError?: (error: Error) => void;
}

interface UseExportReturn {
    handleExportMarkdown: () => Promise<void>;
    handleExportHTML: () => Promise<void>;
    handleCopyImage: () => Promise<void>;
    handleSaveImage: () => Promise<void>;
    handlePrint: () => Promise<void>;
}

// ========== HTML Template ==========

/**
 * Generate a complete HTML document with print styles
 */
function generatePrintHTML(html: string, title: string, autoPrint: boolean = false): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #333;
        }
        h1, h2, h3 { margin-top: 1.5em; margin-bottom: 0.5em; }
        h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.25em; }
        p { margin: 1em 0; }
        ul, ol { padding-left: 2em; }
        li { margin: 0.5em 0; }
        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: "SF Mono", Monaco, "Cascadia Code", Consolas, monospace;
            font-size: 0.9em;
        }
        pre {
            background: #f4f4f4;
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
        }
        pre code {
            background: none;
            padding: 0;
        }
        blockquote {
            border-left: 4px solid #ddd;
            margin: 1em 0;
            padding-left: 1em;
            color: #666;
        }
        img {
            max-width: 100%;
            height: auto;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px 12px;
            text-align: left;
        }
        th {
            background: #f4f4f4;
        }
        a {
            color: #0366d6;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        hr {
            border: none;
            border-top: 1px solid #eee;
            margin: 2em 0;
        }
        @media print {
            body { padding: 20px; margin: 0; }
            a::after { content: none !important; }
        }
    </style>
</head>
<body>
${html}
${autoPrint ? `<script>window.onload = function() { window.print(); };</script>` : ''}
</body>
</html>`;
}

// ========== Image Generation ==========

interface ImageGenerationResult {
    blob: Blob;
    base64: string;
}

/**
 * Generate beautified image from editor content
 */
async function generateBeautifiedImage(): Promise<ImageGenerationResult> {
    // Find the BlockNote editor element
    const editorElement = document.querySelector('.bn-editor') as HTMLElement;
    if (!editorElement) {
        throw new Error('Editor element not found');
    }

    // Detect current theme from app-container
    const appContainer = document.querySelector('.app-container');
    const isDarkMode = appContainer?.classList.contains('dark');
    const backgroundColor = isDarkMode ? '#111111' : '#ffffff';
    const outerBackgroundColor = isDarkMode ? '#1a1a1a' : '#f5f5f5';

    // Configuration for beautification
    const padding = 48;
    const borderRadius = 16;
    const innerPadding = 24;
    const titleBarHeight = 40;
    const pixelRatio = 2;

    // Step 1: Create raw image from the editor element
    const rawBlob = await toBlob(editorElement, {
        backgroundColor,
        pixelRatio,
        cacheBust: true,
        includeQueryParams: true,
        skipAutoScale: true,
        filter: (node: Node) => {
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

    // Step 9: Convert canvas to blob
    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
    });

    if (!blob) {
        throw new Error('Failed to generate beautified image');
    }

    // Convert blob to base64
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
            const dataUrl = reader.result as string;
            // Remove the data:image/png;base64, prefix
            resolve(dataUrl.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    return { blob, base64 };
}

// ========== Main Hook ==========

/**
 * Unified hook for all export functionality
 * - Markdown export
 * - HTML export  
 * - Image export (clipboard + save)
 * - Print
 */
export function useExport({
    editorRef,
    documentTitle = 'document',
    documents,
    activeId,
    onSuccess,
    onError,
}: UseExportOptions): UseExportReturn {

    // Get document title for export
    const getTitle = useCallback(() => {
        if (documentTitle) return documentTitle;
        if (activeId && documents) {
            const doc = documents.find((d) => d.id === activeId);
            return doc?.title || 'document';
        }
        return 'document';
    }, [documentTitle, activeId, documents]);

    // Export as Markdown
    const handleExportMarkdown = useCallback(async () => {
        const editor = editorRef.current;
        if (!editor) {
            onError?.(new Error('Editor not available'));
            return;
        }

        try {
            const markdown = await editor.blocksToMarkdownLossy();
            await ExportMarkdownFile(markdown, getTitle());
            onSuccess?.('Markdown exported');
        } catch (error) {
            console.error('[Export] Markdown export failed:', error);
            onError?.(error instanceof Error ? error : new Error('Export failed'));
        }
    }, [editorRef, getTitle, onSuccess, onError]);

    // Export as HTML
    const handleExportHTML = useCallback(async () => {
        const editor = editorRef.current;
        if (!editor) {
            onError?.(new Error('Editor not available'));
            return;
        }

        try {
            const html = await editor.blocksToFullHTML(editor.document);
            const fullHTML = generatePrintHTML(html, getTitle(), false);
            await ExportHTMLFile(fullHTML, getTitle());
            onSuccess?.('HTML exported');
        } catch (error) {
            console.error('[Export] HTML export failed:', error);
            onError?.(error instanceof Error ? error : new Error('Export failed'));
        }
    }, [editorRef, getTitle, onSuccess, onError]);

    // Copy image to clipboard
    const handleCopyImage = useCallback(async () => {
        try {
            const { base64 } = await generateBeautifiedImage();
            await CopyImageToClipboard(base64);
            onSuccess?.(STRINGS.STATUS.IMAGE_COPIED);
        } catch (error) {
            console.error('[Export] Image copy failed:', error);
            onError?.(error instanceof Error ? error : new Error('Export failed'));
        }
    }, [onSuccess, onError]);

    // Save image to file
    const handleSaveImage = useCallback(async () => {
        try {
            const { base64 } = await generateBeautifiedImage();
            await SaveImageFile(base64, getTitle());
            onSuccess?.('Image saved');
        } catch (error) {
            console.error('[Export] Image save failed:', error);
            onError?.(error instanceof Error ? error : new Error('Export failed'));
        }
    }, [getTitle, onSuccess, onError]);

    // Print (open in browser with print dialog)
    const handlePrint = useCallback(async () => {
        const editor = editorRef.current;
        if (!editor) {
            onError?.(new Error('Editor not available'));
            return;
        }

        try {
            const html = await editor.blocksToFullHTML(editor.document);
            const fullHTML = generatePrintHTML(html, getTitle(), true);
            await PrintHTML(fullHTML, getTitle());
            onSuccess?.('Opening print dialog...');
        } catch (error) {
            console.error('[Export] Print failed:', error);
            onError?.(error instanceof Error ? error : new Error('Print failed'));
        }
    }, [editorRef, getTitle, onSuccess, onError]);

    return {
        handleExportMarkdown,
        handleExportHTML,
        handleCopyImage,
        handleSaveImage,
        handlePrint,
    };
}
