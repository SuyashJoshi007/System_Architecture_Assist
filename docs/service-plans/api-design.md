# V1 Basic API Design

**Status:** Discussion draft\
**Scope:** Initial V1 API contracts only. No routes or implementation code are approved by this document unless marked agreed below.

**Alignment:** Reconciled on 2026-11-24 with the [HLD](../hld.md) and [database model](database-model.md). Agreed routes describe API design approval, not permission to implement. Later workspace/session and draft-export decisions supersede older terminology in the requirements baseline.

## Agreed API rules

- Workspace-scoped API actions use an authenticated user and the workspace's public UUID. The Core API resolves that user's session; clients do not choose another user's session ID.
- A session must be active to access workspace content or perform workspace actions. Workspace creation, minimal workspace listing, and account-bound invite redemption are bootstrap/navigation exceptions. Approval and AI review requests are associated with the active session on the server.
- Approval remains subject to the V1 owner or designated-approver rule.
- Creating a workspace creates the creator's active owner session in the same operation; that initial session does not require an invitation.
- A workspace invitation is bound to one user account, reusable, and has no expiry. Redeeming it creates that user's session on first use; redeeming it again reactivates the same session. Leaving sets `is_active` to false.
- API design is being planned before implementation.

## Agreed V1 workspace and session routes

These routes implement the agreed workflow. Except for workspace creation below, detailed payloads remain open. Invite creation requires the owner's active workspace session.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/workspaces` | Create a workspace and its creator's active session atomically. |
| `POST` | `/api/v1/workspaces/{workspace_uuid}/invites` | Create a reusable invite for a specific user account. |
| `POST` | `/api/v1/invites/redeem` | Redeem the authenticated user's invite; create or reactivate their session. |
| `POST` | `/api/v1/workspaces/{workspace_uuid}/session/leave` | Set the authenticated user's session to inactive. |

### Agreed workspace creation payload

Request to `POST /api/v1/workspaces`:

```json
{
  "name": "Order Management Architecture"
}
```

Response with HTTP `201 Created`:

```json
{
  "workspace_uuid": "7be63b6a-781c-4c2d-88bb-439107342382",
  "name": "Order Management Architecture",
  "session": {
    "is_active": true
  }
}
```

The creator is resolved from authentication. Workspace and owner session creation are atomic. Internal database `public_id` is exposed as `workspace_uuid` in the API.

## Agreed V1 workspace navigation routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/v1/workspaces` | List workspaces the signed-in user has joined, including those with inactive sessions. |
| `GET` | `/api/v1/workspaces/{workspace_uuid}` | Read workspace details through the authenticated user's active workspace session. |

Workspace listing requires authentication but does not require an active workspace session. It returns only minimal workspace identification and that user's session status, without granting access to workspace content. It follows the agreed cursor pagination format.

## Agreed V1 requirements routes

These routes and effects are agreed for the V1 API design.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/v1/workspaces/{workspace_uuid}/requirements` | Read the current structured requirements revision. |
| `POST` | `/api/v1/workspaces/{workspace_uuid}/requirements/revisions` | Create a new structured requirements revision. |
| `POST` | `/api/v1/workspaces/{workspace_uuid}/requirements/revisions/{revision_id}/review` | Request non-mutating AI feedback tied to the source revision and active session. |
| `POST` | `/api/v1/workspaces/{workspace_uuid}/requirements/revisions/{revision_id}/approval` | Approve or reject that exact revision, subject to approver authorization. |

Requirements revisions are append-only. AI review returns non-mutating recommendations tied to the source revision and active session. Approval records a decision against the exact revision.

## Agreed V1 diagram API direction

Diagram lifecycle and history use Core REST endpoints. Live canvas edits use the collaboration WebSocket and require an active-session ticket. These routes are examples; payloads and message types remain open.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/v1/workspaces/{workspace_uuid}/diagrams` | List workspace diagrams. |
| `POST` | `/api/v1/workspaces/{workspace_uuid}/diagrams` | Create a diagram. |
| `GET` | `/api/v1/workspaces/{workspace_uuid}/diagrams/{diagram_id}` | Read the latest diagram state. |
| `GET` | `/api/v1/workspaces/{workspace_uuid}/diagrams/{diagram_id}/revisions` | Read diagram revision history. |
| `POST` | `/api/v1/workspaces/{workspace_uuid}/diagrams/{diagram_id}/collaboration-ticket` | Validate the active session and issue a short-lived WebSocket ticket. |
| WebSocket | `/ws/v1/diagrams/{diagram_id}` | Exchange concurrent canvas edits and collaboration updates. |

