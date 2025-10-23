# Kodus CLI Security Guide

## Purpose
Document the criteria we use to classify security issues in the Kodus CLI, so that reports, triage, and fixes stay consistent across the team.

## Observed Scope
- Entire `kodus review` execution flow.
- Git integration helpers (`src/lib/git.ts`), context collector (`src/lib/context.ts`), prompt builder (`src/lib/prompt.ts`), and command runner (`src/commands/review.ts`).
- Local usage on developer machines with access to private repositories and clipboard.

## What We Treat as Security Issues
- Any behavior that exposes private repository data (diffs, context files, metadata) to unintended parties or storage locations.
- Untrusted input triggering execution of shell commands, arbitrary file access, or privilege escalation.
- Misleading security claims in CLI output that cause users to share sensitive data unintentionally.
- Regressions that weaken existing safeguards without explicit product decision.

### Data Exposure
- Payload written via `--output` leaks outside the user-controlled path (e.g., writes to world-readable temp dirs without consent).
- Clipboard copy sends prompt content to unexpected processes or leaves residual files in `/tmp` without cleanup.
- Internal errors dumping raw secrets, tokens, or environment variables to stdout/stderr.

### Command and File Safety
- Arguments from git history or filenames enabling shell command injection in our `execa` calls.
- Ability to escape repository boundaries when reading context files, leading to traversal outside `root`.
- Following imports or symlinks that let attackers read sensitive files (SSH keys, env files) outside the project.

### Integrity of Prompt and Payload
- Tampering that alters diff/context content before it reaches the prompt (e.g., loading malicious code into memory).
- Failure to respect `--max-files` or truncation guard (`MAX_FILE_BYTES`), causing unexpectedly large prompts that expose private content.
- Accepting unvalidated provider names or flags that change output format in a way that bypasses review safeguards.

### Dependency or Environment Risks
- Malicious use of native binaries we spawn (`git`, clipboard utilities) without verifying they are within the user PATH expectations.
- Bundled dependencies with known CVEs that allow remote code execution or data leaks inside our process.
- Storing temporary data with insecure permissions.

## What Is Usually Not a Security Issue
- Users intentionally sharing the generated prompt with an LLM provider; the CLI is designed for that output.
- Data exposed by external tooling (git hooks, shell history) outside our direct control.
- Crashes that stop execution without revealing additional data or enabling code execution.
- Missing features (e.g., lack of encryption at rest for output files) unless we claim the opposite in docs.

## Reporting and Verification
- Capture CLI version (commit or tag), Node.js version, OS, and whether it was installed via `npm link`, `npx`, or global package.
- Provide exact command line, repo layout (sanitized), and any env variables needed to reproduce.
- Indicate if reproduction requires untrusted collaborators, specially crafted diffs, or symlinks.
- Whenever possible, include a minimal proof-of-concept diff or file structure that demonstrates the issue safely.

## Severity Guidance
- Critical: Remote/local attackers can execute arbitrary commands, read sensitive files outside the repo, or silently exfiltrate data.
- High: Sensitive data leaks to unintended destinations or users can trick themselves into insecure flows due to misleading messaging.
- Medium: Security guarantees degrade (e.g., truncation bypass) but require unusual setup or user interaction.
- Low: Edge-case behaviors that do not directly leak or execute code but could become vectors when combined with other issues.
