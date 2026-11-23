# Contribution and delivery workflow

## Branches and pull requests

`main` is the reviewed baseline. Develop changes on focused branches such as `feat/frontend-workspace`, `feat/requirements-editor`, or `fix/local-draft-recovery`. Push the branch and open a pull request into `main`; do not push application changes directly to `main`.

The initial `main` commit contains the README and ignore rules only. The first frontend PR introduces the implementation, design documentation, tests, and CI. It remains unmerged until review.

## Required checks

From `web/`:

```sh
npm ci
npx playwright install chromium
npm run check
```

The GitHub Actions job **Test and build** runs unit/component tests with coverage, TypeScript checking, the production build, and Playwright tests against that build. PR jobs have read-only repository permission and cannot deploy. Uploaded reports are retained for seven days.

For local browser dependencies on supported Linux distributions, Playwright also offers `npx playwright install --with-deps chromium`. Fedora uses Playwright's fallback Chromium build; CI runs on Ubuntu.

## Review expectations

Review the behavior and diff before merging. Check applicable light/dark and responsive interactions, acknowledge unconnected backend features, and update the affected requirements/API/design documents when changing their contracts. The PR template records verification results and remaining gaps.

GitHub does not let an author approve their own PR. A solo-maintainer setup can require a PR and successful CI, then use an explicit production-environment approval by the maintainer. Teams can additionally require a separate reviewer's PR approval. Repository protection settings, rather than this document alone, enforce the selected policy.

## Deployment after review

GitHub Pages publishes the static frontend after the reviewed PR is merged to `main` and **Test and build** succeeds. The deploy job uses the protected `github-pages` environment. That environment should allow only the `main` branch and require the maintainer's deployment approval. A deployment requires an explicit approval when those settings are enabled; approval does not merge a PR.

The repository is configured for the solo-maintainer option: main requires a PR, successful **Test and build**, and resolved conversations; a second account's approving review is not required. Admin enforcement is enabled, force pushes and deletion are blocked, and the `github-pages` environment requires SuyashJoshi007's deployment approval with a main-only branch policy.

The frontend's relative asset paths support `https://suyashjoshi007.github.io/System_Architecture_Assist/`. This URL becomes live only after the first approved deployment. There is no feature-branch deployment and no deployment on a PR event.

The workflow publishes `web/dist` only. It cannot host the planned backend services, run a customer model, or turn the local-only preview into a shared SaaS. Browser-local draft data remains local to the published site's origin and is separate from localhost data.

## Credentials and generated files

Keep credentials in local environment configuration or GitHub's supported secret stores. Never commit `.env`, GitHub tokens, downloaded browser binaries, `node_modules`, `dist`, test reports, or coverage artifacts. Bundled font notices must remain with the fonts.