### Agreed V1 diagram AI review route

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/workspaces/{workspace_uuid}/diagrams/{diagram_id}/revisions/{revision_id}/review` | Request non-mutating AI recommendations against the exact diagram snapshot through the authenticated user's active workspace session. |

The server verifies that the source revision belongs to the diagram and workspace in the route. Recommendations retain the reviewed revision and requesting session; requesting review does not apply changes to the diagram. Exact request/response payloads and review completion delivery remain open.

## Agreed V1 HLD/LLD generation direction

HLD and LLD generation requests are asynchronous. Clients poll a REST status endpoint for progress and completion. Exact request and response payload fields remain open.

All routes below are relative to `/api/v1/workspaces/{workspace_uuid}`. `document_kind` is `hld` or `lld`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/documents/{document_kind}/generations` | Start generation; return `202 Accepted` with a generation ID and status. |
| `GET` | `/generations/{generation_id}` | Return status and, when successful, the generated revision ID. |

- HLD generation requires an approved requirements revision.
- LLD generation requires an approved HLD revision.
- HLD approval does not automatically start LLD generation. The client explicitly requests LLD generation after approval.
- Generated content creates a new revision of the corresponding design document.
- Generation status is retrieved by polling a REST endpoint; a generation has queued, running, succeeded, or failed status.
- The request pins approved requirements for HLD, approved HLD for LLD, and selected diagram snapshots as applicable. Diagrams need not have a separate approval state. Generation uses those exact versions even if workspace content changes while the request is running.
- Generated revisions retain source links and model/prompt/knowledge provenance. Changes to those sources mark downstream designs as potentially stale without deleting their historical approval. Exact response fields and whether staleness is computed or stored remain open.

## Agreed V1 HLD/LLD retrieval and approval routes

All routes below are relative to `/api/v1/workspaces/{workspace_uuid}/documents/{document_kind}`, where `document_kind` is `hld` or `lld`. The base path has no additional suffix.

| Method | Path suffix | Purpose |
|---|---|---|
| `GET` | (base path) | Read the latest revision and its approval status. |
| `GET` | `/revisions` | List revision history. |
| `GET` | `/revisions/{revision_id}` | Read a specific revision. |
| `POST` | `/revisions/{revision_id}/approval` | Approve or reject that revision through an authorized active workspace session. |

All requests require an active session for the workspace. Approval also requires the V1 owner or designated-approver permission, and the revision must belong to the document and workspace in the route.

## Agreed V1 HLD/LLD editing route

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/workspaces/{workspace_uuid}/documents/{document_kind}/revisions` | Save edits as a new draft revision; `document_kind` is `hld` or `lld`. |

Earlier revisions and their approvals remain intact. Each new revision requires its own approval, submitted through an authorized active workspace session.

## Agreed V1 AI recommendation routes

All routes below are relative to `/api/v1/workspaces/{workspace_uuid}`.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/recommendations` | List recommendations, filterable by status or source revision. |
| `GET` | `/recommendations/{recommendation_id}` | Read the suggestion, rationale, and source revision. |
| `POST` | `/recommendations/{recommendation_id}/decision` | Submit `accept` or `reject` through the authenticated user's active workspace session. |

Acceptance requires approver permission and creates a new draft revision. Rejection records the decision without changing the content. A new document draft requires its own approval. The deciding session is resolved by the server; it can differ from the session that requested the recommendation.

