import { Plugin, PluginKey, NodeSelection } from 'prosemirror-state';

const bookmarkSelectionPluginKey = new PluginKey('bookmarkSelection');

/**
 * ProseMirror plugin to prevent selecting internal content of bookmark blocks.
 * When a selection starts or ends inside a bookmark node, it converts it to a node selection.
 */
export function createBookmarkSelectionPlugin() {
    return new Plugin({
        key: bookmarkSelectionPluginKey,

        // Append transaction to modify selection if needed
        appendTransaction(transactions, oldState, newState) {
            const { selection } = newState;

            // Only handle text selections (not node selections)
            if (selection instanceof NodeSelection) {
                return null;
            }

            // Check if selection involves a bookmark node
            const { $from, $to } = selection;

            // Find bookmark node that contains the selection start
            let bookmarkPos: number | null = null;
            let bookmarkNode = null;

            // Walk up from $from to find bookmark ancestor
            for (let d = $from.depth; d >= 0; d--) {
                const node = $from.node(d);
                if (node.type.name === 'bookmark') {
                    bookmarkPos = $from.before(d);
                    bookmarkNode = node;
                    break;
                }
            }

            // If selection is inside a bookmark, convert to node selection
            if (bookmarkPos !== null && bookmarkNode) {
                const nodeSelection = NodeSelection.create(newState.doc, bookmarkPos);
                return newState.tr.setSelection(nodeSelection);
            }

            // Also check $to for cases where selection ends in bookmark
            for (let d = $to.depth; d >= 0; d--) {
                const node = $to.node(d);
                if (node.type.name === 'bookmark') {
                    bookmarkPos = $to.before(d);
                    bookmarkNode = node;
                    break;
                }
            }

            if (bookmarkPos !== null && bookmarkNode) {
                const nodeSelection = NodeSelection.create(newState.doc, bookmarkPos);
                return newState.tr.setSelection(nodeSelection);
            }

            return null;
        },
    });
}

export default createBookmarkSelectionPlugin;
