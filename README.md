# System Architecture Assist

A workspace for teams to clarify requirements, collaborate on system diagrams, and review HLD/LLD drafts with architecture-focused AI assistance.

The current implementation is an interactive, single-user frontend preview. Backend authentication, team collaboration, customer-hosted model integration, and document generation are still design work. Sample recommendations and browser-local drafts are labeled in the UI.

## Frontend development

Requires Node.js 22.12 or later and npm.

```sh
cd web
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. See [frontend instructions](web/README.md) for supported interactions and current limitations.

## Design documents

- [Requirements](docs/requirements.md)
- [High-level design](docs/hld.md)
- [Core database model](docs/service-plans/database-model.md)
- [API design](docs/service-plans/api-design.md)
- [Frontend design and selected references](docs/service-plans/frontend-design.md)

## Review and delivery

Work is proposed on feature branches and reviewed through pull requests into `main`. Production deployment follows review and successful CI. Detailed contribution and deployment instructions accompany the first frontend PR.
