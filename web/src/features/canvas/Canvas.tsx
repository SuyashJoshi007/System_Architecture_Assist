import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Handle, Position, Background, BackgroundVariant, addEdge, useReactFlow } from '@xyflow/react';
import type { Connection, Edge, NodeProps } from '@xyflow/react';
import type { ArchitectureNode, ComponentData } from '../../lib/workspace';
import { recommendations } from '../../lib/workspace';
import '@xyflow/react/dist/style.css';

const ComponentNode = memo(function ComponentNode({ data, selected }: NodeProps<ArchitectureNode>) {
  return <div className={`component-node${selected ? ' selected' : ''}${data.focused ? ' highlighted' : ''}`}>
    <Handle id="left" type="target" position={Position.Left} /><Handle id="top" type="target" position={Position.Top} />
    <div className="component-meta"><span className="mono">{data.category}</span><span className={`component-dot${data.title === 'Core API' ? ' live-dot' : ''}`} /></div>
    <div><div className="component-title">{data.title}</div><div className="component-description">{data.description}</div></div>
    {data.review && <span className="review-badge mono" aria-label={`Recommendation ${data.review}`}>{data.review}</span>}
    {data.note && <span className="node-note-indicator" title="This component has a note" />}
    <Handle id="right" type="source" position={Position.Right} /><Handle id="bottom" type="source" position={Position.Bottom} />
  </div>;
});
const nodeTypes = { architecture: ComponentNode };

export type CanvasControls = { zoomIn: () => void; zoomOut: () => void; fit: () => void; add: (data: ComponentData) => void };
type Props = {
  nodes: ArchitectureNode[]; edges: Edge[]; tool: 'select' | 'hand' | 'connect';
  focused: string | null; pending: string[]; theme: 'dark' | 'light';
  onCommit: (nodes: ArchitectureNode[], edges: Edge[], reason: string) => void;
  onSelect: (id: string | null) => void; onZoom: (value: number) => void;
};

const CanvasInner = forwardRef<CanvasControls, Props>(function CanvasInner(props, ref) {
  const [nodes, setNodes] = useState(props.nodes);
  const [edges, setEdges] = useState(props.edges);
  const flow = useReactFlow<ArchitectureNode>();
  useEffect(() => setNodes(props.nodes), [props.nodes]);
  useEffect(() => setEdges(props.edges), [props.edges]);
  useImperativeHandle(ref, () => ({
    zoomIn: () => { void flow.zoomIn({ duration: 150 }); },
    zoomOut: () => { void flow.zoomOut({ duration: 150 }); },
    fit: () => { void flow.fitView({ padding: 0.16, duration: 200 }); },
    add: (data) => {
      const viewport = document.querySelector('.canvas-stage')!.getBoundingClientRect();
      const position = flow.screenToFlowPosition({ x: viewport.left + viewport.width / 2 - 100, y: viewport.top + viewport.height / 2 - 42 });
      const id = crypto.randomUUID();
      props.onCommit([...nodes, { id, type: 'architecture', position, data, width: 200, height: 84 }], edges, `Added ${data.title}`);
      props.onSelect(id);
    },
  }));
  const displayedNodes = useMemo(() => nodes.map(n => {
    const rec = recommendations.find(r => props.pending.includes(r.id) && r.target === n.id);
    return { ...n, data: { ...n.data, review: rec?.number, focused: recommendations.find(r => r.id === props.focused)?.nodeIds.includes(n.id) ?? false } };
  }), [nodes, props.focused, props.pending]);
  const onConnect = (connection: Connection) => {
    if (connection.source === connection.target) return;
    const next = addEdge({ ...connection, type: 'smoothstep' }, edges);
    if (next.length !== edges.length) props.onCommit(nodes, next, 'Added a connection');
  };
  return <ReactFlow<ArchitectureNode>
    nodes={displayedNodes} edges={edges} nodeTypes={nodeTypes}
    onNodesChange={changes => setNodes(current => changes.applyTo(current))}
    onEdgesChange={changes => setEdges(current => changes.applyTo(current))}
    onNodeClick={(_, node) => props.onSelect(node.id)} onPaneClick={() => props.onSelect(null)}
    onNodeDragStop={(_, node) => {
      const previous = props.nodes.find(n => n.id === node.id);
      if (previous && (previous.position.x !== node.position.x || previous.position.y !== node.position.y)) props.onCommit(nodes.map(n => n.id === node.id ? { ...n, position: node.position } : n), edges, `Moved ${node.data.title}`);
    }}
    onDelete={({ nodes: removedNodes, edges: removedEdges }) => {
      const n = nodes.filter(node => !removedNodes.some(r => r.id === node.id));
      const e = edges.filter(edge => !removedEdges.some(r => r.id === edge.id) && n.some(node => node.id === edge.source) && n.some(node => node.id === edge.target));
      props.onCommit(n, e, 'Removed diagram elements'); props.onSelect(null);
    }}
    onConnect={onConnect} onMove={(_, viewport) => props.onZoom(viewport.zoom)}
    fitView fitViewOptions={{ padding: 0.16 }} minZoom={0.25} maxZoom={2}
    nodesDraggable={props.tool === 'select'} nodesConnectable={props.tool === 'connect'}
    panOnDrag={props.tool === 'hand' ? true : [1, 2]} selectionOnDrag={props.tool === 'select'}
    className={props.tool === 'connect' ? 'connecting-mode' : ''} deleteKeyCode={['Backspace', 'Delete']}
    defaultEdgeOptions={{ style: { strokeWidth: 1, strokeDasharray: '5 6' } }}
    aria-label="Editable architecture diagram"
  ><Background variant={BackgroundVariant.Dots} gap={24} size={0.7} color="var(--dot)" /></ReactFlow>;
});

const Canvas = forwardRef<CanvasControls, Props>(function Canvas(props, ref) {
  return <ReactFlowProvider><CanvasInner {...props} ref={ref} /></ReactFlowProvider>;
});
export default Canvas;
