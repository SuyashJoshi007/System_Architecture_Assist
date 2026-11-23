import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { ArchitectureNode, ComponentData } from './lib/workspace';
import { checkpoint, freshWorkspace, persistWorkspace, readWorkspace } from './lib/workspace';
import App from './App';

// Exercise the real shell, forms, decisions, and persistence without pretending
// jsdom can measure an interactive canvas. React Flow is checked in the browser.
vi.mock('./features/canvas/Canvas', async () => {
  const React = await import('react');
  type Props = { nodes: ArchitectureNode[]; edges: Edge[]; onCommit: (nodes: ArchitectureNode[], edges: Edge[], reason: string) => void; onSelect: (id: string | null) => void; onZoom: (zoom: number) => void; tool: string };
  return {
    default: React.forwardRef(function TestCanvas(props: Props, ref) {
      React.useImperativeHandle(ref, () => ({
        add: (data: ComponentData) => { props.onCommit([...props.nodes, { id: 'created-component', type: 'architecture', position: { x: 10, y: 10 }, data }], props.edges, `Added ${data.title}`); props.onSelect('created-component'); },
        zoomIn: () => props.onZoom(1.25), zoomOut: () => props.onZoom(0.75), fit: () => props.onZoom(1),
      }));
      return <div aria-label="Test canvas" data-tool={props.tool}>{props.nodes.map(n => <button key={n.id} onClick={() => props.onSelect(n.id)}>Select {n.data.title}</button>)}<button onClick={() => props.onCommit(props.nodes.map(n => n.id === 'web' ? { ...n, position: { x: 10, y: 210 } } : n), props.edges, 'Moved Web client')}>Move Web client</button></div>;
    }),
  };
});

async function mountApp() {
  const user = userEvent.setup();
  const view = render(<App />);
  await screen.findByRole('button', { name: 'Select Cache' });
  return { user, ...view };
}
const revision = (r: string) => screen.getByRole('button', { name: `Revision history, current ${r}` });

