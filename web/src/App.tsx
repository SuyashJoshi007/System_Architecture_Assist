import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Edge } from '@xyflow/react';
import { Icon } from './components/Icon';
import { Dialog } from './components/Dialog';
import { checkpoint, persistWorkspace, readWorkspace, recommendations, revisionLabel } from './lib/workspace';
import type { ArchitectureNode, ComponentData } from './lib/workspace';
import type { CanvasControls } from './features/canvas/Canvas';

const Canvas = lazy(() => import('./features/canvas/Canvas'));
type Modal = 'share' | 'review' | 'add' | 'history' | 'requirements' | 'hld' | 'lld' | 'settings' | null;
type Tool = 'select' | 'hand' | 'connect';

export default function App() {
  const [initial] = useState(readWorkspace);
  const [workspace, setWorkspace] = useState(initial.workspace);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const [tool, setTool] = useState<Tool>('select');
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 960);
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState('Local draft');
  const [notice, setNotice] = useState(initial.warning ?? '');
  const [componentNote, setComponentNote] = useState('');
  const canvas = useRef<CanvasControls>(null);
  const lastSaved = useRef(JSON.stringify(initial.workspace));
  const pending = useMemo(() => recommendations.filter(r => !workspace.decisions[r.id]).map(r => r.id), [workspace.decisions]);
  const selectedNode = workspace.nodes.find(n => n.id === selected);

  useEffect(() => { setComponentNote(selectedNode?.data.note ?? ''); }, [selectedNode?.id, selectedNode?.data.note]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0A0B0C' : '#F3F1EC');
    try { localStorage.setItem('architecture-assist:theme', theme); } catch { /* Theme still works in memory. */ }
  }, [theme]);
  useEffect(() => {
    const serialized = JSON.stringify(workspace);
    if (serialized === lastSaved.current || initial.warning) return;
    setStatus('Saving locally…');
    const timer = window.setTimeout(() => {
      try { persistWorkspace(workspace); lastSaved.current = serialized; setStatus('Saved locally'); }
      catch { setStatus('Not saved'); setNotice('Browser storage is unavailable or full. Download the local draft before leaving.'); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [workspace, initial.warning]);
  useEffect(() => {
    const saveBeforeExit = () => {
      const serialized = JSON.stringify(workspace);
      if (serialized === lastSaved.current) return true;
      if (initial.warning) return false;
      try { persistWorkspace(workspace); lastSaved.current = serialized; return true; }
      catch { return false; }
    };
    const warn = (e: BeforeUnloadEvent) => { if (!saveBeforeExit()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    const onVisibility = () => { if (document.visibilityState === 'hidden') saveBeforeExit(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('visibilitychange', onVisibility); };
  }, [workspace, status, initial.warning]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, dialog, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 'v') setTool('select');
      if (e.key.toLowerCase() === 'h') setTool('hand');
      if (e.key.toLowerCase() === 'c') setTool('connect');
      if (e.key.toLowerCase() === 'n') setModal('add');
      if (e.key === 'Escape') { setFocused(null); setSelected(null); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  const commit = useCallback((nodes: ArchitectureNode[], edges: Edge[], reason: string) => {
    const clean = nodes.map(n => ({ ...n, selected: false, data: { title: n.data.title, category: n.data.category, description: n.data.description, ...(n.data.note ? { note: n.data.note } : {}) } }));
    setWorkspace(w => checkpoint(w, reason, clean, edges));
  }, []);

  function decide(id: string, decision: 'accepted' | 'rejected') {
    const rec = recommendations.find(r => r.id === id)!;
    if (workspace.decisions[id]) return;
    if (decision === 'accepted' && rec.sourceRevision !== workspace.revision) { setNotice('This recommendation refers to revision 07. Review the current diagram before applying it. Live AI review is not connected yet.'); return; }
    if (decision === 'accepted' && !workspace.nodes.some(n => n.id === rec.target)) { setNotice('The component referenced by this recommendation no longer exists.'); return; }
    setWorkspace(w => {
      if (w.decisions[id] || (decision === 'accepted' && w.revision !== rec.sourceRevision)) return w;
      const updated = decision === 'accepted' ? checkpoint(w, `Accepted: ${rec.title}`, w.nodes.map(n => n.id === rec.target ? { ...n, data: { ...n.data, note: rec.note } } : n)) : w;
      return { ...updated, decisions: { ...updated.decisions, [id]: { status: decision, revision: updated.revision } } };
    });
    setFocused(null);
    setNotice(decision === 'accepted' ? 'New local draft created. The recommendation is saved as a component note.' : 'Recommendation dismissed from this local draft.');
  }

  function saveNote() {
    if (!selectedNode || componentNote === (selectedNode.data.note ?? '')) return;
    commit(workspace.nodes.map(n => n.id === selected ? { ...n, data: { ...n.data, note: componentNote.trim() } } : n), workspace.edges, `Updated note on ${selectedNode.data.title}`);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `order-platform-${revisionLabel(workspace.revision)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className={`app${panelOpen ? ' panel-open' : ''}`}>
    <a className="skip-link" href="#workspace-canvas">Skip to diagram</a>
    <header className="header">
      <div className="identity"><Icon name="logo" size={24} /><span className="workspace-name">Order Platform</span><span className="breadcrumb-separator">/</span><span className="breadcrumb">Architecture</span><button className="revision-chip mono" onClick={() => setModal('history')} aria-label={`Revision history, current ${revisionLabel(workspace.revision)}`}>{revisionLabel(workspace.revision)}</button></div>
      <div className="header-actions"><span className="local-indicator mono">LOCAL</span><button className="btn" onClick={() => setModal('share')}>Share</button><button className="btn primary" aria-label="Review diagram" onClick={() => { setPanelOpen(true); setModal('review'); }}><span className="review-action-long">Review diagram</span><span className="review-action-short" aria-hidden="true">Review</span></button><button className="round" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} /></button>{!panelOpen && <button className="round" onClick={() => setPanelOpen(true)} aria-label="Open AI review panel"><Icon name="panel" size={18} /></button>}</div>
    </header>

    <nav className="navigation-rail" aria-label="Workspace sections">
      <button className="rail" aria-label="Requirements" data-label="Requirements" onClick={() => setModal('requirements')}><Icon name="requirements" /></button>
      <button className="rail active" aria-label="Diagrams" aria-current="page" data-label="Diagrams" onClick={() => { setModal(null); canvas.current?.fit(); }}><Icon name="diagram" /></button>
      <button className="rail mono" aria-label="High-level design" data-label="High-level design" onClick={() => setModal('hld')}>HLD</button>
      <button className="rail mono" aria-label="Low-level design" data-label="Low-level design" onClick={() => setModal('lld')}>LLD</button>
      <span className="rail-divider" />
      <button className="rail" aria-label="Settings" data-label="Settings" onClick={() => setModal('settings')}><Icon name="settings" /></button>
    </nav>

    <main id="workspace-canvas" className="canvas-stage" tabIndex={-1} aria-label="Architecture canvas">
      <Suspense fallback={<div className="canvas-loading mono" role="status">Loading canvas…</div>}><Canvas ref={canvas} nodes={workspace.nodes} edges={workspace.edges} tool={tool} focused={focused} pending={pending} theme={theme} onCommit={commit} onSelect={setSelected} onZoom={setZoom} /></Suspense>
    </main>

    <div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
      <button className={`tool-button${tool === 'select' ? ' active' : ''}`} onClick={() => setTool('select')} aria-label="Select tool" aria-pressed={tool === 'select'} title="Select (V)"><Icon name="select" size={18} /></button>
      <button className={`tool-button${tool === 'hand' ? ' active' : ''}`} onClick={() => setTool('hand')} aria-label="Hand tool" aria-pressed={tool === 'hand'} title="Hand (H)"><Icon name="hand" size={18} /></button>
      <button className="tool-button" onClick={() => setModal('add')} aria-label="Add component" title="Add component (N)"><Icon name="add" size={18} /></button>
      <button className={`tool-button${tool === 'connect' ? ' active' : ''}`} onClick={() => setTool('connect')} aria-label="Connect tool" aria-pressed={tool === 'connect'} title="Connect (C)"><Icon name="connect" size={18} /></button>
      <span className="toolbar-divider" /><button className="zoom-button mono" aria-label="Zoom out" onClick={() => canvas.current?.zoomOut()}>−</button><output className="zoom-level mono" aria-label="Canvas zoom">{Math.round(zoom * 100)}%</output><button className="zoom-button mono" aria-label="Zoom in" onClick={() => canvas.current?.zoomIn()}>+</button><button className="zoom-button mono fit-button" onClick={() => canvas.current?.fit()}>Fit</button>
    </div>
    {tool === 'connect' && <div className="tool-hint mono">Drag between component connection points. Esc to dismiss selection.</div>}
    <footer className="workspace-status mono"><span className={`status-dot${status === 'Not saved' ? ' warning' : ''}`} /><span role="status">{initial.warning ? 'Storage unavailable' : status}</span><span className="status-detail">· Single-user preview · Illustrative architecture</span></footer>

    {panelOpen && <aside className="review-panel" aria-labelledby="review-title">
      <div className="review-heading"><span className="eyebrow mono">AI REVIEW</span><div><span className="mono panel-revision">r07</span><button className="close-panel" onClick={() => setPanelOpen(false)} aria-label="Close AI review panel"><Icon name="close" size={14} /></button></div></div>
      <h1 id="review-title">{pending.length ? `${pending.length} ${pending.length === 1 ? 'note' : 'notes'}` : 'Review complete'}</h1>
      <p className="review-source">Overview · Revision 07 <span className="sample-label">Sample</span></p>
      <div className="recommendations">
        {recommendations.map(rec => {
          const decision = workspace.decisions[rec.id]; const stale = workspace.revision !== rec.sourceRevision;
          return <section className="recommendation" key={rec.id}>
            <button className={`recommendation-focus${focused === rec.id ? ' focused' : ''}`} aria-pressed={focused === rec.id} onClick={() => setFocused(focused === rec.id ? null : rec.id)}><span className="eyebrow mono accent">{rec.category}</span><span className="recommendation-title">{rec.title}</span></button>
            <p>{rec.description}</p>{rec.id === 'retries' && <div className="tradeoff"><span className="eyebrow mono">TRADEOFF</span><span>{rec.tradeoff}</span></div>}
            {!decision ? <><div className="decision-actions"><button className="btn primary" onClick={() => decide(rec.id, 'accepted')} disabled={stale} title={stale ? 'The diagram has changed since this sample review.' : 'Create a draft with this recommendation as a component note'}>Accept</button><button className="btn" onClick={() => decide(rec.id, 'rejected')}>Reject</button></div>{stale && <p className="stale-note mono">Source changed · new review needed</p>}</> : <p className={`decision-result mono${decision.status === 'accepted' ? ' accent' : ''}`}>{decision.status === 'accepted' ? `Accepted · local draft ${revisionLabel(decision.revision)}` : 'Dismissed'}</p>}
          </section>;
        })}
      </div>
      <p className="panel-footnote mono">Accepting creates a new local draft revision.</p>
      <section className="component-context"><span className="eyebrow mono">CONTEXT</span><p>{selectedNode ? selectedNode.data.title : 'Select a component to add context.'}</p>{selectedNode && <form onSubmit={e => { e.preventDefault(); saveNote(); }}><label className="sr-only" htmlFor="component-note">Note on {selectedNode.data.title}</label><textarea id="component-note" className="input" placeholder="Add a component note…" value={componentNote} onChange={e => setComponentNote(e.target.value)} rows={3} maxLength={2000} /><div className="context-actions"><button className="btn small" type="submit" disabled={componentNote === (selectedNode.data.note ?? '')}>Save note</button></div></form>}</section>
    </aside>}

    {notice && <div className="notice" role="status"><span>{notice}</span><button className="close-panel" onClick={() => setNotice('')} aria-label="Dismiss notification"><Icon name="close" size={16} /></button></div>}
    {modal && <Dialog title={({ share: 'Share workspace', review: 'Review this architecture', add: 'Add component', history: 'Revision history', requirements: 'Requirements', hld: 'High-level design', lld: 'Low-level design', settings: 'Workspace settings' })[modal]} onClose={() => setModal(null)}>
      {modal === 'add' && <ComponentForm onAdd={data => { canvas.current?.add(data); setTool('select'); setModal(null); }} />}
      {modal === 'share' && <><p>This workspace is currently a local draft on this browser. Team invites and live collaboration will connect through the workspace API.</p><p>You can download a copy of your current diagram and local revision history.</p><button className="btn primary" onClick={download}><Icon name="download" size={16} /> Download local draft</button></>}
      {modal === 'review' && <><p>The two notes shown are sample recommendations attached to revision 07. Live AI review requires your workspace API and customer-hosted model connection.</p><p>Accepting an applicable sample note explicitly applies it to the component in a new local revision.</p><button className="btn primary" onClick={() => { setPanelOpen(true); setModal(null); }}>View sample review</button></>}
      {modal === 'history' && <><p className="muted">Current local revision: {revisionLabel(workspace.revision)}. Previous snapshots are retained for inspection; restoration is not part of this build.</p><ol className="history-list">{[...workspace.history].reverse().map(h => <li key={h.revision}><span className="mono">{revisionLabel(h.revision)}</span><div><strong>{h.reason}</strong><span className="muted">{new Date(h.at).toLocaleString()}</span><span className="muted">{h.nodes.length} components · {h.edges.length} connections</span></div></li>)}</ol>{workspace.history.length === 0 && <p>No edits yet. Move a component, add a connection, or save a note to create a local checkpoint.</p>}<button className="btn" onClick={download}>Download revision history</button></>}
      {['requirements', 'hld', 'lld'].includes(modal) && <><p className="eyebrow mono accent">DIAGRAM WORKSPACE PREVIEW</p><p>{modal === 'requirements' ? 'The requirements editor will hold the workspace’s structured brief and its saved revision history.' : modal === 'hld' ? 'HLD generation uses a selected saved requirements revision on explicit request. No HLD has been generated for this local example.' : 'LLD generation uses a selected existing HLD revision on explicit request. No LLD has been generated for this local example.'}</p><p className="muted">Document endpoints are designed but are not connected in this frontend build.</p><button className="btn" onClick={() => setModal(null)}>Back to diagram</button></>}
      {modal === 'settings' && <><label className="field-label" htmlFor="theme">Appearance</label><select id="theme" className="input" value={theme} onChange={e => setTheme(e.target.value as 'light' | 'dark')}><option value="dark">Dark · graphite and lime</option><option value="light">Light · warm ivory and green</option></select><div className="settings-section"><span className="eyebrow mono">STORAGE</span><p>Your draft stays in this browser. Local browser storage is not a workspace backup.</p><button className="btn" onClick={download}>Download local draft</button></div><div className="settings-section"><span className="eyebrow mono">MODEL CONNECTION</span><p className="muted">Not connected. Model configuration will be supplied by the Core API.</p></div></>}
    </Dialog>}
  </div>;
}

function ComponentForm({ onAdd }: { onAdd: (data: ComponentData) => void }) {
  const [title, setTitle] = useState(''); const [category, setCategory] = useState('SERVICE'); const [description, setDescription] = useState('');
  return <form className="component-form" onSubmit={e => { e.preventDefault(); if (title.trim()) onAdd({ title: title.trim(), category, description: description.trim() }); }}>
    <label className="field-label" htmlFor="component-name">Name<input id="component-name" className="input" autoFocus value={title} onChange={e => setTitle(e.target.value)} required maxLength={40} placeholder="e.g. Payment service" /></label>
    <label className="field-label" htmlFor="component-category">Category<select id="component-category" className="input" value={category} onChange={e => setCategory(e.target.value)}>{['SERVICE', 'CLIENT', 'STORAGE', 'BROKER', 'MEMORY', 'COMPUTE', 'EXTERNAL'].map(v => <option key={v}>{v}</option>)}</select></label>
    <label className="field-label" htmlFor="component-description">Description<input id="component-description" className="input" value={description} onChange={e => setDescription(e.target.value)} maxLength={70} placeholder="What does this component do?" /></label>
    <div className="form-actions"><button className="btn primary" type="submit" disabled={!title.trim()}>Add to canvas</button></div>
  </form>;
}
