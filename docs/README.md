# Documentation Structure

## Overview

This directory contains all project documentation beyond the main README.

## Directory Structure

### `/architecture`
System design, data models, and architectural decisions.

**Files:**
- `data-model.md` - Redis schema and storage design

**Future:**
- `api-design.md` - API endpoint specifications
- `adr/` - Architectural Decision Records (when we make significant technical choices)

### `/implementation-plans`
Detailed plans for specific features before implementation.

**Files:**
- `stats-leaderboards.md` - Stats tracking and leaderboard feature plan

**Purpose:**
- Document requirements and design before coding
- Serve as reference during implementation
- Track progress and decisions

### `/guides` (future)
Step-by-step guides for common tasks.

**Potential content:**
- `contributing.md` - How to contribute to the project
- `deployment.md` - Detailed deployment procedures
- `local-development.md` - Setting up local dev environment
- `adding-heroes.md` - How to add new OW2 heroes
- `fossabot-setup.md` - Detailed Fossabot configuration

### `/troubleshooting` (future)
Common issues and their solutions.

## Documentation Principles

1. **Accuracy** - Keep docs in sync with code
2. **Clarity** - Write for humans, not robots
3. **Completeness** - Cover edge cases and "why" not just "what"
4. **Maintenance** - Update docs when code changes
5. **Accessibility** - No jargon without explanation

## When to Document

- **Before implementation** - Complex features get implementation plans
- **After significant changes** - Update architectural docs
- **When asked "why?"** - If you need to explain it twice, write it down
- **For future you** - Document decisions that aren't obvious from code

## Quick Reference

| Document | Purpose | Audience |
|----------|---------|----------|
| `README.md` | Quick start, overview | New users, deployers |
| `/architecture` | System design | Developers, maintainers |
| `/implementation-plans` | Feature specifications | Implementers |
| `/guides` | How-to instructions | Contributors, operators |
| `/troubleshooting` | Problem solving | End users, support |
