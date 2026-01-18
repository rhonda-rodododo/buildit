# Git Workflow for BuildIt Network

Strategies for managing parallel development with Claude Code and git worktrees.

---

## Overview

This document describes workflows for:
1. **Single developer** working on sequential epics
2. **Parallel development** with multiple Claude Code instances
3. **Git worktrees** for isolated workspaces
4. **Best practices** for commit hygiene and branching

---

## Standard Workflow (Sequential Development)

### For Single Epic Execution

```bash
# 1. Check current status
git status
git log --oneline -5

# 2. Start work on epic
# (Claude Code subagent reads NEXT_ROADMAP.md and executes)

# 3. Commit when epic complete
git add .
git commit -m "feat: complete Epic 28 - Critical Bug Fixes"

# 4. Tag release
git tag v0.28.0-bugfixes
git push origin main --tags
```

### Best Practices
- Always work on `main` branch for sequential epics
- Commit after each epic completion
- Tag releases with version number
- Keep commits atomic and focused
- Write descriptive commit messages

---

## Parallel Development with Git Worktrees

### What are Git Worktrees?

Git worktrees allow multiple working directories from a single repository. Perfect for:
- Working on Epic 28 (bug fixes) and Epic 32 (Documents module) **simultaneously**
- Running multiple Claude Code instances on different epics
- Isolating changes without branch switching overhead

### When to Use Worktrees

✅ **Use worktrees when:**
- Working on 2+ epics in parallel
- Running multiple Claude Code instances
- Epics are independent (no shared files being modified)
- Want to test one epic while another is in progress

❌ **Don't use worktrees when:**
- Epics have dependencies on each other
- Working on the same files
- Only working on one epic at a time
- Epics are small/quick (<1 hour)

---

## Setting Up Git Worktrees

### Create a Worktree for Epic 28

```bash
# From main repo
cd /home/rikki/claude-workspace/buildit-network

# Create worktree in parallel directory
git worktree add ../buildit-epic-28 -b epic-28

# Now you have two working directories:
# - /home/rikki/claude-workspace/buildit-network (main)
# - /home/rikki/claude-workspace/buildit-epic-28 (epic-28 branch)
```

### Create Worktree for Epic 32

```bash
# Create another worktree for different epic
git worktree add ../buildit-epic-32 -b epic-32

# Now you have three working directories:
# - /home/rikki/claude-workspace/buildit-network (main)
# - /home/rikki/claude-workspace/buildit-epic-28 (epic-28 branch)
# - /home/rikki/claude-workspace/buildit-epic-32 (epic-32 branch)
```

### Working in Worktrees

```bash
# Terminal 1: Work on Epic 28 (bug fixes)
cd ../buildit-epic-28
# Claude Code: "Complete Epic 28 from NEXT_ROADMAP.md"

# Terminal 2: Work on Epic 32 (Documents module)
cd ../buildit-epic-32
# Claude Code: "Complete Epic 32 from NEXT_ROADMAP.md"

# Both can run tests, build, commit independently!
```

---

## Merging Worktree Changes

### Option 1: Merge to Main (Recommended)

```bash
# When epic complete in worktree
cd ../buildit-epic-28

# Ensure all tests pass
bun run test
bun run typecheck

# Commit changes
git add .
git commit -m "feat: complete Epic 28 - Critical Bug Fixes"

# Switch to main and merge
cd ../buildit-network
git checkout main
git merge epic-28

# Tag release
git tag v0.28.0-bugfixes
git push origin main --tags

# Clean up worktree
git worktree remove ../buildit-epic-28
git branch -d epic-28
```

### Option 2: Rebase onto Main

```bash
# In worktree
cd ../buildit-epic-28

# Rebase onto latest main
git fetch origin
git rebase origin/main

# Resolve conflicts if any
# Then merge as in Option 1
```

---

## Managing Multiple Claude Code Sessions

### Scenario: 3 Epics in Parallel

```bash
# Setup
git worktree add ../buildit-bugs -b epic-28-bugs
git worktree add ../buildit-docs -b epic-32-docs
git worktree add ../buildit-social -b epic-34-social

# Terminal 1 - Bug fixes (fast)
cd ../buildit-bugs
# Claude Code: "Fix BUG-001, BUG-002, BUG-003 from Epic 28"

# Terminal 2 - Documents module (medium)
cd ../buildit-docs
# Claude Code: "Implement Documents module (Epic 32)"

# Terminal 3 - Social features (large)
cd ../buildit-social
# Claude Code: "Implement microblogging and activity feed (Epic 34.1-34.2)"
```

### Coordination

**Merge order** (fastest first):
1. Merge `epic-28-bugs` first (bug fixes, fast)
2. Merge `epic-32-docs` second (feature, medium)
3. Merge `epic-34-social` last (large feature)

**Conflict resolution**:
- If epics touch same files, merge in priority order
- Rebase later epics onto main after each merge
- Use `git diff main..epic-32-docs` to preview conflicts

---

## Worktree Commands Reference

```bash
# List all worktrees
git worktree list

# Add new worktree
git worktree add <path> -b <branch-name>

# Add worktree from existing branch
git worktree add <path> <existing-branch>

# Remove worktree
git worktree remove <path>

# Prune deleted worktrees
git worktree prune

# Move worktree
git worktree move <old-path> <new-path>

# Lock worktree (prevent removal)
git worktree lock <path>

# Unlock worktree
git worktree unlock <path>
```

