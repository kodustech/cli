# Kodus CLI Performance Guide

## Purpose
To define when we consider there is a performance problem in Kodus CLI in order to standardize diagnostics, prioritization, and communication with the team.

## Observed Scope
- End-to-end behavior of the `kodus review` command.
- Relevant internal modules: diff reading (`src/lib/git.ts`), context discovery (`src/lib/context.ts`), prompt construction (`src/lib/prompt.ts`), and output/copy flow in `src/commands/review.ts`.
- Expected environment: local Git repository, Node.js >= 18, execution in an interactive shell.

## What We Consider a Performance Problem
- Execution time significantly above acceptable for typical scenarios (medium repositories, small diffs).
- Excessive consumption of CPU, memory, or IO that degrades normal use of the user's computer.
- Operations that scale poorly with diff size or the number of context files followed.
- Measurable regression compared to previous CLI versions without clear functional justification.

### Execution Time
- `kodus review` takes more than a few seconds to collect a small diff (e.g., 1–5 files) on a modern machine.
- Context discovery operations (`collectContextFiles`) get significantly slower in proportion to `--follow-depth` or `--max-files`.
- Writing the payload (`--output`) blocks the command for noticeably longer than the JSON serialization of similar files.

### Resource Consumption
- Process consistently uses >80% CPU in trivial scenarios.
- Memory usage grows continually when following dependencies, eventually causing swap/out-of-memory in medium projects (<100 files).
- Number of open handles/files exceeds OS limits when dealing with common diffs.

### Git Operations
- Duplicate/unnecessary calls to `git diff` or `git show` that increase total time without adding value.
- Redundant re-execution of `git` commands when data is already in memory.
- Not releasing resources or pending promises that keep the process alive after normal completion.

### IO and Serialization Paths
- Parallel context file reads without limit, causing IO bottlenecks.
- Serialization of large files ignoring defined cutoffs (`MAX_FILE_BYTES`), resulting in huge text blocks.
- Copy-to-clipboard invoking commands multiple times unnecessarily.

## What We Do Not Normally Classify as Performance Issues
- Slowness originating from Git commands due to external configurations (hooks, filters, remote repo).
- Execution on extremely limited or overloaded hardware outside the target environment.
- Penalties resulting from high `--max-files` or `--follow-depth` values when explicitly requested by the user.
- Additional processing from newly documented features (e.g., extra validation to prevent bugs).

## How to Monitor and Report
- Record total command time (`time npx kodus review`) and compare with earlier versions where possible.
- Note the size of the diff (number of files/lines) and flag values that expand scope.
- Capture `top`, `htop` or equivalent to show CPU/memory usage during the issue.
- Report OS, Node.js version, Kodus CLI version (commit or tag), and whether running via `npm link`, `npx`, or local binary.

## Suggested Severity
- High: CLI is unusable in common scenarios (takes >15s for small diffs, consumes >1GB RAM).
- Medium: Noticeable degradation but still completes (time doubles compared to the previous version).
- Low: Minor annoyances or issues only noticeable in extreme cases, but worth monitoring.
