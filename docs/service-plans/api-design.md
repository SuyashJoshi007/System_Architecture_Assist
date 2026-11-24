# V1 Basic API Design

**Status:** Discussion draft\
**Scope:** Initial V1 API contracts only. No routes or implementation code are approved by this document unless marked agreed below.

**Alignment:** Reconciled on 2026-11-24 with the [HLD](../hld.md) and [database model](database-model.md). Agreed routes describe API design approval, not permission to implement. Later workspace/session and draft-export decisions supersede older terminology in the requirements baseline.

## Agreed API rules

- V1 accounts use email/password through a custom Django user model, with canonical trimmed lowercase email as the unique login identifier and no separate username. Social login is deferred. Exact registration/login/logout, recovery, email verification/change, login transport, and account payload contracts are still to be discussed; this decision does not invent new account routes.
- Authentication requires an enabled account. Workspace-content access additionally requires `workspace_session.is_active = true` and `revoked_at IS NULL`. References to an active/authorized session throughout this contract include that revocation check. Django staff/superuser flags do not bypass customer workspace checks. Password fields and encoded hashes must not be returned by account APIs.
- Workspace-scoped API actions use an authenticated user and numeric `workspace_id`. The later workspace schema replaces the separate public UUID with a shared UUIDv4 `ref_id` used only for joining. Core resolves the acting user's session; clients do not choose another user's session ID.
- A session must be active to access workspace content or perform workspace actions. Workspace creation, minimal workspace listing, joining through the shared reference, and reactivation of the enabled account's own non-revoked owner session are bootstrap/navigation exceptions. AI review requests and recommendation decisions are associated with the active session on the server.
- Formal product approval has been removed. There are no revision-approval endpoints, approval states, or designated approvers. Active participants can edit and explicitly apply/reject suggestions; owner-only workspace administration remains separate.
- Creating a workspace creates the creator's active owner session in the same operation; that initial session does not require an invitation.
- Any enabled signed-in account possessing the workspace's current shared joining link can create or reactivate its own non-revoked session. A non-null `revoked_at` blocks reactivation even with a replacement joining reference. The link is reusable and non-expiring; it is not bound to a recipient. Leaving sets `is_active` to false without clearing revocation. Joining preserves permissions and never clears `revoked_at`. There is no separate invitation table.
- API design is being planned before implementation.

## Agreed V1 workspace and session routes

These routes implement the established create/leave workflow. Shared-link joining and owner link-management routes/payloads remain to be discussed; the older per-user invite-create/redeem contracts are superseded.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/workspaces` | Create a workspace and its creator's active session atomically. |
| `POST` | `/api/v1/workspaces/{workspace_id}/session/leave` | Set the authenticated user's session to inactive. |

### Workspace creation payload alignment

The request name field is agreed. The response example below aligns identity naming with the later schema; final response fields and owner-only delivery of the joining reference remain payload-planning work.

Request to `POST /api/v1/workspaces`:

```json
{
  "name": "Order Management Architecture"
}
```

Response with HTTP `201 Created`:

```json
{
  "workspace_id": 42,
  "name": "Order Management Architecture",
  "session": {
    "is_active": true
  }
}
```

The creator is resolved from authentication. Workspace creation atomically creates its active owner session, one requirements parent, and the two HLD/LLD parent records, initially without content revisions. Diagrams are created on request. `workspace_id` references `workspace.id`; there is no separate `public_id` UUID. The owner shares a frontend joining link containing `ref_id`. Ordinary list/content responses must not expose that joining credential. Exact owner retrieval/replacement and authenticated join contracts remain open; replacing the reference invalidates the old link without removing existing sessions.

## Agreed V1 workspace navigation routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/v1/workspaces` | List workspaces the signed-in user has joined, including those with inactive sessions. |
| `GET` | `/api/v1/workspaces/{workspace_id}` | Read workspace details through the authenticated user's active workspace session. |

