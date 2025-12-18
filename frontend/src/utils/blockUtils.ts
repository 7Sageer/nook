import { Block } from "@blocknote/core";

/**
 * 从 BlockNote 区块中提取纯文本内容
 */
export function extractTextFromBlock(block: Block): string {
    if (!block.content) return "";

    if (Array.isArray(block.content)) {
        return block.content
            .map((item: any) => {
                if (typeof item === "string") return item;
                if (item.type === "text" && item.text) return item.text;
                return "";
            })
            .join("");
    }

    return "";
}

/**
 * 从文档区块数组中提取第一个 H1 标题的文本
 * 如果第一个区块不是 H1, 返回 null
 */
export function extractFirstH1Title(blocks: Block[]): string | null {
    if (!blocks || blocks.length === 0) return null;

    const firstBlock = blocks[0];

    // 检查是否为 heading 类型且 level 为 1
    if (
        firstBlock.type === "heading" &&
        (firstBlock.props as any)?.level === 1
    ) {
        const text = extractTextFromBlock(firstBlock);
        return text.trim() || null;
    }

    return null;
}

/**
 * 从文档区块数组中提取标题
 * 优先查找第一个 H1 标题，如果没有则使用第一个有文本内容的区块
 */
export function extractDocumentTitle(blocks: Block[]): string | null {
    if (!blocks || blocks.length === 0) return null;

    // 优先找第一个 H1
    const firstH1 = blocks.find(
        b => b.type === "heading" && (b.props as any)?.level === 1
    );
    if (firstH1) {
        const text = extractTextFromBlock(firstH1);
        if (text.trim()) return text.trim();
    }

    // Fallback: 第一个有文本内容的区块
    for (const block of blocks) {
        const text = extractTextFromBlock(block);
        if (text.trim()) return text.trim();
    }

    return null;
}
