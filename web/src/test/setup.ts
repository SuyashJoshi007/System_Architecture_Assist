import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no native modal top layer. Simulate only its open/close API;
// accessibility and form interactions still run against actual DOM elements.
Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
  configurable: true, value() { this.setAttribute('open', ''); },
});
Object.defineProperty(HTMLDialogElement.prototype, 'close', {
  configurable: true, value() { this.removeAttribute('open'); },
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.theme = 'dark';
  document.head.innerHTML = '<meta name="theme-color" content="#0A0B0C" />';
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