The stored decision retains the deciding session, decision time, and resulting revision reference on acceptance. The requesting session is retained separately. All referenced records must belong to the same workspace. Requesting feedback or accepting a suggestion does not transfer artifact ownership to the session.

## Agreed V1 comment routes

All routes below are relative to `/api/v1/workspaces/{workspace_uuid}`.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/comments` | List comments, filtered by the relevant content. |
| `POST` | `/comments` | Add a comment or reply. |

Each comment identifies a source revision and may anchor to a diagram element or document section. Replies include the parent comment ID. The server resolves the author through the authenticated user's active workspace session. Exact payloads and the database representation of the author/anchor remain to be settled.

## Agreed V1 HLD/LLD export routes

All routes below are relative to `/api/v1/workspaces/{workspace_uuid}`. `document_kind` is `hld` or `lld`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/documents/{document_kind}/revisions/{revision_id}/exports` | Request a PDF or Markdown export of that exact revision. |
| `GET` | `/exports/{export_id}` | Poll export progress and retrieve the download link when ready. |

Exports are asynchronous and follow the generation polling pattern. Each exported document includes its revision number and whether it is draft or approved. Requests require the authenticated user's active workspace session.

The HLD export includes the diagram snapshot associated with that revision, rather than substituting the latest live canvas. Exact export metadata and download-link lifetime remain open.

## Agreed V1 requirements and document edit conflicts

- Each requirements or HLD/LLD save includes the `base_revision_id` the user edited.
- The server creates a new revision only if that base is still the latest revision of the target document.
- If another save has created a newer revision, return `409 Conflict` with the latest revision ID. The user reviews and resubmits their changes.
- The base check and creation must be atomic so concurrent saves cannot both succeed against the same base.
- Live diagram collaboration continues through the WebSocket; this REST save rule covers requirements and HLD/LLD edits.

## Agreed V1 error response format

Errors use a common JSON envelope with a machine-readable `code`, a displayable `message`, and optional `details`. The HTTP status indicates the error category.

Example response with HTTP `409 Conflict`:

```json
{
  "error": {
    "code": "revision_conflict",
    "message": "A newer revision exists. Review it before saving.",
    "details": {
      "latest_revision_id": 42
    }
  }
}
```

The frontend handles errors using `code`, displays `message`, and uses `details` for context.

## Agreed V1 list pagination

List endpoints use cursor pagination, including comments, recommendations, diagrams, and revision history. Clients pass `limit` and, for subsequent pages, the returned `cursor`.

Example request:

```http
GET /api/v1/workspaces/{workspace_uuid}/comments?limit=20&cursor=...
```

Example response:

```json
{
  "items": [],
  "next_cursor": null
}
```

The client follows `next_cursor` for more results; `null` means the end. Exact ordering, default/maximum limits, and cursor encoding remain open.

## Agreed V1 request retry behavior

Generation, export, approval, and recommendation-decision requests use an `Idempotency-Key` header. Clients reuse the same key when retrying the same operation after a timeout.

- The same key with the same payload returns the original result or job ID without creating duplicate work.
- The same key with a different payload returns `409 Conflict`.
- Authentication, active-session status, and applicable permissions are checked on every retry, including before replaying a stored response.

Key scoping and retention duration remain open for detailed contract planning.

## Agreed V1 single-resource success responses

Single-resource success responses return the resource object directly, without a surrounding `data` envelope. For example:

```json
{
  "generation_id": 123,
  "status": "queued",
  "document_kind": "hld"
}
```

Lists retain the `items` and `next_cursor` envelope. Errors retain the `error` envelope.

## Agreed V1 diagram saving and revision snapshots

- Accepted canvas updates are saved continuously, separately from reviewable revision snapshots.
- Diagram revision snapshots are created periodically and before AI review.
- AI feedback references the exact snapshot reviewed.
- Cursor positions and online presence are transient.

Snapshot intervals and the collaboration persistence mechanism remain open for service planning.

## Agreed V1 diagram WebSocket message categories

