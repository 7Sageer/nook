import React, { useEffect, useState, useRef, useCallback } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { GetDocumentGraph } from '../../wailsjs/go/main/App';
import { useSettings } from '../contexts/SettingsContext';
import './DocumentGraph.css';

interface GraphNode {
    id: string;
    title: string;
    val: number;
    x?: number;
    y?: number;
    color?: string;
}

interface GraphLink {
    source: string | GraphNode;
    target: string | GraphNode;
    similarity: number;
}

interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

interface DocumentGraphProps {
    isOpen: boolean;
    onClose: () => void;
    onNodeClick: (docId: string) => void;
}

export const DocumentGraph: React.FC<DocumentGraphProps> = ({
    isOpen,
    onClose,
    onNodeClick,
}) => {
    const { theme } = useSettings();
    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
    const [threshold, setThreshold] = useState(0.5);
    const [loading, setLoading] = useState(true);
    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
    const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);

    // 加载图谱数据
    const loadGraphData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await GetDocumentGraph(threshold);
            if (data) {
                // 为节点添加颜色
                const nodes = (data.nodes || []).map((node: GraphNode) => ({
                    ...node,
                    color: getNodeColor(node.val),
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
        if (isOpen) {
            loadGraphData();
        }
    }, [isOpen, loadGraphData]);

    // 根据节点值计算颜色
    const getNodeColor = (val: number): string => {
        const hue = Math.min(200 + val * 10, 280); // 从蓝到紫
        return `hsl(${hue}, 70%, 50%)`;
    };

    // 获取边的颜色（基于相似度）
    const getLinkColor = (link: GraphLink): string => {
        const similarity = link.similarity;
        const alpha = 0.3 + similarity * 0.5;
        return theme === 'dark'
            ? `rgba(100, 150, 255, ${alpha})`
            : `rgba(50, 100, 200, ${alpha})`;
    };

    // 处理节点点击
    const handleNodeClick = useCallback((node: GraphNode) => {
        onNodeClick(node.id);
        onClose();
    }, [onNodeClick, onClose]);

    // 缩放控制
    const handleZoomIn = () => {
        graphRef.current?.zoom(graphRef.current.zoom() * 1.3, 300);
    };

    const handleZoomOut = () => {
        graphRef.current?.zoom(graphRef.current.zoom() / 1.3, 300);
    };

    const handleZoomToFit = () => {
        graphRef.current?.zoomToFit(400, 40);
    };

    // ESC 关闭
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className={`graph-overlay ${theme}`} onClick={onClose}>
            <div
                ref={containerRef}
                className={`graph-modal ${theme}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 头部 */}
                <div className="graph-header">
                    <h3>Document Relationship Graph</h3>
                    <button className="graph-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* 工具栏 */}
                <div className="graph-toolbar">
                    <div className="threshold-control">
                        <label>Similarity Threshold:</label>
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
                            nodeLabel={(node: GraphNode) => node.title}
                            nodeColor={(node: GraphNode) => node.color || '#6366f1'}
                            nodeRelSize={6}
                            nodeVal={(node: GraphNode) => Math.max(3, Math.min(node.val, 15))}
                            linkColor={getLinkColor}
                            linkWidth={(link: GraphLink) => 1 + link.similarity * 3}
                            onNodeClick={handleNodeClick}
                            onNodeHover={(node: GraphNode | null) => setHoveredNode(node)}
                            backgroundColor={theme === 'dark' ? '#1a1a2e' : '#f8fafc'}
                            cooldownTicks={100}
                            onEngineStop={() => graphRef.current?.zoomToFit(400, 40)}
                            nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
                                const label = node.title;
                                const fontSize = 12 / globalScale;
                                const nodeSize = Math.max(3, Math.min(node.val || 5, 15));

                                // 绘制节点圆形
                                ctx.beginPath();
                                ctx.arc(node.x || 0, node.y || 0, nodeSize, 0, 2 * Math.PI);
                                ctx.fillStyle = node.color || '#6366f1';
                                ctx.fill();

                                // 高亮悬停节点
                                if (hoveredNode && hoveredNode.id === node.id) {
                                    ctx.strokeStyle = theme === 'dark' ? '#fff' : '#000';
                                    ctx.lineWidth = 2 / globalScale;
                                    ctx.stroke();
                                }

                                // 绘制标签
                                if (globalScale > 0.8 || (hoveredNode && hoveredNode.id === node.id)) {
                                    ctx.font = `${fontSize}px Inter, sans-serif`;
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'top';

                                    // 截断过长的标签
                                    const maxLen = 20;
                                    const displayLabel = label.length > maxLen
                                        ? label.substring(0, maxLen) + '...'
                                        : label;

                                    // 标签背景
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

                                    // 标签文字
                                    ctx.fillStyle = theme === 'dark' ? '#e2e8f0' : '#1e293b';
                                    ctx.fillText(displayLabel, node.x || 0, (node.y || 0) + nodeSize + 4);
                                }
                            }}
                            nodePointerAreaPaint={(node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
                                const nodeSize = Math.max(3, Math.min(node.val || 5, 15));
                                ctx.fillStyle = color;
                                ctx.beginPath();
                                ctx.arc(node.x || 0, node.y || 0, nodeSize + 5, 0, 2 * Math.PI);
                                ctx.fill();
                            }}
                        />
                    )}
                </div>

                {/* 图例 */}
                <div className="graph-legend">
                    <span>Node size = content amount</span>
                    <span>•</span>
                    <span>Edge thickness = similarity strength</span>
                    <span>•</span>
                    <span>Click node to open document</span>
                </div>
            </div>
        </div>
    );
};