Workspace listing requires an enabled authenticated account but does not require an active workspace session. It returns only minimal workspace identification and that user's non-revoked session status, without granting access to workspace content. Exclude revoked sessions from the removed participant's normal list. An enabled, inactive, non-revoked owner can reactivate their own session from this list without the shared link; other participants return through the current link. The exact owner-rejoin route/payload is still API planning. Listing follows the agreed cursor pagination format.

## Agreed V1 requirements routes

These routes and effects are agreed for the V1 API design.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/v1/workspaces/{workspace_id}/requirements` | Read the current structured requirements revision. |
| `POST` | `/api/v1/workspaces/{workspace_id}/requirements/revisions` | Create a new structured requirements revision. |
| `POST` | `/api/v1/workspaces/{workspace_id}/requirements/revisions/{revision_id}/review` | Request non-mutating AI feedback tied to the source revision and active session. |

Requirements revisions are append-only, complete JSONB content snapshots rather than activity-log entries or deltas. AI review produces non-mutating recommendations tied to the source revision and active session; its completion contract remains open below. Any saved requirements revision can be explicitly selected for HLD generation without a sign-off step.

## Agreed V1 diagram API direction

Diagram lifecycle and history use Core REST endpoints. Live canvas edits use the collaboration WebSocket and require an active-session ticket. These routes are examples; payloads and message types remain open.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/v1/workspaces/{workspace_id}/diagrams` | List workspace diagrams. |
| `POST` | `/api/v1/workspaces/{workspace_id}/diagrams` | Create a diagram. |
| `GET` | `/api/v1/workspaces/{workspace_id}/diagrams/{diagram_id}` | Read the current recoverable working diagram, which may be newer than its latest revision snapshot. |
| `GET` | `/api/v1/workspaces/{workspace_id}/diagrams/{diagram_id}/revisions` | Read diagram revision history. |
| `POST` | `/api/v1/workspaces/{workspace_id}/diagrams/{diagram_id}/collaboration-ticket` | Validate the active session and issue a short-lived WebSocket ticket. |
| WebSocket | `/ws/v1/diagrams/{diagram_id}` | Exchange concurrent canvas edits and collaboration updates. |

### Agreed V1 diagram AI review route

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/workspaces/{workspace_id}/diagrams/{diagram_id}/revisions/{revision_id}/review` | Request non-mutating AI recommendations against the exact diagram snapshot through the authenticated user's active workspace session. |

The server verifies that the source revision belongs to the diagram and workspace in the route. Recommendations retain the reviewed revision and requesting session; requesting review does not apply changes to the diagram. Exact request/response payloads and review completion delivery remain open.

## Agreed V1 HLD/LLD generation direction

HLD and LLD generation requests are asynchronous. Clients poll a REST status endpoint for progress and completion. Exact request and response payload fields remain open.

All routes below are relative to `/api/v1/workspaces/{workspace_id}`. `document_kind` is `hld` or `lld`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/documents/{document_kind}/generations` | Start generation; return `202 Accepted` with a generation ID and status. |
| `GET` | `/generations/{generation_id}` | Return status and, when successful, the generated revision ID. |

- HLD generation uses an explicitly selected saved requirements revision.
- LLD generation uses an explicitly selected saved HLD revision; an HLD revision must exist first.
- Both generation operations require an explicit request. Saving an HLD does not automatically start LLD generation, and neither operation requires approval.
- Generated content creates a new revision of the corresponding design document.
- Generation status is retrieved by polling a REST endpoint; a generation has queued, running, succeeded, or failed status.
- The request pins selected requirements for HLD, selected HLD for LLD, and selected diagram snapshots as applicable. Generation uses those exact saved versions even if workspace content changes while the request is running. No artifact has an approval state.
- Generated revisions retain source links and model/prompt/knowledge provenance. Changes to those sources mark downstream designs as potentially stale while preserving historical revisions. Exact response fields and whether staleness is computed or stored remain open.
- Source links are immutable and created atomically with the new revision. HLD revisions pin requirements/diagram revisions; LLD revisions pin a selected HLD and use its immutable source links to identify the requirements/diagram inputs transitively. Validate workspace scope and this dependency direction; source links never silently switch to newer revisions.