These categories describe behavior; they do not prescribe frame encoding or replace the collaboration protocol selected during service planning.

| Category | Purpose |
|---|---|
| Sync | Synchronize diagram state on connection or reconnection. |
| Edit | Exchange canvas changes. |
| Presence | Share collaborators' cursors and online activity. |
| Saved | Confirm which changes have been durably saved. |
| Conflict | Surface incompatible edits for resolution. |
| Error | Report invalid operations or access failures. |

## Agreed V1 diagram reconnection behavior

- A temporary network drop leaves the workspace session active; presence shows the user as disconnected.
- Reconnection checks authentication and active-session status before synchronizing changes.
- While reconnecting, the client retains unacknowledged edits and shows them as unsaved.
- Explicitly leaving sets `is_active` to false and ends collaboration access. Returning requires the invite flow.

Exact payloads, protocol encoding, and operational timing remain open for detailed service planning. This discussion draft is not an exhaustive API specification.

## HLD, API, and persistence alignment

| Concern | HLD boundary | API contract | Persistence |
|---|---|---|---|
| Workspace access | Django Core resolves active per-user workspace sessions | Workspace/session/invite routes above; navigation exceptions are explicit | One session per user/workspace; owner session has no invite prerequisite |
| Approval authority | Owner or designated approver acting through an active session | Revision approval and recommendation decision endpoints | Draft session permission flags; approval and recommendation decision session references |
| Shared content | One architecture effort per workspace | Requirements, multiple diagrams, one HLD and one LLD | Parent artifacts own revisions; session inactivity does not remove history |
| Generation | Core to durable queue to FastAPI orchestration to model gateway/connector | Async generation and polling routes above | Durable operation records plus source links and generation provenance; operation schema deferred |
| Diagram collaboration | Separate Django Channels/Yjs-compatible process | Active-session ticket and WebSocket, continuous saving, periodic snapshots | Durable updates/snapshots outside Redis; presence is transient |
| Recommendations | Worker produces proposals; Core handles explicit decisions | Source-specific review, retrieval, and decision routes | Separate requesting and deciding session references and accepted-result revision |
| Export | Async export workload and object storage | Exact-revision PDF/Markdown export and polling | Durable operation/result metadata; labeled draft or approved artifact |

## Required contracts still open in all design documents

These are remaining V1 design work, not implementation-ready contracts or features removed from V1:

- **Permanent access removal:** define owner-authorized removal and invite revocation/blocking. Temporary leave only sets `is_active = false`; permanent removal must prevent old-invite reactivation and terminate existing collaboration access. Storage and route shapes remain open.
- **AI review completion:** requirements and diagram review run through the queued AI-worker boundary. Their public accepted response, status endpoint, and polling/completion contract are not yet agreed. Generation polling above does not implicitly define review polling.
- **Model integration:** define owner-managed workspace connection configuration, customer connector onboarding/authentication, compatibility validation, and health/status visibility. Browser requests go through Core; the browser does not call the customer model. Exact management routes and connector/gateway protocol are pending.
- **Supporting records:** define durable operation, retry/idempotency, export metadata, and internal worker result contracts. All share workspace scope and retain requesting-session context. Departure of the requester during in-flight work needs an explicit policy.
- **Approval administration:** the ERD proposes `is_owner` and `is_designated_approver` session flags for the established rule; designation/ownership-management contracts remain open.
- **Traceability details:** finalize provenance payloads, stale-design response fields, and source handling for manual edits. Cost guidance must expose rationale, assumptions, and dated price sources when numeric; whether it needs a separate operation is open.
- **Authentication and payload details:** account/login contract, invite payloads, the creator's reactivation path after leaving (the initial owner session has no invite prerequisite), history reads for requirements and individual diagram revisions, initial requirements creation, pagination ordering/limits, idempotency scoping/retention, and exact WebSocket encoding remain pending.

Training, curated knowledge indexing, and adapter release management remain internal service contracts, with no new public browser routes implied by this API draft.
