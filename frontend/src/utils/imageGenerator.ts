import { toBlob } from 'html-to-image';
import { STRINGS } from '../constants/strings';

// ========== Types ==========

export interface ImageGenerationResult {
    blob: Blob;
    base64: string;
}

// ========== Image Generation ==========

/**
 * Generate beautified image from editor content
 * Creates a Mac-style window with title bar, shadow, and watermark
 */
export async function generateBeautifiedImage(): Promise<ImageGenerationResult> {
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
    const rawBlob = await captureEditorElement(editorElement, backgroundColor, pixelRatio);

    if (!rawBlob) {
        throw new Error('Failed to generate raw image');
    }

    // Step 2: Load the raw image
    const img = await loadImageFromBlob(rawBlob);

    // Step 3: Create beautified canvas
    const canvas = createBeautifiedCanvas({
        img,
        isDarkMode: !!isDarkMode,
        backgroundColor,
        outerBackgroundColor,
        padding,
        borderRadius,
        innerPadding,
        titleBarHeight,
        pixelRatio,
    });

    // Step 4: Convert canvas to blob and base64
    return await canvasToResult(canvas);
}

// ========== Helper Functions ==========

async function captureEditorElement(
    editorElement: HTMLElement,
    backgroundColor: string,
    pixelRatio: number
): Promise<Blob | null> {
    // Wait for all fonts to be loaded before capturing
    // This fixes the issue where fonts don't render on the first export attempt
    await document.fonts.ready;

    return toBlob(editorElement, {
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
        console.warn('[ImageGenerator] Failed with external images, retrying without them');
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
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
    const imageUrl = URL.createObjectURL(blob);
    const img = new Image();

    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageUrl;
    });

    URL.revokeObjectURL(imageUrl);
    return img;
}

interface CanvasConfig {
    img: HTMLImageElement;
    isDarkMode: boolean;
    backgroundColor: string;
    outerBackgroundColor: string;
    padding: number;
    borderRadius: number;
    innerPadding: number;
    titleBarHeight: number;
    pixelRatio: number;
}

function createBeautifiedCanvas(config: CanvasConfig): HTMLCanvasElement {
    const {
        img,
        isDarkMode,
        backgroundColor,
        outerBackgroundColor,
        padding,
        borderRadius,
        innerPadding,
        titleBarHeight,
        pixelRatio,
    } = config;

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

    // Draw outer background
    ctx.fillStyle = outerBackgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw card with shadow
    const cardX = padding * pixelRatio;
    const cardY = padding * pixelRatio;
    const cardWidth = img.width + innerPadding * 2 * pixelRatio;
    const cardHeight = img.height + innerPadding * 2 * pixelRatio + titleBarHeight * pixelRatio;
    const radius = borderRadius * pixelRatio;

    drawCardWithShadow(ctx, cardX, cardY, cardWidth, cardHeight, radius, backgroundColor, isDarkMode, shadowBlur, shadowOffsetY, pixelRatio);

    // Draw Mac-style title bar
    const titleBarContentHeight = titleBarHeight * pixelRatio;
    drawTitleBar(ctx, cardX, cardY, cardWidth, titleBarContentHeight, radius, isDarkMode, pixelRatio);

    // Draw content image
    const contentAreaY = cardY + titleBarContentHeight;
    drawContentImage(ctx, img, cardX, contentAreaY, cardWidth, cardHeight, titleBarContentHeight, innerPadding, pixelRatio);

    // Draw watermark
    drawWatermark(ctx, cardX, cardY, cardWidth, cardHeight, isDarkMode, pixelRatio);

    return canvas;
}

function drawCardWithShadow(
    ctx: CanvasRenderingContext2D,
    cardX: number,
    cardY: number,
    cardWidth: number,
    cardHeight: number,
    radius: number,
    backgroundColor: string,
    isDarkMode: boolean,
    shadowBlur: number,
    shadowOffsetY: number,
    pixelRatio: number
): void {
    ctx.save();
    ctx.shadowColor = isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = shadowBlur * pixelRatio;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = shadowOffsetY * pixelRatio;

    // Draw rounded rectangle path
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
}

function drawTitleBar(
    ctx: CanvasRenderingContext2D,
    cardX: number,
    cardY: number,
    cardWidth: number,
    titleBarHeight: number,
    radius: number,
    isDarkMode: boolean,
    pixelRatio: number
): void {
    const titleBarBgColor = isDarkMode ? '#1e1e1e' : '#f0f0f0';
    const titleBarBorderColor = isDarkMode ? '#333333' : '#e0e0e0';

    // Draw title bar background with top rounded corners
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cardX + radius, cardY);
    ctx.lineTo(cardX + cardWidth - radius, cardY);
    ctx.quadraticCurveTo(cardX + cardWidth, cardY, cardX + cardWidth, cardY + radius);
    ctx.lineTo(cardX + cardWidth, cardY + titleBarHeight);
    ctx.lineTo(cardX, cardY + titleBarHeight);
    ctx.lineTo(cardX, cardY + radius);
    ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
    ctx.closePath();
    ctx.fillStyle = titleBarBgColor;
    ctx.fill();
    ctx.restore();

    // Draw bottom border
    ctx.beginPath();
    ctx.moveTo(cardX, cardY + titleBarHeight);
    ctx.lineTo(cardX + cardWidth, cardY + titleBarHeight);
    ctx.strokeStyle = titleBarBorderColor;
    ctx.lineWidth = 1 * pixelRatio;
    ctx.stroke();

    // Draw traffic light buttons
    const buttonRadius = 6 * pixelRatio;
    const buttonSpacing = 20 * pixelRatio;
    const buttonY = cardY + titleBarHeight / 2;
    const buttonStartX = cardX + 16 * pixelRatio;

    const trafficLightColors = ['#ff5f57', '#ffbd2e', '#28c840'];
    trafficLightColors.forEach((color, index) => {
        ctx.beginPath();
        ctx.arc(buttonStartX + index * buttonSpacing, buttonY, buttonRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    });
}

function drawContentImage(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    cardX: number,
    contentAreaY: number,
    cardWidth: number,
    cardHeight: number,
    titleBarHeight: number,
    innerPadding: number,
    pixelRatio: number
): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cardX, contentAreaY, cardWidth, cardHeight - titleBarHeight);
    ctx.clip();

    const imageX = cardX + innerPadding * pixelRatio;
    const imageY = contentAreaY + innerPadding * pixelRatio;
    ctx.drawImage(img, imageX, imageY);
    ctx.restore();
}

function drawWatermark(
    ctx: CanvasRenderingContext2D,
    cardX: number,
    cardY: number,
    cardWidth: number,
    cardHeight: number,
    isDarkMode: boolean,
    pixelRatio: number
): void {
    const watermarkText = `Made with ${STRINGS.APP_NAME} by 7Sageer`;
    const watermarkFontSize = 12 * pixelRatio;
    ctx.font = `${watermarkFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.35)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    const watermarkX = cardX + cardWidth - 16 * pixelRatio;
    const watermarkY = cardY + cardHeight - 12 * pixelRatio;
    ctx.fillText(watermarkText, watermarkX, watermarkY);
}

async function canvasToResult(canvas: HTMLCanvasElement): Promise<ImageGenerationResult> {
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