---

## Worktree Best Practices

### Do's ✅

- **Name worktrees clearly**: `buildit-epic-28`, `buildit-docs`, etc.
- **One epic per worktree**: Keep them isolated
- **Clean up after merge**: Remove worktrees and delete branches
- **Test independently**: Run `bun run test` in each worktree before merging
- **Commit frequently**: Small commits in each worktree
- **Merge incrementally**: Don't let worktrees diverge too far from main

### Don'ts ❌

- **Don't share files**: Avoid working on same files in different worktrees
- **Don't keep stale worktrees**: Clean up after epic completion
- **Don't forget to sync**: Rebase onto main frequently
- **Don't merge untested code**: Always run tests before merging
- **Don't create too many**: 2-3 worktrees max for clarity

---

## Alternative: Git Subtrees (Not Recommended for This Repo)

**Why not subtrees?**
- BuildIt Network is a monorepo with modules already separated
- Modules share dependencies (custom-fields is foundational)
- Subtrees add complexity for merging back
- Worktrees are lighter weight and more flexible

**When subtrees make sense:**
- Splitting repo into multiple independent repos
- Managing dependencies as subdirectories
- Working with external projects

**For this repo**: Stick with **worktrees** for parallel development.

---

## Conflict Resolution Strategies

### When Conflicts Occur

```bash
# In worktree with conflicts after merge/rebase
git status  # See conflicted files

# Open conflicted file
# Resolve conflicts manually (<<<<<<< ======= >>>>>>>)

# Mark as resolved
git add <resolved-file>

# Continue merge/rebase
git rebase --continue
# or
git merge --continue
```

### Prevention

1. **Communicate epic scope**: Use NEXT_ROADMAP.md to see what others are working on
2. **Modular epics**: Design epics to touch different modules
3. **Merge frequently**: Don't let branches diverge for days
4. **Use TodoWrite**: Track progress to avoid duplicate work

---

## CI/CD Considerations

### Running Tests in Worktrees

```bash
# Each worktree is independent
cd ../buildit-epic-28
bun run test                    # Run tests
bun run typecheck           # Check types
bun run build               # Verify build

# Tests run in isolation - no interference
```

### Deployment from Worktrees

```bash
# Only deploy from main branch
cd /home/rikki/claude-workspace/buildit-network
git checkout main

# Verify latest
git log --oneline -5

# Deploy
bun run build
# Deploy to hosting (Vercel, Netlify, etc.)
```

---

## Example Workflow: 2 Parallel Epics

### Setup (5 minutes)

```bash
cd /home/rikki/claude-workspace/buildit-network

# Create two worktrees
git worktree add ../buildit-epic-28 -b epic-28
git worktree add ../buildit-epic-32 -b epic-32

# Verify
git worktree list
# Should show:
# /home/rikki/claude-workspace/buildit-network  (main)
# /home/rikki/claude-workspace/buildit-epic-28  (epic-28)
# /home/rikki/claude-workspace/buildit-epic-32  (epic-32)
```

### Execute (1-3 hours)

```bash
# Terminal 1: Bug fixes
cd ../buildit-epic-28
# Claude Code: "Complete Epic 28"
# (Claude works autonomously, runs tests, commits)

# Terminal 2: Documents module
cd ../buildit-epic-32
# Claude Code: "Implement Documents module (Epic 32)"
# (Claude works autonomously, runs tests, commits)
```

### Merge (10 minutes)

```bash
# Epic 28 finishes first (bug fixes are faster)
cd /home/rikki/claude-workspace/buildit-network
git checkout main
git merge epic-28
git tag v0.28.0-bugfixes
git push origin main --tags

# Epic 32 finishes later
git merge epic-32
git tag v0.32.0-documents
git push origin main --tags
```

### Cleanup (2 minutes)

```bash
# Remove worktrees
git worktree remove ../buildit-epic-28
git worktree remove ../buildit-epic-32

# Delete branches (if merged)
git branch -d epic-28
git branch -d epic-32

# Verify
git worktree list
# Should only show main
```

---

## Troubleshooting

### "fatal: '<path>' is already a working tree"

**Solution**: Remove the old worktree first
```bash
git worktree remove <path>
# or
git worktree prune
```

### "error: cannot lock ref 'refs/heads/<branch>'"

**Solution**: Branch already exists
```bash
# Delete branch or use different name
git branch -D <branch>
# or
git worktree add <path> -b <different-name>
```

### "fatal: '<path>' is a main working tree"

**Solution**: Can't remove main worktree
```bash
# This is expected - you can't remove the original repo
# Only remove worktrees you created with 'git worktree add'
```

---

## Summary

**For sequential work**: Use standard git workflow on `main` branch

**For parallel work**:
1. Create worktrees with `git worktree add`
2. Work on epics independently in each worktree
3. Test thoroughly in each worktree
4. Merge to main in priority order
5. Clean up worktrees and branches

**Key advantages**:
- ✅ No branch switching
- ✅ Isolated workspaces
- ✅ Parallel Claude Code sessions
- ✅ Independent testing
- ✅ Faster iteration

**Remember**: Always test before merging, commit frequently, and clean up when done!

---

**Last Updated**: 2025-10-06
**Related**: [NEXT_ROADMAP.md](../NEXT_ROADMAP.md), [.claude/subagents.yml](../.claude/subagents.yml)
