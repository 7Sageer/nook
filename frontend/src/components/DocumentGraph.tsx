import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Maximize2, HelpCircle } from 'lucide-react';
import { forceX, forceY } from 'd3-force';
import { GetDocumentGraph } from '../../wailsjs/go/main/App';
import { useSettings } from '../contexts/SettingsContext';
import './DocumentGraph.css';

// 节点类型定义
type NodeType = 'document' | 'bookmark' | 'file' | 'folder';

interface GraphNode {
    id: string;
    type: NodeType;
    title: string;
    tags?: string[];
    val: number;
    parentDocId?: string;
    parentBlockId?: string;
    x?: number;
    y?: number;
    color?: string;
}

interface GraphLink {
    source: string | GraphNode;
    target: string | GraphNode;
    similarity: number;
    hasSemantic?: boolean;
    hasTags?: boolean;
}

interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

interface DocumentGraphProps {
    onNodeClick: (docId: string, blockId?: string) => void;
}

// 节点类型配置
const NODE_TYPE_CONFIG: Record<NodeType, { color: string; label: string }> = {
    document: { color: '#6366f1', label: '📄' },  // Blue - Indigo
    bookmark: { color: '#10b981', label: '🔖' },  // Green - Emerald
    file: { color: '#f59e0b', label: '📎' },      // Orange - Amber
    folder: { color: '#8b5cf6', label: '📁' },    // Purple - Violet
};

// 连线类型颜色配置
const LINK_TYPE_COLORS = {
    semantic: { dark: 'rgba(99, 102, 241, opacity)', light: 'rgba(79, 70, 229, opacity)' },
    tags: { dark: 'rgba(16, 185, 129, opacity)', light: 'rgba(5, 150, 105, opacity)' },
    both: { dark: 'rgba(168, 85, 247, opacity)', light: 'rgba(147, 51, 234, opacity)' },
};

