/**
 * Find the block element being dragged
 */
export function findHoveredBlock(target: HTMLElement): Element | null {
    // Method 1: BlockNote marks hovered blocks with data attribute
    const hoveredBlock = document.querySelector('.bn-block-outer[data-is-hovered="true"]');
    if (hoveredBlock) return hoveredBlock;

    // Method 2: Find by side menu position - use center point for better accuracy
    const sideMenu = target.closest('.bn-side-menu');
    if (sideMenu) {
        const menuRect = sideMenu.getBoundingClientRect();
        // Use the vertical center of the side menu for matching
        const menuCenterY = menuRect.top + menuRect.height / 2;

        const blocks = document.querySelectorAll('.bn-block-outer');
        let bestMatch: Element | null = null;
        let bestDistance = Infinity;

        for (const block of blocks) {
            const blockRect = block.getBoundingClientRect();
            const blockCenterY = blockRect.top + blockRect.height / 2;

            // Check if menu center is within the block's vertical bounds
            if (menuCenterY >= blockRect.top && menuCenterY <= blockRect.bottom) {
                return block; // Direct hit - return immediately
            }

            // Track the closest block
            const distance = Math.abs(menuCenterY - blockCenterY);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatch = block;
            }
        }

        // Return the closest block if within reasonable distance (50px)
        if (bestMatch && bestDistance < 50) {
            return bestMatch;
        }
    }

    // Method 3: Fallback - closest block outer from target
    return target.closest('.bn-block-outer');
}

/**
 * Check if the block is a bookmark block
 */
export function isBookmarkBlock(element: Element): boolean {
    return element.querySelector('.bookmark-card-custom') !== null ||
        element.querySelector('[data-content-type="bookmark"]') !== null;
}

/**
 * Check if the block is a file block
 */
export function isFileBlock(element: Element): boolean {
    return element.querySelector('.file-card-custom') !== null ||
        element.querySelector('[data-content-type="file"]') !== null;
}

/**
 * Check if the block is a folder block
 */
