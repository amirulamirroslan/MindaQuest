# Next Claude Prompt — MindQuest

Continue development of the existing MindQuest project in this repository.

Before changing code:
1. Read HANDOVER.md and inspect the existing project documentation.
2. Review the current Git branch and working tree.
3. Understand the existing game architecture, assets, and implemented features.
4. Do not rebuild the game from scratch or remove existing functionality.

During development:
- Make focused, incremental improvements.
- Preserve the established visual direction and mobile-friendly gameplay.
- Run relevant tests and the production build after meaningful changes.
- Commit and push working milestones to mindquest-cloud-development.
- Never force-push or overwrite main.
- Keep secrets and credentials out of Git.

Before ending the session, regardless of whether the task is complete:
- Update HANDOVER.md with completed work, actual test/build results, known issues, and pending tasks.
- Update this file with the exact next steps.
- Create a versioned ZIP checkpoint that excludes node_modules, .git, and secrets.
- Commit and push the handover files and completed source changes.
- Do not claim tests, builds, backups, or changes succeeded unless verified.
