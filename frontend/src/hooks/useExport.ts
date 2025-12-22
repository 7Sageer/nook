import { useCallback, MutableRefObject } from 'react';
import { BlockNoteEditor } from '@blocknote/core';
import { ExportHTMLFile, PrintHTML } from '../../wailsjs/go/main/App';

interface UseExportOptions {
    editorRef: MutableRefObject<BlockNoteEditor | null>;
    documentTitle?: string;
    onSuccess?: (message: string) => void;
    onError?: (error: Error) => void;
}

interface UseExportReturn {
    handleExportHTML: () => Promise<void>;
    handlePrint: () => Promise<void>;
}

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

/**
 * Hook for exporting editor content to HTML and printing
 */
export function useExport({
    editorRef,
    documentTitle = 'document',
    onSuccess,
    onError,
}: UseExportOptions): UseExportReturn {

    const handleExportHTML = useCallback(async () => {
        const editor = editorRef.current;
        if (!editor) {
            onError?.(new Error('Editor not available'));
            return;
        }

        try {
            // Get HTML content from BlockNote
            const html = await editor.blocksToFullHTML(editor.document);
            const fullHTML = generatePrintHTML(html, documentTitle, false);

            // Save via backend dialog
            await ExportHTMLFile(fullHTML, documentTitle);
            onSuccess?.('HTML exported');
        } catch (error) {
            console.error('[Export] HTML export failed:', error);
            onError?.(error instanceof Error ? error : new Error('Export failed'));
        }
    }, [editorRef, documentTitle, onSuccess, onError]);

    const handlePrint = useCallback(async () => {
        const editor = editorRef.current;
        if (!editor) {
            onError?.(new Error('Editor not available'));
            return;
        }

        try {
            // Get HTML content from BlockNote
            const html = await editor.blocksToFullHTML(editor.document);
            const fullHTML = generatePrintHTML(html, documentTitle, true);

            // Save to temp file and open in browser via backend
            await PrintHTML(fullHTML, documentTitle);
            onSuccess?.('Opening print dialog...');
        } catch (error) {
            console.error('[Export] Print failed:', error);
            onError?.(error instanceof Error ? error : new Error('Print failed'));
        }
    }, [editorRef, documentTitle, onSuccess, onError]);

    return {
        handleExportHTML,
        handlePrint,
    };
}
