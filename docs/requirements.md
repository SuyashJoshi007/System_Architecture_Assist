# System Architecture Assistant — Requirements Draft

**Status:** Approved baseline — approved by the user on 2026-11-21\
**Scope of this document:** Product requirements only. This is not an HLD or a technical architecture.\
**Status labels:** `Confirmed` means stated by the user; `Proposed` means recommended for review; `Open` means a decision or clarification is still needed.

## Later discussion clarifications

The approved baseline below is read together with these later decisions, reconciled on 2026-11-24:

- A workspace is one architecture effort; V1 has no separate Project entity. Workspace participation uses one session per user/workspace, toggled by `is_active`. Temporary disconnects affect presence; explicit leave deactivates the session.
- V1 accounts use email/password with a unique trimmed lowercase email login identifier and no separate username. Account enablement is separate from workspace-session activity. Social login is deferred; detailed account/recovery/verification workflows remain to be planned.
- The latest joining decision supersedes account-bound invitations: one reusable, non-expiring UUIDv4 `ref_id` is stored directly on each workspace. An enabled signed-in account possessing its current shared link can create/reactivate its non-revoked workspace session. There is no separate invitation table or extra public UUID. Owner removal records `workspace_session.revoked_at` and sets the session inactive; shared links cannot reactivate it, and the owner cannot be revoked. Exact removal/restoration, invalidation, and owner link-management contracts remain open.
- Requirements revisions store complete, immutable JSONB snapshots. Diagram persistence is hybrid: durable Yjs-compatible binary updates with working-state consolidation, plus complete immutable JSONB history snapshots periodically when content changed and before AI review. The working-state/update schemas, per-diagram sequence transactions, and historical source-sequence marker are agreed in the database model. Intervals, remaining coordination contracts, and retention policies remain open.
- Formal product approval is removed: no approval table, designated-approver flag, revision sign-off endpoints, or draft/approved lifecycle. Requirements and designs evolve through immutable saved revisions. This supersedes the earlier approval gates and authority requirements.
- Any saved HLD/LLD revision may be exported with its revision and pinned inputs identified. Active participants can edit, request generation/review, and explicitly apply/reject suggestions; owner-only workspace administration remains separate. Actions are attributed through the active workspace session where applicable.
- Shared artifact revisions remain scoped to the workspace and survive session inactivity. HLD generation pins a selected saved requirements revision; LLD generation explicitly selects an existing HLD revision. Neither requires sign-off. AI suggestions remain non-mutating until a participant explicitly applies them.

See [HLD](hld.md), [API design](service-plans/api-design.md), and [database model](service-plans/database-model.md).

## Product goal

Help teams clarify system requirements before designing a solution, then support them in creating and reviewing architecture together. The assistant should enable teams to use AI models—including self-hosted models—rather than replace those models.

## Product principles

- **Enable AI models; do not compete as a general-purpose code assistant.** The product focuses on the architecture workflow: requirement clarification, traceable design decisions, team collaboration, and architecture-specific review.
- **Keep code analysis out of V1.** General code optimization can be handled by modern LLM tools; it is not a V1 differentiator or core capability.
- **Support self-hosted models from V1.** The product's value includes a harness and architecture-specific layer built on existing models, rather than replacing the model.
- **Own the architecture intelligence layer.** Build domain knowledge and project context above the underlying model so guidance is architecture-specific and relevant to the current work.

## Functional requirements

