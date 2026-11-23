# Architecture Assist frontend

The initial React and TypeScript frontend implements the supplied Architecture Assist Redesign HTML. Vite runs the app; React Flow provides the editable diagram. Dark and light themes use the exact tokens from the supplied files. The bundled Space Grotesk and JetBrains Mono fonts load locally; their notices are in [public/fonts/LICENSE.txt](public/fonts/LICENSE.txt).

## Run locally

Use Node.js 22.12 or later and npm. From this directory:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. The server binds to loopback only.

```sh
npm run build
npm run preview
```

The build runs TypeScript checking before producing `dist/`.

## Automated checks

```sh
npm test
npm run test:coverage
npx playwright install chromium
npm run test:e2e
```

`npm run check` runs coverage tests, then builds and runs the browser suite. Unit and component tests use Vitest, React Testing Library, and jsdom. They cover storage recovery, immutable history, review decisions, theme preferences, forms, and unsaved-data failure handling. Canvas rendering is mocked in shell unit tests because jsdom cannot perform browser layout; Playwright tests exercise the actual React Flow graph separately.

Browser tests run the production build on port 4173, covering component creation, dragging and connections, reload persistence, review decisions, font loading, and the phone layout. Each test uses an isolated browser context. The coverage report excludes the canvas renderer; it is not a claim that browser-tested code has unit-test coverage.

The unit coverage gate is 80% statements, 75% branches, 80% functions, and 80% lines over the configured shell/dialog/workspace modules. Reports, browser binaries, installed packages, and builds are excluded from Git. See [contribution workflow](../CONTRIBUTING.md) for PR and deployment checks.

## Included in this build

- Matching graphite/lime dark theme and ivory/green light theme, with browser-persisted appearance preference.
- Drag/select components, pan, zoom, fit the diagram, and add components through the toolbar.
- Connect mode exposes connection points; drag from a source point to a target point. Delete/Backspace removes selected diagram elements.
- Select components to read/save notes through the contextual review panel.
- Two clearly labeled sample recommendations. Acceptance attaches the suggested note to the component in a new local revision. Rejection records a local decision. Acceptance of a stale recommendation is disabled.
- Local draft persistence, revision checkpoints, and JSON download. Snapshots retain earlier graph states; restoration is not implemented.
- Collapsible review panel, keyboard toolbar shortcuts, focus styles, and reduced-motion styling.
- Functional dialogs for sharing, settings, and revision history. Requirements/HLD/LLD navigation explains the corresponding workflow without fabricating generated documents.

Keyboard shortcuts outside text fields: `V` selects, `H` pans, `C` connects, and `N` opens component creation.

## Current integration boundary

This is a single-user frontend preview with browser-local storage. Authentication, session authorization, invitations, multi-user WebSocket sync, AI requests, server-side revision history, and document generation/export still require the planned backend services. The sample review is not model output. The JSON download is a local diagram backup, not the planned HLD/LLD PDF/Markdown export API.

The original HTML's review-reset and Undo controls are not used as a production approval/rollback workflow. Historical decisions remain recorded. Model and approval actions must ultimately be enforced by the Core API through active workspace sessions.

Local checkpoints are created after completed editing gestures and explicit changes; production continuous collaboration persistence and periodic snapshot timing remain service work. Browser storage may be cleared or unavailable; download important local drafts before relying on them.

## Code boundaries

- `src/App.tsx`: workspace shell, review UI, dialogs, theme, and local workflow.
- `src/features/canvas/Canvas.tsx`: lazily loaded React Flow canvas and node rendering.
- `src/lib/workspace.ts`: typed example data, local storage validation, and revision snapshots.
- `src/components/`: shared icon and accessible dialog primitives.
- `src/styles.css`: supplied theme tokens and responsive styling.

Reference files: [dark HTML](../docs/designs/frontend-approved-redesign.html), [dark and light board](../docs/designs/frontend-approved-redesign-light.html). These are design source archives and are not executed or served by the application. The frontend uses the official [React Flow custom-node API](https://reactflow.dev/learn/customization/custom-nodes) and [Vite build tooling](https://vite.dev/guide/).

## GitHub Pages

The production build uses relative asset paths so it works under the repository path on GitHub Pages. Only `web/dist` is published; source archives, repository docs, test artifacts, and credentials are not part of the site. Pages hosts this frontend preview only; it does not deploy Django, the model gateway, or collaboration services.