## Agreed V1 HLD/LLD retrieval routes

All routes below are relative to `/api/v1/workspaces/{workspace_id}/documents/{document_kind}`, where `document_kind` is `hld` or `lld`. The base path has no additional suffix.

| Method | Path suffix | Purpose |
|---|---|---|
| `GET` | (base path) | Read the latest saved revision and pinned source references. |
| `GET` | `/revisions` | List revision history. |
| `GET` | `/revisions/{revision_id}` | Read a specific revision. |

All requests require an active session for the workspace, and the revision must belong to the document and workspace in the route.

## Agreed V1 HLD/LLD editing route

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/workspaces/{workspace_id}/documents/{document_kind}/revisions` | Save edits as a new revision; `document_kind` is `hld` or `lld`. |

Each saved revision contains the complete HLD/LLD Markdown in its `content` field. Earlier revisions remain intact; no approval step follows saving. A manually edited revision must not claim direct AI-generation provenance. By default, copy the base revision's source links into the new revision; changing sources requires an explicit validated choice and a new revision, never mutation of existing links. Inherited links describe the pinned basis, not automatic verification of the new text. The [revision schema](database-model.md#agreed-hldlld-revisions-and-markdown-content) and [source-link rules](database-model.md#generated-design-source-links) record the agreed storage behavior; exact source-change request fields, first-manual-revision handling, and associated validation details remain payload-planning work.

## Agreed V1 AI recommendation routes

All routes below are relative to `/api/v1/workspaces/{workspace_id}`.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/recommendations` | List recommendations, filterable by status or source revision. |
| `GET` | `/recommendations/{recommendation_id}` | Read the suggestion, rationale, and source revision. |
| `POST` | `/recommendations/{recommendation_id}/decision` | Submit `accept` or `reject` through the authenticated user's active workspace session. |

Any active participant can explicitly accept/apply or reject a recommendation in their workspace. Acceptance creates a new revision; rejection records the decision without changing the content. Neither action is a formal document approval. The deciding session is resolved by the server; it can differ from the session that requested the recommendation.

The stored decision retains the deciding session, decision time, and resulting revision reference on acceptance. The requesting session is retained separately. All referenced records must belong to the same workspace. Requesting feedback or accepting a suggestion does not transfer artifact ownership to the session.

## Agreed V1 comment routes

All routes below are relative to `/api/v1/workspaces/{workspace_id}`.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/comments` | List comments, filtered by the relevant content. |
| `POST` | `/comments` | Add a comment or reply. |

Each comment identifies exactly one requirements, diagram, or HLD/LLD revision through the explicit target FKs in the [comment schema](database-model.md#agreed-comments-and-one-level-replies), with an optional diagram-element or document-section anchor. The server resolves and stores `author_session_id` from the authenticated user's active workspace session; the client cannot choose the author. Validate the workspace against the author session and target.

V1 replies are one level deep: `parent_comment_id` references a root comment, and the server inherits that root's exact revision and anchor. Reject replies to replies and cross-workspace or conflicting-target requests. Comments are append-only, remain visible on their original revision after later edits, and retain attribution when the author leaves. No comment editing/deletion routes are introduced. Exact create/list/reply response fields, anchor schemas, thread pagination, and body limits remain payload-planning work.

## Agreed V1 HLD/LLD export routes

All routes below are relative to `/api/v1/workspaces/{workspace_id}`. `document_kind` is `hld` or `lld`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/documents/{document_kind}/revisions/{revision_id}/exports` | Request a PDF or Markdown export of that exact revision. |
| `GET` | `/exports/{export_id}` | Poll export progress and retrieve the download link when ready. |

Exports are asynchronous and follow the generation polling pattern. Each exported document identifies its exact revision and pinned source references, without a draft/approved label. Requests require the authenticated user's active workspace session.

The HLD export includes the diagram snapshot associated with that revision, rather than substituting the latest live canvas. Exact export metadata and download-link lifetime remain open.

## Agreed V1 requirements and document edit conflicts

