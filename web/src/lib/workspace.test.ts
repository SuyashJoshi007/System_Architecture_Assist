import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkpoint, freshWorkspace, persistWorkspace, readWorkspace, revisionLabel } from './workspace';

const KEY = 'architecture-assist:workspace:v1';

describe('workspace persistence', () => {
  beforeEach(() => localStorage.clear());

  it('starts with the example diagram without writing it over stored data', () => {
    const result = readWorkspace();
    expect(result.warning).toBeUndefined();
    expect(result.workspace.nodes).toHaveLength(6);
    expect(result.workspace.edges).toHaveLength(5);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('round-trips a saved edit, component note, and decision', () => {
    const initial = freshWorkspace();
    const edited = checkpoint(initial, 'Added context', initial.nodes.map(n => n.id === 'worker' ? { ...n, data: { ...n.data, note: 'Retry safely' } } : n));
    edited.decisions.retries = { status: 'accepted', revision: 8 };
    persistWorkspace(edited);
    expect(readWorkspace()).toEqual({ workspace: edited });
  });

  it.each([
    ['malformed JSON', '{not-json'],
    ['null document', 'null'],
    ['unsupported format', JSON.stringify({ ...freshWorkspace(), version: 2 })],
    ['invalid revision', JSON.stringify({ ...freshWorkspace(), revision: -1 })],
    ['missing nodes', JSON.stringify({ ...freshWorkspace(), nodes: null })],
    ['missing edges', JSON.stringify({ ...freshWorkspace(), edges: null })],
    ['missing history', JSON.stringify({ ...freshWorkspace(), history: null })],
    ['invalid decisions', JSON.stringify({ ...freshWorkspace(), decisions: [] })],
    ['invalid decision status', JSON.stringify({ ...freshWorkspace(), decisions: { cache: { status: 'approved', revision: 7 } } })],
  ])('preserves the stored copy and warns on %s', (_, raw) => {
    localStorage.setItem(KEY, raw);
    const result = readWorkspace();
    expect(result.warning).toMatch(/could not be loaded/i);
    expect(result.workspace).toEqual(freshWorkspace());
    expect(localStorage.getItem(KEY)).toBe(raw);
  });

  it('rejects a duplicate component ID', () => {
    const w = freshWorkspace(); w.nodes.push({ ...w.nodes[0] });
    localStorage.setItem(KEY, JSON.stringify(w));
    expect(readWorkspace().warning).toBeDefined();
  });

  it('rejects edges that reference missing components', () => {
    const w = freshWorkspace(); w.edges[0].target = 'missing';
    localStorage.setItem(KEY, JSON.stringify(w));
    expect(readWorkspace().warning).toBeDefined();
  });

  it('rejects invalid position data', () => {
    const w = freshWorkspace(); w.nodes[0].position.x = NaN;
    localStorage.setItem(KEY, JSON.stringify(w));
    expect(readWorkspace().warning).toBeDefined();
  });

  it('filters unusable history entries instead of rendering broken snapshots', () => {
    const w = freshWorkspace();
    const raw = { ...w, history: [{ revision: 7, reason: 'Old edit', at: new Date().toISOString() }] };
    localStorage.setItem(KEY, JSON.stringify(raw));
    expect(readWorkspace().workspace.history).toEqual([]);
  });

  it('surfaces storage failures to the caller instead of claiming success', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(() => persistWorkspace(freshWorkspace())).toThrow();
  });

  it('recovers with a warning when storage reads are blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    expect(readWorkspace().warning).toBeDefined();
  });
});

describe('revision integrity', () => {
  it('keeps the previous revision and graph when creating a new checkpoint', () => {
    const w = freshWorkspace();
    const changed = w.nodes.map(n => n.id === 'web' ? { ...n, position: { x: 50, y: 210 } } : n);
    const next = checkpoint(w, 'Moved Web client', changed);
    expect(next.revision).toBe(8);
    expect(w.revision).toBe(7);
    expect(w.history).toHaveLength(0);
    expect(next.history[0].nodes.find(n => n.id === 'web')?.position).toEqual({ x: 0, y: 200 });
    expect(next.nodes.find(n => n.id === 'web')?.position.x).toBe(50);
  });

  it('keeps historical graphs independent of subsequent mutations', () => {
    const next = checkpoint(freshWorkspace(), 'Checkpoint');
    next.nodes[0].data.title = 'Renamed cache';
    next.edges[0].label = 'Changed label';
    expect(next.history[0].nodes[0].data.title).toBe('Cache');
    expect(next.history[0].edges[0].label).toBe('HTTPS');
  });

  it('bounds browser history while keeping the most recent revisions', () => {
    let w = freshWorkspace();
    for (let i = 0; i < 30; i++) w = checkpoint(w, `Edit ${i}`);
    expect(w.history).toHaveLength(20);
    expect(w.history[0].revision).toBe(17);
    expect(w.history.at(-1)?.revision).toBe(36);
  });

  it('creates independent example workspaces', () => {
    const first = freshWorkspace(); first.nodes[0].data.title = 'Changed';
    expect(freshWorkspace().nodes[0].data.title).toBe('Cache');
  });

  it('formats both short and long revision numbers', () => {
    expect(revisionLabel(7)).toBe('r07');
    expect(revisionLabel(123)).toBe('r123');
  });
});
