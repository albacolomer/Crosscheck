---
name: git
description: Create or review branches and commits, and prepare version tags, GitHub Releases, release notes and authorized deployments while preserving unrelated working-tree changes.
---

# Git Conventions

Use Conventional Commits in English, following the style of `feat(app): prepare environment`.

## Branches

Use lowercase kebab-case:

```text
<type>/<short-description>
<type>/<issue-number>-<short-description>
```

Examples:

```text
feat/file-upload
feat/42-semantic-search
fix/permission-filter
docs/data-model
```

## Commits

Use:

```text
<type>(<scope>): <imperative summary>
```

Common types are `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, and `ci`. Use a short scope naming the area touched, for example `docs`, `skills`, `auth`, `files`, `search`, `permissions`, `functions`, or `firestore`.

Add `refs #<issue>` or `closes #<issue>` in the body only when an issue exists. Do not require or invent a ticket.

## Pull Request Videos

When the user asks to upload a video to a PR, attach it to the PR description and keep the recording outside Git.

## Rules

- When the repository defines hooks, confirm `git config core.hooksPath` resolves to `.githooks` and let `.githooks/pre-commit` run normally.
- When the repository mirrors skills across harness directories (`.claude/skills`, `.codex/skills`, `.agents/skills`), keep the subtrees identical and synchronize them before committing.
- Never bypass a repository gate with `--no-verify`.
- Keep each commit cohesive and include any related documentation with the implementation.
- Use an imperative, lowercase summary without a trailing period.
- Preserve unrelated user changes in a dirty worktree.
- Inspect the staged diff before committing and never include credentials, local environment files, generated test artifacts, or build output.
- Do not rewrite shared history or force-push unless the user explicitly requests it.

## Version Tags, GitHub Releases and Deployment

Apply this workflow when the user requests a version or release; an ordinary
commit or PR does not create a release automatically. Every released version
gets a matching immutable Git tag, a GitHub Release and release notes.

- Use Semantic Versioning (`major.minor.patch`) and honor the exact version/tag
  requested by the user. Otherwise follow the repository's established tag style
  and choose the increment from the compatibility impact of the shipped changes.
- Inspect existing remote tags/releases and the PR's actual scope. Merge the
  authorized PRs into the release branch using the normal repository workflow.
  Keep partially resolved issues open and document their remaining limitations.
- Run the relevant checks on the intended release code. Distinguish local check
  results from hosted CI. If hosted CI is blocked by billing or infrastructure,
  report and record that fact; do not claim it passed, weaken checks, or bypass a
  repository gate. Existing user authorization to ship remains valid when no
  required gate blocks the action.
- Preserve unrelated local changes before switching branches or building. Build
  from a clean checkout of the exact release commit, rather than including local
  edits with a dirty-build override.
- Write the release notes in English. For the first release, describe
  the application's shipped capabilities by product area. For later releases,
  summarize changes since the previous published release: features, improvements,
  fixes, breaking changes, required configuration/migrations and known limits.
  Use the actual code/merged PRs as evidence; do not turn planned features into
  shipped claims. Keep notes in the repository when it has a release-notes folder.
- Create an annotated tag at the verified release commit and push only that tag.
  Verify the remote tag resolves to the intended commit. Reuse an existing tag
  only when it already points to that commit; never move or overwrite a version
  tag or silently recreate a published version. Use a new version instead.
- Create a draft GitHub Release from the existing tag with explicit notes
  (`gh release create <version> --verify-tag --draft --notes-file <notes.md>`).
  Generated notes can help gather changes, but review and curate the final text.
- A production deploy needs user authorization; a release request alone is not
  blanket permission to deploy. When deployment is authorized, follow the
  repository's documented scripts and dependency order, deploy the tagged commit,
  and verify the production service's health and deployed revision/version.
  Create the tag before a build that derives its version from Git tags.
- After the requested deployment succeeds, publish the draft release and set it
  as latest when appropriate. If deployment fails, preserve the tag/draft,
  report what actually succeeded, and stop retrying the same failure without a
  concrete change that can resolve it. Do not label an unverified rollout as live.
- Verify the final release/tag URLs and report the version, deployed environment,
  relevant validation and any remaining limitations.
