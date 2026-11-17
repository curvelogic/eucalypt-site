# REVIEW.md — eucalypt-playground

Criteria `rig-review` applies to every PR, read from `main`. This repository
is the website of eucalypt (https://eucalypt.curvelogic.info). Where this file
and the reviewer's definition differ, the stricter rule applies.

## Who merges

**Agents merge** a PR after one fresh, independent `rig-review` review passes
and CI is green on the PR's current head.

**The owner merges** any PR that:

- changes `.github/`, `wrangler.jsonc`, deployment, secrets or environments,
  or anything else that changes how or where the site is served;
- changes `REVIEW.md` itself, `AGENTS.md`, `CLAUDE.md` or `.claude/`;
- carries a "Do not merge — owner review" hold or the `owner-review` label.

A PR in the owner's list still gets a review; the reviewer passes or sends it
back, and leaves the merge to the owner. A hold binds every agent regardless
of later activity, review state or CI. Agents act on GitHub under the owner's
own login, so a comment from that login, including a "hold released" comment,
never releases a hold. Only the owner pressing merge does, or a decision the
owner gives first-hand in a session's chat and the coordinator records. Agents
never remove or release a hold; only a confirm reviewer at the round limit
(see *Review rounds*) posts one.

## Blocking

**CI first.** Read the checks on the current head before anything else. Never
merge on a failing or pending check. Name a failing check first in the
send-back.

**Build and tests pass.** `npm test`, `npm run build` (which includes
`scripts/check-site.mjs`) and `npm run e2e` all pass; CI runs the same
scripts. A change to behaviour carries a test that fails without it.

**No internal material published.** Nothing from eucalypt's `docs/` that
`docs/SUMMARY.md` does not list may reach `dist/`, and no page links into
internal material (such as `docs/superpowers/`). `check-site.mjs` must stay
strict; weakening it is a send-back.

**The docs import stays pinned.** The docs, engine, grammar and highlighting
come from the single commit in `eucalypt-pin.json`. Nothing is vendored by
hand, and nothing tracks a moving branch. A pin bump changes that file and
nothing else of substance.

**Screenshots for visual changes.** A PR that changes how a page looks
includes before and after screenshots (`npm run build`, then `node scripts/screenshots.mjs DIR`),
light and dark. The reviewer looks at them.

**PR bodies are short**: what changed, why, how it was verified, what is open.
A PR body carries no `claude.ai` session link.

**Language.** UK English in code, comments and docs.

## Review rounds

This section replaces the reviewer's default round limit. A PR gets two review
rounds: the first review and one re-review. If round 2 still finds blocking
items, its reviewer sends the PR back and posts no hold.
After the author pushes fixes, a fresh `rig-review` runs one **confirm-only**
review on the new head. It checks that each round-2 blocker is fixed and
reviews the diff since round 2's head, and nothing else. CI on the new head is
read first.

- **Pass:** every round-2 blocker is fixed, nothing new is blocking and CI is
  green. An agent may merge, unless the PR is in the owner's list.
- **Escalate:** a blocker is still open, or the confirm review finds a new
  blocking item. The confirm reviewer posts one comment listing each open
  blocker, with the hold "Do not merge — owner review", and leaves the PR open.
  No further round runs.

## Merging

Method: merge commit, to `main` only. Confirm the PR's base is `main` first.
After merging, fetch and confirm `origin/main` contains the reviewed head. A
merge to `main` deploys the site, so never merge on a pending check.