describe('workspace review workflow', () => {
  it('labels the example review and local-only workspace honestly', async () => {
    await mountApp();
    expect(screen.getByRole('heading', { name: '2 notes' })).toBeInTheDocument();
    expect(screen.getByText('Sample', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('LOCAL', { exact: true })).toBeInTheDocument();
    expect(revision('r07')).toBeInTheDocument();
  });

  it('accepts an applicable suggestion into a new draft and preserves its source', async () => {
    const { user } = await mountApp();
    await user.click(screen.getAllByRole('button', { name: 'Accept' })[0]);
    expect(revision('r08')).toBeInTheDocument();
    expect(screen.getByText('Accepted · local draft r08')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled();
    await waitFor(() => expect(readWorkspace().workspace.revision).toBe(8));
    const saved = readWorkspace().workspace;
    expect(saved.nodes.find(n => n.id === 'worker')?.data.note).toMatch(/idempotent/);
    expect(saved.history[0].revision).toBe(7);
    expect(saved.history[0].nodes.find(n => n.id === 'worker')?.data.note).toBeUndefined();
    expect(saved.decisions.retries).toEqual({ status: 'accepted', revision: 8 });
  });

  it('rejects a suggestion without altering the diagram or creating a revision', async () => {
    const { user } = await mountApp();
    await user.click(screen.getAllByRole('button', { name: 'Reject' })[0]);
    expect(revision('r07')).toBeInTheDocument();
    await waitFor(() => expect(readWorkspace().workspace.decisions.retries?.status).toBe('rejected'));
    expect(readWorkspace().workspace.nodes).toEqual(freshWorkspace().nodes);
  });

  it('prevents acceptance when the source diagram has changed', async () => {
    persistWorkspace(checkpoint(freshWorkspace(), 'Moved an element'));
    await mountApp();
    expect(screen.getAllByRole('button', { name: 'Accept' }).every(b => b.hasAttribute('disabled'))).toBe(true);
    expect(screen.getAllByText('Source changed · new review needed')).toHaveLength(2);
  });

  it('does not accept a suggestion targeting a removed component', async () => {
    const w = freshWorkspace();
    w.nodes = w.nodes.filter(n => n.id !== 'worker'); w.edges = w.edges.filter(e => e.target !== 'worker');
    persistWorkspace(w);
    const { user } = await mountApp();
    await user.click(screen.getAllByRole('button', { name: 'Accept' })[0]);
    expect(screen.getByText('The component referenced by this recommendation no longer exists.')).toBeInTheDocument();
    expect(revision('r07')).toBeInTheDocument();
  });

  it('retains a completed decision when the app is reopened', async () => {
    const { user, unmount } = await mountApp();
    await user.click(screen.getAllByRole('button', { name: 'Reject' })[0]);
    await waitFor(() => expect(readWorkspace().workspace.decisions.retries?.status).toBe('rejected'));
    unmount(); render(<App />);
    expect(screen.getByRole('heading', { name: '1 note' })).toBeInTheDocument();
    expect(screen.getByText('Dismissed')).toBeInTheDocument();
  });

  it('shows actual local revision history', async () => {
    persistWorkspace(checkpoint(freshWorkspace(), 'Moved Web client'));
    const { user } = await mountApp();
    await user.click(revision('r08'));
    const dialog = screen.getByRole('dialog', { name: 'Revision history' });
    expect(within(dialog).getByText('Moved Web client')).toBeInTheDocument();
    expect(within(dialog).getByText('r07')).toBeInTheDocument();
  });

  it('does not reset decisions when opening the live-review explanation', async () => {
    const w = freshWorkspace(); w.decisions.cache = { status: 'rejected', revision: 7 }; persistWorkspace(w);
    const { user } = await mountApp();
    await user.click(screen.getByRole('button', { name: 'Review diagram' }));
    expect(screen.getByRole('dialog', { name: 'Review this architecture' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View sample review' }));
    expect(screen.getByText('Dismissed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1 note' })).toBeInTheDocument();
  });
});

describe('editing and appearance', () => {
  it('switches both theme and browser theme preference', async () => {
    const { user } = await mountApp();
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('architecture-assist:theme')).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#F3F1EC');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('creates a component only when a nonblank name is supplied', async () => {
    const { user } = await mountApp();
    await user.click(screen.getByRole('button', { name: 'Add component' }));
    expect(screen.getByRole('button', { name: 'Add to canvas' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '   ');
    expect(screen.getByRole('button', { name: 'Add to canvas' })).toBeDisabled();
    await user.clear(screen.getByRole('textbox', { name: 'Name' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Payment service');
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Process requests');
    await user.click(screen.getByRole('button', { name: 'Add to canvas' }));
    expect(screen.getByRole('button', { name: 'Select Payment service' })).toBeInTheDocument();
    expect(revision('r08')).toBeInTheDocument();
    await waitFor(() => expect(readWorkspace().workspace.nodes).toHaveLength(7));
  });

  it('saves component context as a new local revision', async () => {
    const { user } = await mountApp();
    await user.click(screen.getByRole('button', { name: 'Select Cache' }));
    await user.type(screen.getByRole('textbox', { name: 'Note on Cache' }), 'Read-through cache');
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    expect(revision('r08')).toBeInTheDocument();
    await waitFor(() => expect(readWorkspace().workspace.nodes.find(n => n.id === 'cache')?.data.note).toBe('Read-through cache'));
  });

  it('routes tool and zoom controls to the canvas', async () => {
    const { user } = await mountApp();
    await user.click(screen.getByRole('button', { name: 'Hand tool' }));
    expect(screen.getByRole('button', { name: 'Hand tool' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Connect tool' }));
    expect(screen.getByLabelText('Test canvas')).toHaveAttribute('data-tool', 'connect');
    await user.click(screen.getByRole('button', { name: 'Select tool' }));
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByLabelText('Canvas zoom')).toHaveTextContent('125%');
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByLabelText('Canvas zoom')).toHaveTextContent('75%');
    await user.click(screen.getByRole('button', { name: 'Fit' }));
    expect(screen.getByLabelText('Canvas zoom')).toHaveTextContent('100%');
  });

  it('ignores tool shortcuts while entering a component note', async () => {
    const { user } = await mountApp();
    await user.keyboard('h');
    expect(screen.getByRole('button', { name: 'Hand tool' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Select Cache' }));
    await user.type(screen.getByRole('textbox', { name: 'Note on Cache' }), 'connect');
    expect(screen.getByRole('button', { name: 'Hand tool' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens component creation through the keyboard', async () => {
    const { user } = await mountApp();
    await user.keyboard('n');
    expect(screen.getByRole('dialog', { name: 'Add component' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('starts with a closed review drawer on narrow screens', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const { user } = await mountApp();
    expect(screen.queryByRole('heading', { name: '2 notes' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open AI review panel' }));
    expect(screen.getByRole('heading', { name: '2 notes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close AI review panel' }));
    expect(screen.queryByRole('heading', { name: '2 notes' })).not.toBeInTheDocument();
  });

  it.each([
    ['Requirements', 'Requirements', 'structured brief'],
    ['High-level design', 'High-level design', 'No HLD has been generated'],
    ['Low-level design', 'Low-level design', 'No LLD has been generated'],
  ])('explains the unconnected %s module without fabricating output', async (button, title, content) => {
    const { user } = await mountApp(); await user.click(screen.getByRole('button', { name: button }));
    expect(screen.getByRole('dialog', { name: title })).toHaveTextContent(content);
    await user.click(screen.getByRole('button', { name: 'Back to diagram' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('changes appearance through settings', async () => {
    const { user } = await mountApp(); await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Appearance' }), 'light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByText(/Model configuration will be supplied/)).toBeInTheDocument();
  });
});

describe('failure and recovery boundaries', () => {
  it('does not overwrite a corrupted stored copy after local interactions', async () => {
    localStorage.setItem('architecture-assist:workspace:v1', '{broken');
    const { user } = await mountApp();
    expect(screen.getByText(/saved local draft could not be loaded/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Reject' })[0]);
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(localStorage.getItem('architecture-assist:workspace:v1')).toBe('{broken');
  });

  it('reports write failures without showing a successful save', async () => {
    const { user } = await mountApp();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    await user.click(screen.getAllByRole('button', { name: 'Reject' })[0]);
    await screen.findByText('Not saved', { exact: true });
    expect(screen.getByText(/storage is unavailable or full/)).toBeInTheDocument();
    expect(screen.queryByText('Saved locally', { exact: true })).not.toBeInTheDocument();
  });

  it('warns on unload when the final write fails before the debounce finishes', async () => {
    const { user } = await mountApp();
    await user.click(screen.getAllByRole('button', { name: 'Reject' })[0]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    const event = new Event('beforeunload', { cancelable: true });
    act(() => window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
  });

  it('flushes pending changes when the page is hidden', async () => {
    const { user } = await mountApp();
    await user.click(screen.getAllByRole('button', { name: 'Reject' })[0]);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    expect(readWorkspace().workspace.decisions.retries.status).toBe('rejected');
  });
});