export const DocumentGraph: React.FC<DocumentGraphProps> = ({
    onNodeClick,
}) => {
    const { theme } = useSettings();
    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
    const [threshold, setThreshold] = useState(0.75);
    const [loading, setLoading] = useState(true);
    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
    const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
    const isInitialLoad = useRef(true);

    // 计算有连接的节点 ID 集合（用于 fitToView 时排除孤儿节点）
    const connectedNodeIds = useMemo(() => {
        const ids = new Set<string>();
        graphData.links.forEach(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            ids.add(sourceId);
            ids.add(targetId);
        });
        return ids;
    }, [graphData.links]);

    // 加载图谱数据
    const loadGraphData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await GetDocumentGraph(threshold);
            if (data) {
                // 为节点添加颜色
                const nodes = (data.nodes || []).map((node: { id: string; type: string; title: string; tags?: string[]; val: number; parentDocId?: string; parentBlockId?: string }) => ({
                    ...node,
                    type: (node.type || 'document') as NodeType,
                    color: getNodeColor((node.type || 'document') as NodeType),
                }));
                setGraphData({
                    nodes,
                    links: data.links || []
                });
            }
        } catch (err) {
            console.error('Failed to load graph data:', err);
            setGraphData({ nodes: [], links: [] });
        } finally {
            setLoading(false);
        }
    }, [threshold]);

    useEffect(() => {
        isInitialLoad.current = true; // 数据变化时重置，以便新数据加载后居中
        loadGraphData();
    }, [loadGraphData]);

    // 配置力导向模拟：相似度越高，距离越近
    useEffect(() => {
        if (graphRef.current && graphData.nodes.length > 0) {
            // 配置链接力：距离基于相似度
            graphRef.current.d3Force('link')?.distance((link: GraphLink) => {
                const sim = link.similarity || 0.5;
                return 300 - sim * 200; // similarity 0.5 -> 200, 1.0 -> 100
            });
            // 适中的排斥力
            graphRef.current.d3Force('charge')?.strength(-120);
            // 使用 forceX 和 forceY 添加向心力（比 forceCenter 更有效）
            // 孤儿节点会被拉向中心，有连接的节点受链接力影响更大
            graphRef.current.d3Force('x', forceX(0).strength(0.05));
            graphRef.current.d3Force('y', forceY(0).strength(0.05));
            // 重新加热模拟
            graphRef.current.d3ReheatSimulation();
        }
    }, [graphData]);

    // 根据节点类型获取颜色
    const getNodeColor = (type: NodeType): string => {
        return NODE_TYPE_CONFIG[type]?.color || NODE_TYPE_CONFIG.document.color;
    };

    // 获取边的颜色（基于相似度及类型）
    const getLinkColor = (link: GraphLink): string => {
        const similarity = link.similarity;
        const alpha = 0.2 + similarity * 0.5;

        let colorConfig = LINK_TYPE_COLORS.semantic;
        if (link.hasSemantic && link.hasTags) {
            colorConfig = LINK_TYPE_COLORS.both;
        } else if (link.hasTags) {
            colorConfig = LINK_TYPE_COLORS.tags;
        }

        const baseColor = theme === 'dark' ? colorConfig.dark : colorConfig.light;
        return baseColor.replace('opacity', alpha.toString());
    };

    // 处理节点点击
    const handleNodeClick = useCallback((node: GraphNode) => {
        if (node.type === 'document') {
            // 文档节点：从 id 中提取 docId (格式: doc:{docId})
            const docId = node.id.replace('doc:', '');
            onNodeClick(docId);
        } else {
            // 外部块节点：跳转到父文档并定位到块
            if (node.parentDocId) {
                onNodeClick(node.parentDocId, node.parentBlockId);
            }
        }
    }, [onNodeClick]);

    // 绘制不同形状的节点
    const drawNodeShape = (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        size: number,
        type: NodeType,
        color: string
    ) => {
        ctx.fillStyle = color;
        ctx.beginPath();

        switch (type) {
            case 'document':
                // 圆形
                ctx.arc(x, y, size, 0, 2 * Math.PI);
                break;
            case 'bookmark':
                // 六边形
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 2;
                    const px = x + size * Math.cos(angle);
                    const py = y + size * Math.sin(angle);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                break;
            case 'file':
                // 正方形
                ctx.rect(x - size * 0.8, y - size * 0.8, size * 1.6, size * 1.6);
                break;
            case 'folder':
                // 菱形
                ctx.moveTo(x, y - size);
                ctx.lineTo(x + size, y);
                ctx.lineTo(x, y + size);
                ctx.lineTo(x - size, y);
                ctx.closePath();
                break;
            default:
                ctx.arc(x, y, size, 0, 2 * Math.PI);
        }

        ctx.fill();
    };

    // 缩放控制
    const handleZoomIn = () => {
        graphRef.current?.zoom(graphRef.current.zoom() * 1.3, 300);
    };

    const handleZoomOut = () => {
        graphRef.current?.zoom(graphRef.current.zoom() / 1.3, 300);
    };

    const handleZoomToFit = () => {
        // 只对有连接的节点进行 fitToView，排除孤儿节点
        // 如果所有节点都是孤儿，则包含所有节点
        if (connectedNodeIds.size > 0) {
            graphRef.current?.zoomToFit(400, 40, (node: GraphNode) => connectedNodeIds.has(node.id));
        } else {
            graphRef.current?.zoomToFit(400, 40);
        }
    };

    return (
        <div className="graph-panel">
            {/* 工具栏 */}
            <div className="graph-toolbar">
                <div className="threshold-control">
                    <label>Similarity:</label>
                    <input
                        type="range"
                        min="0.3"
                        max="0.9"
                        step="0.05"
                        value={threshold}
                        onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    />
                    <span>{threshold.toFixed(2)}</span>
                </div>
                <div className="zoom-controls">
                    <button onClick={handleZoomOut} title="Zoom Out">
                        <ZoomOut size={16} />
                    </button>
                    <button onClick={handleZoomToFit} title="Fit to View">
                        <Maximize2 size={16} />
                    </button>
                    <button onClick={handleZoomIn} title="Zoom In">
                        <ZoomIn size={16} />
                    </button>
                </div>
                {/* 图例 help 图标 */}
                <div className="legend-help-wrapper">
                    <button className="legend-help-btn" title="Legend">
                        <HelpCircle size={16} />
                    </button>
                    <div className="legend-tooltip">
                        <div className="legend-section">
                            <span className="legend-title">Nodes</span>
                            <div className="legend-items">
                                <span className="legend-item">
                                    <span className="legend-dot" style={{ backgroundColor: NODE_TYPE_CONFIG.document.color }}></span>
                                    Document
                                </span>
                                <span className="legend-item">
                                    <span className="legend-dot" style={{ backgroundColor: NODE_TYPE_CONFIG.bookmark.color }}></span>
                                    Bookmark
                                </span>
                                <span className="legend-item">
                                    <span className="legend-dot" style={{ backgroundColor: NODE_TYPE_CONFIG.file.color }}></span>
                                    File
                                </span>
                                <span className="legend-item">
                                    <span className="legend-dot" style={{ backgroundColor: NODE_TYPE_CONFIG.folder.color }}></span>
                                    Folder
                                </span>
                            </div>
                        </div>
                        <div className="legend-section">
                            <span className="legend-title">Links</span>
                            <div className="legend-items">
                                <span className="legend-item">
                                    <span className="legend-line" style={{ backgroundColor: theme === 'dark' ? 'rgb(99, 102, 241)' : 'rgb(79, 70, 229)' }}></span>
                                    Semantic
                                </span>
                                <span className="legend-item">
                                    <span className="legend-line" style={{ backgroundColor: theme === 'dark' ? 'rgb(16, 185, 129)' : 'rgb(5, 150, 105)' }}></span>
                                    Tags
                                </span>
                                <span className="legend-item">
                                    <span className="legend-line" style={{ backgroundColor: theme === 'dark' ? 'rgb(168, 85, 247)' : 'rgb(147, 51, 234)' }}></span>
                                    Both
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 图谱容器 */}
            <div className="graph-container">
                {loading ? (
                    <div className="graph-loading">Loading graph...</div>
                ) : graphData.nodes.length === 0 ? (
                    <div className="graph-empty">
                        No indexed documents found. Please rebuild the index first.
                    </div>
                ) : (
                    <ForceGraph2D
                        ref={graphRef}
                        graphData={graphData}
                        nodeLabel={(node: GraphNode) => `${NODE_TYPE_CONFIG[node.type]?.label || ''} ${node.title}`}
                        nodeColor={(node: GraphNode) => node.color || '#6366f1'}
                        nodeRelSize={4}
                        nodeVal={(node: GraphNode) => {
                            // 使用对数缩放减少大小差异：log(val + 1) * 3
                            const logVal = Math.log(Math.max(1, node.val) + 1) * 3;
                            return Math.max(2, Math.min(logVal, 12));
                        }}
                        linkColor={getLinkColor}
                        linkWidth={(link: GraphLink) => 0.5 + link.similarity * 2}
                        d3AlphaDecay={0.02}
                        d3VelocityDecay={0.3}
                        onNodeClick={handleNodeClick}
                        onNodeHover={(node: GraphNode | null) => setHoveredNode(node)}
                        backgroundColor={theme === 'dark' ? '#1a1a2e' : '#f8fafc'}
                        cooldownTicks={150}
                        onEngineStop={() => {
                            // 只在初始加载时自动居中，避免用户拖动后强制重新居中
                            if (isInitialLoad.current) {
                                isInitialLoad.current = false;
                                if (connectedNodeIds.size > 0) {
                                    graphRef.current?.zoomToFit(400, 50, (node: GraphNode) => connectedNodeIds.has(node.id));
                                } else {
                                    graphRef.current?.zoomToFit(400, 50);
                                }
                            }
                        }}
                        nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
                            const label = node.title;
                            const fontSize = 12 / globalScale;
                            // 同样使用对数缩放
                            const logVal = Math.log(Math.max(1, node.val) + 1) * 3;
                            const nodeSize = Math.max(2, Math.min(logVal, 12));

                            // 绘制不同形状的节点
                            drawNodeShape(ctx, node.x || 0, node.y || 0, nodeSize, node.type, node.color || '#6366f1');

                            // 高亮悬停节点
                            if (hoveredNode && hoveredNode.id === node.id) {
                                ctx.strokeStyle = theme === 'dark' ? '#fff' : '#000';
                                ctx.lineWidth = 2 / globalScale;
                                ctx.stroke();
                            }

                            // 绘制标签/标题
                            if (globalScale > 0.8 || (hoveredNode && hoveredNode.id === node.id)) {
                                ctx.font = `${fontSize}px Inter, sans-serif`;
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'top';

                                // 截断过长的标题
                                const maxLen = 20;
                                const typeLabel = NODE_TYPE_CONFIG[node.type]?.label || '';
                                const displayLabel = label.length > maxLen
                                    ? `${typeLabel} ${label.substring(0, maxLen)}...`
                                    : `${typeLabel} ${label}`;

                                // 标题背景
                                const textWidth = ctx.measureText(displayLabel).width;
                                const padding = 2 / globalScale;
                                ctx.fillStyle = theme === 'dark'
                                    ? 'rgba(26, 26, 46, 0.8)'
                                    : 'rgba(255, 255, 255, 0.8)';
                                ctx.fillRect(
                                    (node.x || 0) - textWidth / 2 - padding,
                                    (node.y || 0) + nodeSize + 2,
                                    textWidth + padding * 2,
                                    fontSize + padding * 2
                                );

                                // 标题文字
                                ctx.fillStyle = theme === 'dark' ? '#e2e8f0' : '#1e293b';
                                ctx.fillText(displayLabel, node.x || 0, (node.y || 0) + nodeSize + 4);

                                // 如果悬停且有 tags，显示 tags
                                if (hoveredNode && hoveredNode.id === node.id && node.tags && node.tags.length > 0) {
                                    const tagsStr = node.tags.join(', ');
                                    const tagFontSize = fontSize * 0.8;
                                    ctx.font = `${tagFontSize}px Inter, sans-serif`;

                                    const tagTextWidth = ctx.measureText(tagsStr).width;

                                    // Tag 背景
                                    ctx.fillStyle = theme === 'dark'
                                        ? 'rgba(26, 26, 46, 0.8)'
                                        : 'rgba(255, 255, 255, 0.8)';
                                    ctx.fillRect(
                                        (node.x || 0) - tagTextWidth / 2 - padding,
                                        (node.y || 0) + nodeSize + fontSize + padding * 4,
                                        tagTextWidth + padding * 2,
                                        tagFontSize + padding * 2
                                    );

                                    // Tag 文字
                                    ctx.fillStyle = theme === 'dark' ? '#94a3b8' : '#64748b';
                                    ctx.fillText(tagsStr, node.x || 0, (node.y || 0) + nodeSize + fontSize + padding * 4 + 1);
                                }
                            }
                        }}
                        nodePointerAreaPaint={(node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
                            const logVal = Math.log(Math.max(1, node.val) + 1) * 3;
                            const nodeSize = Math.max(2, Math.min(logVal, 12));
                            ctx.fillStyle = color;
                            ctx.beginPath();
                            ctx.arc(node.x || 0, node.y || 0, nodeSize + 5, 0, 2 * Math.PI);
                            ctx.fill();
                        }}
                    />
                )}
            </div>
        </div>
    );
};
