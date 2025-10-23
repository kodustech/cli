# Kodus CLI Bug Guide

## Purpose

This document defines what we consider a bug in Kodus CLI to facilitate triage, communication, and prioritization of fixes.

## Observed Scope

- `kodus review` command and its libraries (`src/commands/review.ts`, `src/lib/*`).
- Currently implemented functionalities: diff collection, discovery of context files, prompt building, clipboard copying, and payload writing via `--output`.

## What We Classify As a Bug

- Any error that prevents the normal execution of `kodus review` in a valid Git repository (e.g., crash, unhandled exception, incorrect exit code).
- Generation of an incorrect, incomplete, or inconsistent payload compared to the actual Git diff.
- Failure to respect documented options/flags.
- Imprecise messages that mislead the user when handling expected errors.
- Functional or experience regressions relative to documented behavior.

### Execution and Stability Failures

- Command ends with a visible throw/stack trace to the user.
- Process exits with code 0 even on fatal error, or with a non-zero code in normal flow.
- Deadlocks or loops that prevent the task from completing in a reasonable timeframe.

### Diff and File Collection

- `resolveGitRoot`, `getDiff`, or `getChangedFiles` return incorrect values for valid repositories.
- `collectContextFiles` skips files that should be followed within `--follow-depth` limits or adds files outside the expected repo/context.
- File duplication in the payload, or inconsistent stats (`stats.changedFiles` differs from the real set).

### Prompt Building

- `buildPrompt` constructs a prompt without including all expected blocks (diff, instructions, file lists).
- Metadata values (`branch`, `baseRef`, `headSha`) differ from those returned by Git functions.
- Final text with unsubstituted placeholders, broken markdown, or jumbled sections.

### Respect for User Options

- `--base`, `--provider`, `--max-files`, `--follow-depth`, `--output`, and `--no-open` do not affect the command as described in the README.
- Provider normalization accepts values outside the allowed range or rejects valid values.
- `--max-files` or `--follow-depth` accept invalid arguments without clear error messages.

### Input/Output and Local Integrations

- Payload is not saved when `--output` is provided, or the output file is truncated/incorrect.
- `copyToClipboard` indicates success without actually copying, or fails silently on supported platforms (Darwin, Windows, Linux with wl-copy/xclip).
- Relative paths provided in options are resolved to incorrect locations.

### User Experience and Messages

- Warning/error messages are missing or misleading, especially when no changes are detected or when the base Git reference does not exist.
- Incorrect corrective action instructions or lack of context for the user to resolve the problem.

## What Is Normally Not a Bug

- Features not yet implemented in the roadmap (e.g., direct integration with provider APIs).
- Intentional limits described in documentation (e.g., truncating files when reaching `--max-files`).
- Errors due to configuration external to the CLI: missing Git, repository with no commits, write permission denied at the chosen path.
- Diff inconsistencies when the data returned by Git is incorrect due to external problems (hooks, user configurations).

## How to Report

- Describe exact steps, including commands executed and flag values used.
- Specify operating system and Node.js version.
- Attach the complete terminal log (especially messages prefixed by `[kodus]`).
- Indicate if the problem occurred after updating Kodus CLI or changing project dependencies.

## Example Severity

- Crashes or loss of diff/prompt: high.
- Ignored flags, misleading messages, or inconsistent copies: medium.
- Minor layout or style mismatches that do not disrupt the main workflow: low.
