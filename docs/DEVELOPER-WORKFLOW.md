# Developer Workflow

Wild Maps uses a simple professional Git workflow.

## Branches

```text
main
  Stable public releases only.

develop
  Integration branch for the next release.

feature/*
  One feature per branch.

chore/*
  Repository maintenance, documentation and workflow changes.

release/*
  Final stabilization before a release.
```

## Standard flow

1. Create or select an issue.
2. Create a branch from `develop`.
3. Implement the change.
4. Open a pull request into `develop`.
5. Link the PR to the issue with `Fixes #issue-number`.
6. Review and merge.
7. Delete the feature branch.

## Issue strategy

Use one issue per meaningful unit of work.

Recommended labels:

- `1.2`, `1.3`, `1.4`
- `epic`
- `bug`
- `feature`
- `route-editor`
- `import-export`
- `poi`
- `markers`
- `docs`
- `release`

## Pull request strategy

Every PR should explain:

- what changed;
- why it changed;
- which issue it closes;
- how it was tested.

Use `Fixes #123` when the PR should automatically close an issue after merge.

## Release strategy

For a release:

1. Merge all feature PRs into `develop`.
2. Create `release/x.y.z` from `develop`.
3. Run manual regression tests.
4. Update version, README and CHANGELOG.
5. Merge into `main`.
6. Tag the release.
7. Keep `develop` aligned.

## Wild Maps 1.3 principle

For Route Editor 2.0, avoid adding new behavior directly to scattered globals. New functionality should move toward project-owned route state, route collections and modular managers.