| ID | Requirement | Status |
|---|---|---|
| FR-01 | A user can describe a product or system in a prompt and provide requirements, preferred or required technologies, expected scale, and budget. Scale and budget may be marked unknown. The assistant asks for scale indicators relevant to the system and clarifies whether a budget is monthly or one-time. | Approved |
| FR-02 | The assistant reviews the submitted requirements and gives feedback on ambiguity, conflict, missing information, and feasibility. | Approved |
| FR-03 | The assistant asks focused questions and suggests requirement changes or additions based on relevant context such as scale, budget, data, and compliance. It distinguishes unapplied suggestions from saved requirements and explains the impact of assumptions where information is unknown. | Approved |
| FR-04 | The user can review, edit, apply, or reject suggestions. The assistant must not treat unapplied suggestions as saved requirements or modify existing requirements/designs without an explicit Apply action. This is an edit action, not a formal approval workflow. | Revised by latest decision |
| FR-05 | The system presents a versioned requirements brief for ongoing review and editing. An active participant can explicitly request HLD generation using a selected saved requirements revision without a sign-off gate. | Revised by latest decision |
| FR-06 | A user can express an idea in text or create and edit an architectural design in the app. | Approved for V1 |
| FR-07 | The assistant can review an in-app architectural design against selected saved requirements and explain potential gaps or improvements. It suggests changes and leaves edits under the user's control; applying a suggestion requires an explicit edit action. | Revised for V1 |
| FR-08 | The assistant evaluates architecture options against requirements, scale, compliance needs, budget, operational burden, and service guarantees. It recommends open-source options when they are a suitable fit and paid options when their support, SLA, or other benefits better meet the requirements. It explains tradeoffs and assumptions and does not favor open source by default. | Approved |
| FR-09 | A product-owned architecture knowledge layer is developed and trained on system design and architecture principles. In V1, it uses RAG over a vector store, task-specific prompt orchestration, and fine-tuning on product-curated architecture examples. The assistant combines this layer with the selected saved requirements and in-app design versions. Customer project data is excluded from training unless explicitly consented to. | Approved for V1 |
| FR-10 | Team members can edit an architectural design concurrently and see collaborator activity. | Approved for V1 |
| FR-11 | On explicit request, the product generates an HLD revision from selected saved requirements and diagram snapshots. LLD generation uses an explicitly selected existing HLD revision and its pinned inputs. Both are included in V1, without formal approval prerequisites. | Revised for V1 |
| FR-12 | The LLD describes component responsibilities, API and event contracts, data models, key workflows, justified queue or caching choices, failure handling, security, operational constraints, and decision rationale linked to requirements. It is a design document, not generated implementation code. | Approved |
| FR-13 | AI feedback and suggested changes are non-mutating by default. An active participant must explicitly apply a suggestion before it changes requirements, diagrams, or design documents. Historical revisions remain immutable; no separate approval step follows applying a change. | Revised by latest decision |
| FR-14 | All active workspace participants can edit content, request generation/review, and apply/reject AI suggestions. The owner retains workspace administration. There are no designated approvers or document sign-off records; finer-grained access permissions can be considered in V2. | Replaces earlier approval requirement |
| FR-15 | The HLD includes system boundaries, major components and interactions, key data flows, a high-level diagram, technology choices with rationale and tradeoffs, and how the design addresses the selected scale, budget, security, and compliance constraints. | Approved |
| FR-16 | HLD and LLD are editable, versioned project documents linked to the requirements and diagram versions they came from. Changes and pinned inputs can be reviewed against each immutable document revision. | Revised for V1 |
| FR-17 | Users can export any saved HLD and LLD revision in PDF and Markdown formats, labeled with its revision number and pinned inputs. The HLD export includes its associated architecture diagram. No approval status is required or displayed. | Revised for V1 |
| FR-18 | In V1, the owner can share the workspace's reusable joining link. Enabled signed-in accounts possessing the current link can join or reactivate their non-revoked workspace session. Workspace content requires an enabled account and an active, non-revoked session. The active owner can remove another participant by setting their session inactive and recording `revoked_at`, preserving history and ending collaboration access. Block owner revocation; shared-link joining cannot clear revocation. Exact management routes, invalidation, restoration, and ownership transfer remain open. V2 can add finer-grained permissions. | Agreed V1 behavior; remaining contracts open |
| FR-19 | Each AI recommendation identifies the requirement or design element it is based on and explains its rationale, expected benefit, tradeoffs, and assumptions in plain language, including teaching relevant concepts such as queues and caching. | Approved |

