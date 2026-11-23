import type { Edge, Node } from '@xyflow/react';

export type ComponentData = { title: string; category: string; description: string; note?: string; review?: number; focused?: boolean };
export type ArchitectureNode = Node<ComponentData, 'architecture'>;
export type Decision = { status: 'accepted' | 'rejected'; revision: number };
export type Snapshot = { revision: number; reason: string; at: string; nodes: ArchitectureNode[]; edges: Edge[] };
export type Workspace = {
  version: 1;
  revision: number;
  nodes: ArchitectureNode[];
  edges: Edge[];
  decisions: Record<string, Decision>;
  history: Snapshot[];
};

export const recommendations = [
  { id: 'retries', number: 1, category: 'Reliability', title: 'Handle duplicate events', description: 'The queue may deliver an event more than once. Make worker operations safe to retry.', tradeoff: 'Requires tracking processed events.', nodeIds: ['queue', 'worker'], target: 'worker', note: 'Use idempotent event handling. Track processed event IDs and define a retention policy.', sourceRevision: 7 },
  { id: 'cache', number: 2, category: 'Cost and scale', title: 'Check cache value', description: 'Measure repeated reads before adding another service. Include operational cost in the decision.', tradeoff: 'Measurements are needed before choosing a cache.', nodeIds: ['cache'], target: 'cache', note: 'Measure repeated reads and compare the benefit with cache operating cost before committing.', sourceRevision: 7 },
];

export function freshWorkspace(): Workspace {
  const definitions = [
    ['cache', 'Cache', 'MEMORY', 'Frequently read data', 328, 0],
    ['web', 'Web client', 'CLIENT', 'React application', 0, 200],
    ['api', 'Core API', 'SERVICE', 'Application boundary', 328, 200],
    ['queue', 'Message queue', 'BROKER', 'Background work', 656, 200],
    ['db', 'PostgreSQL', 'STORAGE', 'Durable records', 328, 400],
    ['worker', 'Worker', 'COMPUTE', 'Asynchronous tasks', 656, 400],
  ] as const;
  return {
    version: 1, revision: 7, decisions: {}, history: [],
    nodes: definitions.map(([id, title, category, description, x, y]) => ({ id, type: 'architecture', position: { x, y }, data: { title, category, description }, width: 200, height: 84 })),
    edges: [
      { id: 'web-api', source: 'web', target: 'api', sourceHandle: 'right', targetHandle: 'left', label: 'HTTPS', type: 'straight' },
      { id: 'api-queue', source: 'api', target: 'queue', sourceHandle: 'right', targetHandle: 'left', label: 'events', type: 'straight', className: 'flow-edge' },
      { id: 'cache-api', source: 'cache', target: 'api', sourceHandle: 'bottom', targetHandle: 'top', type: 'straight' },
      { id: 'api-db', source: 'api', target: 'db', sourceHandle: 'bottom', targetHandle: 'top', type: 'straight' },
      { id: 'queue-worker', source: 'queue', target: 'worker', sourceHandle: 'bottom', targetHandle: 'top', type: 'straight' },
    ],
  };
}

const KEY = 'architecture-assist:workspace:v1';

function validGraph(nodes: unknown, edges: unknown): boolean {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return false;
  const ids = new Set<string>();
  for (const n of nodes) {
    if (typeof n?.id !== 'string' || ids.has(n.id) || n.type !== 'architecture' || !Number.isFinite(n.position?.x) || !Number.isFinite(n.position?.y) || typeof n.data?.title !== 'string' || typeof n.data?.description !== 'string' || typeof n.data?.category !== 'string' || (n.data.note !== undefined && typeof n.data.note !== 'string')) return false;
    ids.add(n.id);
  }
  const edgeIds = new Set<string>();
  for (const e of edges) {
    if (typeof e?.id !== 'string' || edgeIds.has(e.id) || !ids.has(e.source) || !ids.has(e.target) || (e.label !== undefined && typeof e.label !== 'string')) return false;
    edgeIds.add(e.id);
  }
  return true;
}

export function readWorkspace(): { workspace: Workspace; warning?: string } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { workspace: freshWorkspace() };
    const w = JSON.parse(raw);
    if (w.version !== 1 || !Number.isSafeInteger(w.revision) || w.revision < 7 || !Array.isArray(w.nodes) || !Array.isArray(w.edges) || !Array.isArray(w.history) || !w.decisions || typeof w.decisions !== 'object' || Array.isArray(w.decisions)) throw new Error('Invalid local draft');
    if (!validGraph(w.nodes, w.edges)) throw new Error('Invalid diagram');
    for (const d of Object.values(w.decisions) as Decision[]) if (!d || !['accepted', 'rejected'].includes(d.status) || !Number.isSafeInteger(d.revision) || d.revision < 7 || d.revision > w.revision) throw new Error('Invalid decision');
    return { workspace: { ...w, history: w.history.filter((h: Snapshot) => Number.isSafeInteger(h?.revision) && h.revision >= 7 && h.revision < w.revision && typeof h.reason === 'string' && typeof h.at === 'string' && Number.isFinite(Date.parse(h.at)) && validGraph(h.nodes, h.edges)).slice(-20) } };
  } catch {
    return { workspace: freshWorkspace(), warning: 'The saved local draft could not be loaded. Your stored copy is preserved; this session starts with the example diagram.' };
  }
}

export function persistWorkspace(workspace: Workspace) {
  localStorage.setItem(KEY, JSON.stringify(workspace));
}

export function checkpoint(w: Workspace, reason: string, nodes = w.nodes, edges = w.edges): Workspace {
  return { ...w, nodes, edges, revision: w.revision + 1, history: [...w.history, { revision: w.revision, reason, at: new Date().toISOString(), nodes: structuredClone(w.nodes), edges: structuredClone(w.edges) }].slice(-20) };
}

export function revisionLabel(revision: number) { return `r${String(revision).padStart(2, '0')}`; }
