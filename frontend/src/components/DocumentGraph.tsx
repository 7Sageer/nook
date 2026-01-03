import React, { useEffect, useState, useRef, useCallback } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { ArrowLeft, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
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
    onBack: () => void;
    onNodeClick: (docId: string) => void;
}

export const DocumentGraph: React.FC<DocumentGraphProps> = ({
    onBack,
    onNodeClick,
}) => {
    const { theme } = useSettings();
    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
    const [threshold, setThreshold] = useState(0.7);
    const [loading, setLoading] = useState(true);
    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
    const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);

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
            // 添加向心力，防止孤儿节点飞走
            graphRef.current.d3Force('center')?.strength(0.05);
            // 重新加热模拟
            graphRef.current.d3ReheatSimulation();
        }
    }, [graphData]);

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
    }, [onNodeClick]);

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

    return (
        <div className="graph-panel">
            {/* 头部 - 返回按钮 */}
            <div className="graph-panel-header">
                <button className="graph-back-btn" onClick={onBack}>
                    <ArrowLeft size={16} />
                    <span>Back to Settings</span>
                </button>
            </div>

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
                        onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
                        nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
                            const label = node.title;
                            const fontSize = 12 / globalScale;
                            // 同样使用对数缩放
                            const logVal = Math.log(Math.max(1, node.val) + 1) * 3;
                            const nodeSize = Math.max(2, Math.min(logVal, 12));

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

            {/* 图例 */}
            <div className="graph-legend">
                <span>Closer = more similar</span>
                <span>•</span>
                <span>Node size = content</span>
                <span>•</span>
                <span>Click to open</span>
            </div>
        </div>
    );
};