## Non-functional requirements

| ID | Requirement | Status |
|---|---|---|
| NFR-01 | Concurrent collaborators can work on the same design without silently losing one another’s changes. Compatible edits are combined; incompatible edits to the same item are surfaced for the team to resolve. Changes are preserved and reviewable. | Approved for V1 |
| NFR-02 | The AI capability uses an adapter and orchestration layer to harness existing models. V1 supports one customer-hosted, self-hosted base model family with the product's compatible fine-tuned adapter. The architecture-specific knowledge layer and workflow can be improved independently of the underlying model. Additional models may require their own adapters; the product does not promise automatic compatibility with every model. | Approved for V1 |
| NFR-03 | Capture relevant data sensitivity, jurisdiction, retention, and compliance constraints. The assistant may suggest relevant compliance considerations based on project context, but the user decides which apply. Protect project context within its workspace and show which provider receives it when AI uses it. Do not use customer project data to train underlying models or share it across workspaces without explicit consent. Flag compliance needs that cannot be confirmed as unresolved; do not claim compliance without evidence. | Approved baseline; specific standards are user-selected per project |
| NFR-04 | The product handles growth in teams, workspace architecture efforts, collaborators, and AI requests without losing project data or collaboration integrity. Numeric capacity targets are set before production launch. | Approved baseline; target values are open |
| NFR-05 | Monitoring covers application health, collaboration, AI requests, and background work. Alerts identify actionable failures or service degradation. Logs and alerts do not expose sensitive project data. | Approved baseline |
| NFR-06 | If an AI provider is slow or unavailable, users receive clear feedback and their work remains saved. | Approved baseline |
| NFR-07 | Initial development and evaluation prioritize existing hardware and open-source tools. Avoid recurring GPU hosting or model-service costs; consider one-time GPU compute only after evaluation shows it is needed for adapter training or validation. | Approved |

## Approved delivery scope

### V1

- Requirement intake, clarification, suggestions, and continuously evolving saved requirements revisions.
- Product-maintained architecture knowledge applied to selected saved requirements and in-app diagram snapshots.
- An adapter/orchestration harness with at least one self-hosted model supported at launch.
- Explicitly requested HLD generation from selected requirements and LLD generation from a selected existing HLD, with no sign-off prerequisites.
- In-app diagram authoring, AI review, and concurrent team collaboration with visible conflict resolution.
- Context-aware architecture cost guidance that weighs fit, SLAs, compliance, operational burden, and budget without defaulting to open source or paid services.
- Editable, versioned HLD/LLD documents; PDF and Markdown export.
- Shared workspace joining links, active-session edit access, explicit suggestion application, owner administration, baseline data controls, monitoring, alerting, and provider-failure handling.

### V2 and later

- Social login beyond the V1 email/password account flow.
- Import existing diagrams for review. Formats and sources are not yet selected.
- Use team-provided standards and documents as context, after defining PII detection, handling, and privacy requirements.
- Finer-grained access permissions.
- Additional model adapters beyond the initial self-hosted model integration.

### Out of core scope

- General-purpose code analysis or code optimization. The product focuses on architecture workflows and guidance.

## Open questions

1. Which diagram formats or sources should V2 import support?
2. Which PII detection, handling, and privacy requirements must be defined before team-provided documents can be used as V2 context?
3. What initial capacity and service targets (teams, collaborators, availability, and response times) must be met before production launch?

## Requirements brief and evolving inputs

The user should be able to review a concise brief containing:

- Saved functional and non-functional requirements
- Applied and rejected suggestions
- Open questions and unresolved conflicts
- Assumptions, with owners or confirmation status
- Unknown scale, budget, and other constraints, with their impact on the proposed design
- Priorities and measurable acceptance criteria where known

An active participant can select a saved brief revision and request HLD generation while continuing to evolve the requirements. Open questions and assumptions remain visible; they do not create an approval state. Generation pins the selected inputs so later edits do not silently change its context.