- Each requirements or HLD/LLD save includes the `base_revision_id` the user edited.
- The server creates a new revision only if that base is still the latest revision of the target document.
- If another save has created a newer revision, return `409 Conflict` with the latest revision ID. The user reviews and resubmits their changes.
- The base check and creation must be atomic so concurrent saves cannot both succeed against the same base.
- Live diagram collaboration continues through the WebSocket; this REST save rule covers requirements and HLD/LLD edits.
- Empty requirements/HLD/LLD parents have no revisions. For the first save, accept `base_revision_id = null` only if the locked parent still has no revision; then create revision 1. Empty-current-read responses and exact payload validation remain API contract work.

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
GET /api/v1/workspaces/{workspace_id}/comments?limit=20&cursor=...
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

Generation, export, and recommendation-decision requests use an `Idempotency-Key` header. Clients reuse the same key when retrying the same operation after a timeout.

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

- Accepted canvas changes are persisted in `diagram_update` as Yjs-compatible binary updates in PostgreSQL, separately from reviewable revision snapshots. A per-diagram transaction locks `diagram_working_state`, assigns a sequence, inserts the update, and advances the last-update marker. A saved acknowledgement follows commit; presence/cursors remain transient.
- `diagram_working_state` holds one consolidated CRDT base and sequence markers per diagram. Recovery reads a consistent base-plus-subsequent-updates view, rather than assuming the latest historical revision is live state. Consolidation atomically replaces the base, advances its covered marker, and removes covered updates while preserving later updates.
- Complete immutable JSONB diagram revisions are created periodically when content changed and before AI review. Each stores `source_update_seq` for one consistent durable state; edits after that boundary remain live changes and do not alter the reviewed revision. The marker is not a foreign key to compactable update rows. Its public response representation remains to be discussed.
- AI feedback references the exact snapshot reviewed.
- History viewing loads a selected revision's JSON directly in a read-only canvas without applying it to the working diagram. Rollback is not part of this V1 viewing flow.
- Compaction of working updates must preserve recoverability and historical JSON snapshots, including those referenced by recommendations, comments, or design inputs. It does not authorize pruning history.

