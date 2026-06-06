# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

Repository: `domoarigatomrburato/userdata-switcher`.

Pass `--repo domoarigatomrburato/userdata-switcher` explicitly. The local clone
remote may still point at an older repository slug during the product rename.

## Conventions

- **Create an issue**: `gh issue create --repo domoarigatomrburato/userdata-switcher --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --repo domoarigatomrburato/userdata-switcher --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --repo domoarigatomrburato/userdata-switcher --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --repo domoarigatomrburato/userdata-switcher --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --repo domoarigatomrburato/userdata-switcher --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --repo domoarigatomrburato/userdata-switcher --comment "..."`

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --repo domoarigatomrburato/userdata-switcher --comments`.