export function isFolderBlock(element: Element): boolean {
    return element.querySelector('.folder-card-custom') !== null ||
        element.querySelector('[data-content-type="folder"]') !== null;
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Create a compact preview for bookmark blocks with image thumbnail
 */
export function createBookmarkPreview(blockElement: Element, isDark: boolean): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'bn-drag-overlay bn-drag-overlay-bookmark';
    overlay.id = 'bn-custom-drag-overlay';

    const bookmarkCard = blockElement.querySelector('.bookmark-card-custom');
    if (!bookmarkCard) {
        // Fallback: show a simple bookmark icon
        overlay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                <span style="opacity: 0.7;">Bookmark</span>
            </div>
        `;
    } else {
        // Extract key info for compact preview
        const title = bookmarkCard.querySelector('.bookmark-title')?.textContent || '';
        const domain = bookmarkCard.querySelector('.bookmark-domain')?.textContent || '';
        const faviconEl = bookmarkCard.querySelector('.bookmark-favicon') as HTMLImageElement | null;
        const faviconSrc = faviconEl?.src || '';

        // Get the OG image if available
        const imageEl = bookmarkCard.querySelector('.bookmark-image img') as HTMLImageElement | null;
        const imageSrc = imageEl?.src || '';

        // Build the preview with optional image thumbnail
        const imageHtml = imageSrc ? `
            <div style="
                width: 64px;
                height: 48px;
                flex-shrink: 0;
                border-radius: 6px;
                overflow: hidden;
                background: ${isDark ? '#333' : '#f0f0f0'};
            ">
                <img src="${imageSrc}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.style.display='none'" />
            </div>
        ` : '';

        const faviconHtml = faviconSrc
            ? `<img src="${faviconSrc}" style="width: 14px; height: 14px; border-radius: 2px; flex-shrink: 0;" onerror="this.style.display='none'" />`
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; opacity: 0.5;">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/>
            </svg>`;

        overlay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; max-width: 320px;">
                <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-weight: 500; font-size: 13px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${escapeHtml(title)}</div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        ${faviconHtml}
                        <span style="font-size: 11px; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(domain)}</span>
                    </div>
                </div>
                ${imageHtml}
            </div>
        `;
    }

    overlay.style.cssText = `
        position: fixed;
        z-index: 99999;
        padding: 4px 8px;
        background: ${isDark ? '#2d2d2d' : '#ffffff'};
        border-radius: 6px;
        box-shadow: 0 4px 12px ${isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.15)'};
        pointer-events: none;
        color: ${isDark ? '#e5e5e5' : '#333333'};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        opacity: 0;
        transition: opacity 0.1s ease-out;
    `;

    return overlay;
}

/**
 * Create a compact preview for file blocks
 */
export function createFilePreview(blockElement: Element, isDark: boolean): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'bn-drag-overlay bn-drag-overlay-file';
    overlay.id = 'bn-custom-drag-overlay';

    const fileCard = blockElement.querySelector('.file-card-custom');
    const fileName = fileCard?.querySelector('.file-name')?.textContent || 'File';
    const fileType = fileCard?.querySelector('.file-type')?.textContent || '';
    const fileSize = fileCard?.querySelector('.file-size')?.textContent || '';

    // 文件类型图标颜色
    const typeColors: Record<string, string> = {
        'PDF': '#e53935',
        'DOCX': '#1976d2',
        'MD': '#43a047',
        'TXT': '#757575',
    };
    const iconColor = typeColors[fileType] || (isDark ? '#aaa' : '#666');

    overlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; max-width: 280px;">
            <div style="flex-shrink: 0; color: ${iconColor};">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                </svg>
            </div>
            <div style="min-width: 0; flex: 1;">
                <div style="font-weight: 500; font-size: 13px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(fileName)}</div>
                <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; opacity: 0.6; margin-top: 2px;">
                    ${fileType ? `<span>${escapeHtml(fileType)}</span>` : ''}
                    ${fileSize ? `<span>${escapeHtml(fileSize)}</span>` : ''}
                </div>
            </div>
        </div>
    `;

    overlay.style.cssText = getOverlayBaseStyle(isDark);
    return overlay;
}

/**
 * Create a compact preview for folder blocks
 */
export function createFolderPreview(blockElement: Element, isDark: boolean): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'bn-drag-overlay bn-drag-overlay-folder';
    overlay.id = 'bn-custom-drag-overlay';

    const folderCard = blockElement.querySelector('.folder-card-custom');
    const folderName = folderCard?.querySelector('.folder-name')?.textContent || 'Folder';
    const folderStats = folderCard?.querySelector('.folder-stats')?.textContent || '';

    overlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; max-width: 280px;">
            <div style="flex-shrink: 0; color: #f59e0b;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
            </div>
            <div style="min-width: 0; flex: 1;">
                <div style="font-weight: 500; font-size: 13px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(folderName)}</div>
                ${folderStats ? `<div style="font-size: 11px; opacity: 0.6; margin-top: 2px; color: ${isDark ? 'rgba(74, 143, 217, 0.7)' : 'rgba(74, 143, 217, 0.6)'};">${escapeHtml(folderStats)}</div>` : ''}
            </div>
        </div>
    `;

    overlay.style.cssText = getOverlayBaseStyle(isDark);
    return overlay;
}

/**
 * Get base overlay style for external blocks
 */
function getOverlayBaseStyle(isDark: boolean): string {
    return `
        position: fixed;
        z-index: 99999;
        padding: 4px 8px;
        background: ${isDark ? '#2d2d2d' : '#ffffff'};
        border-radius: 6px;
        box-shadow: 0 4px 12px ${isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.15)'};
        pointer-events: none;
        color: ${isDark ? '#e5e5e5' : '#333333'};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        opacity: 0;
        transition: opacity 0.1s ease-out;
    `;
}

/**
 * Create the overlay element showing block preview
 */
export function createOverlay(blockElement: Element): HTMLDivElement | null {
    // Detect theme - check for app's theme class on .app-container
    const appContainer = document.querySelector('.app-container');
    const isDark = appContainer?.classList.contains('dark')
        || document.documentElement.classList.contains('dark')
        || document.body.classList.contains('dark')
        || document.documentElement.getAttribute('data-color-scheme') === 'dark'
        || document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark';

    // Special handling for external blocks (bookmark, file, folder)
    if (isBookmarkBlock(blockElement)) {
        return createBookmarkPreview(blockElement, isDark);
    }
    if (isFileBlock(blockElement)) {
        return createFilePreview(blockElement, isDark);
    }
    if (isFolderBlock(blockElement)) {
        return createFolderPreview(blockElement, isDark);
    }

    const blockContent = blockElement.querySelector('.bn-block-content')
        || blockElement.querySelector('[data-content-type]')
        || blockElement;

    if (!blockContent) return null;

    const overlay = document.createElement('div');
    overlay.className = 'bn-drag-overlay';
    overlay.id = 'bn-custom-drag-overlay';

    overlay.style.cssText = `
        position: fixed;
        z-index: 99999;
        padding: 4px 8px;
        background: ${isDark ? '#2d2d2d' : '#ffffff'};
        border-radius: 6px;
        box-shadow: 0 4px 12px ${isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.15)'};
        max-width: 350px;
        max-height: 120px;
        overflow: hidden;
        pointer-events: none;
        color: ${isDark ? '#e5e5e5' : '#333333'};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        opacity: 0;
        transition: opacity 0.1s ease-out;
    `;

    // Clone content
    const clone = blockContent.cloneNode(true) as HTMLElement;

    // Remove interactive elements and action buttons
    clone.querySelectorAll('button, input, textarea, .bn-side-menu, [data-drag-handle], .bookmark-actions').forEach(el => el.remove());
    clone.querySelectorAll('[contenteditable]').forEach(el => {
        (el as HTMLElement).contentEditable = 'false';
    });

    // Reset styles on clone
    clone.style.pointerEvents = 'none';
    clone.style.userSelect = 'none';
    clone.style.margin = '0';

    // For images in the clone, ensure they display correctly
    clone.querySelectorAll('img').forEach(img => {
        img.style.maxWidth = '100%';
        img.style.maxHeight = '80px';
        img.style.objectFit = 'contain';
    });

    overlay.appendChild(clone);

    return overlay;
}
