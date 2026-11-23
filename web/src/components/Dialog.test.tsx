import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('exposes a labeled modal and calls onClose from its close button', async () => {
    const onClose = vi.fn();
    render(<Dialog title="Add context" onClose={onClose}><p>Component information</p></Dialog>);
    expect(screen.getByRole('dialog', { name: 'Add context' })).toHaveAttribute('open');
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('handles native cancel events without treating clicks inside as backdrop clicks', () => {
    const onClose = vi.fn();
    render(<Dialog title="Review" onClose={onClose}><p>Details</p></Dialog>);
    fireEvent.click(screen.getByText('Details'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent(screen.getByRole('dialog'), new Event('cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes when the click lands outside the dialog bounds', () => {
    const onClose = vi.fn();
    render(<Dialog title="Review" onClose={onClose}><p>Details</p></Dialog>);
    const dialog = screen.getByRole('dialog');
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: 100, right: 500, top: 100, bottom: 400 } as DOMRect);
    fireEvent.click(dialog, { clientX: 10, clientY: 10 });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