The hybrid mechanism and the working-state/update schemas are agreed in the [database model](database-model.md#agreed-working-state-and-update-columns). Batching/retry and wire acknowledgement details, cross-process checkpoint/access coordination, checkpoint intervals, consolidation thresholds, retention/deletion, format compatibility, and exact response fields remain open for service planning. Reading a specific historical diagram revision is required by this flow, but its exact endpoint/payload still needs agreement. [Yjs document updates](https://docs.yjs.dev/api/document-updates).

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
- Explicitly leaving sets `is_active` to false and ends collaboration access. Returning through the current shared joining link reactivates the same session, subject to access-removal checks. Exact join routes remain open.
- Owner removal sets the other participant's session inactive and records `revoked_at`; it must terminate their collaboration access. Reconnection, new tickets, and subsequent edits must reject revoked sessions. Joining/removal must coordinate transactionally; exact cross-process invalidation and in-flight behavior remain service-contract work.

Exact payloads, protocol encoding, and operational timing remain open for detailed service planning. This discussion draft is not an exhaustive API specification.

## HLD, API, and persistence alignment

| Concern | HLD boundary | API contract | Persistence |
|---|---|---|---|
| Workspace access | Django Core resolves active per-user workspace sessions | Numeric workspace paths; shared-reference join/link-management routes still open | One session per user/workspace; one reusable joining `ref_id` on the workspace; no invitation table |
| Editing and suggestion actions | Any active workspace participant; server resolves the acting session | Revision saves and explicit recommendation decisions; no approval endpoints | Immutable content revisions; separate requesting and deciding session references on recommendations |
| Shared content | One architecture effort per workspace | Requirements, multiple diagrams, one HLD and one LLD | Parent artifacts own revisions; session inactivity does not remove history |
| Generation | Core to durable queue to FastAPI orchestration to model gateway/connector | Async generation and polling routes above | Durable operation records plus source links and generation provenance; operation schema deferred |
| Diagram collaboration | Separate Django Channels/Yjs-compatible process | Active-session ticket and WebSocket; durably acknowledged edits; consistent review snapshots | Binary updates plus consolidated working CRDT state; separate complete immutable JSONB history; presence is transient |
| Recommendations | Worker produces proposals; Core handles explicit decisions | Source-specific review, retrieval, and decision routes | Separate requesting and deciding session references and accepted-result revision |
| Export | Async export workload and object storage | Exact-revision PDF/Markdown export and polling | Durable operation/result metadata; exact revision/source labels |

## Required contracts still open in all design documents

These are remaining V1 design work, not implementation-ready contracts or features removed from V1:

- **Permanent access removal:** storage and behavior are agreed: an active owner can remove another participant by setting their session inactive with a server-recorded `revoked_at`; the owner cannot be revoked. Shared-link rejoining never clears the marker. Exclude revoked workspaces from the removed participant's normal list. Define exact removal routes/payloads, ownership handling, and cross-process/in-flight invalidation. No participant-facing restoration flow is selected for the initial core implementation.
- **Shared-link lifecycle:** define authenticated join and owner-authorized link retrieval/replacement routes and payloads. The same current link can reactivate non-revoked existing sessions without changing permissions. The delegated core decision lets an enabled, inactive, non-revoked owner reactivate their own session without the link; define its exact route/payload. The earlier account-bound invitation routes are superseded.
- **Diagram persistence:** implement the agreed working-state/update schemas and transaction boundaries only after settling batching/retry and wire acknowledgements, consistent checkpoint/access coordination, consolidation thresholds, retention/deletion, format compatibility, and the exact single-revision history read contract.
- **AI review completion:** requirements and diagram review run through the queued AI-worker boundary. Their public accepted response, status endpoint, and polling/completion contract are not yet agreed. Generation polling above does not implicitly define review polling.
- **Model integration:** define owner-managed workspace connection configuration, customer connector onboarding/authentication, compatibility validation, and health/status visibility. Browser requests go through Core; the browser does not call the customer model. Exact management routes and connector/gateway protocol are pending.
- **Supporting records:** define durable operation, retry/idempotency, export metadata, and internal worker result contracts. All share workspace scope and retain requesting-session context. Departure of the requester during in-flight work needs an explicit policy.
- **Ownership administration:** ownership-management contracts remain open. `is_owner` remains for workspace administration; formal approver designation and approval administration have been removed.
- **Comments:** session-author, explicit revision-FK, append-only, and one-level reply behavior is agreed. Delegated core choices select a nonblank body up to 8,000 characters and optional object anchors for nodes/edges/document sections. Finalize exact anchor validation, root/reply list pagination and payloads, retention/deletion, and coordination with concurrent leave/removal before implementation.
- **Data deletion and retention:** reviewed core FK relationships use [protected history with owned diagram-state/update cascading](database-model.md#agreed-foreign-key-deletion-rules). Leaving or disabling an account does not delete its records; permanent access removal is separate from stored-data deletion. Define deliberate workspace/account deletion/anonymization, ownership handling, retention, and supporting-service cleanup before adding deletion APIs. No new DELETE route is implied by the FK decision.
- **Traceability details:** source inheritance for manual edits is agreed: copy pinned links by default; explicit source changes create a new revision and source set. Compute potentially stale indicators from pinned links on read for V1. Finalize source-change/first-manual-source request validation, provenance payloads, and stale-design response fields. Cost guidance must expose rationale, assumptions, and dated price sources when numeric; whether it needs a separate operation is open.
- **Authentication and payload details:** email/password, canonical email identity, and the custom account schema are agreed; social login is deferred. Atomic parent initialization and first-save null-base behavior are selected in the delegated core design. Define account endpoints and login transport, registration/recovery, email verification/change, disablement propagation and retention, finalized workspace-create/empty-current responses, requirements history reads, pagination ordering/limits (user workspace listing uses session-ID ordering), idempotency scoping/retention, and exact WebSocket encoding.

Training, curated knowledge indexing, and adapter release management remain internal service contracts, with no new public browser routes implied by this API draft.
