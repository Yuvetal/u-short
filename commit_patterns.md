# Git Commit Conventions & History Analysis

This document outlines the git commit conventions, history, and patterns established during the development of **U-Short** (formerly Kato.Link). It serves as a guideline for future commits to maintain a clean, readable, and structured repository history.

---

## 1. Established Commit Patterns

Based on the analysis of previous development phases and conversation logs, the repository follows two primary commit styles:

### A. Prefix-Based Conventional Commits (Preferred for Incremental Work)
Most feature additions, bug fixes, and minor adjustments use a prefix-based conventional commit message structure:
- **Format:** `prefix: descriptive message in lowercase`
- **Key Prefixes:**
  - `feat:` for new features, route additions, or UI implementations.
  - `fix:` for bug fixes and error-handling improvements.
  - `docs:` for documentation updates (like this file).
  - `style:` for visual styling/CSS tweaks.
- **Examples from History:**
  - `feat: initial full-stack URL shortener with analytics - AI-assisted implementation using Antigravity IDE (Google DeepMind)`
  - `feat: add frontend environment variable example file`
  - `feat: implement bulk URL shortening via CSV upload & download`
  - `feat: add safe JSON parsing to handle HTML backend responses gracefully`
  - `feat: improve URL validation, handle duplicate confirmations, and display bulk CSV errors in UI`
  - `feat: add single-dialog duplicate warnings and skip filter logic for bulk CSV uploads`
  - `feat: add multi-select link checkboxes and bulk delete route/UI functionality`

### B. Milestone / Phase-Based Commits (Used for Major Milestones)
For major integration releases or when completing a defined phase of the implementation roadmap, commits follow a structured title format:
- **Format:** `Implement Phase [Number]: [Key Features Completed]`
- **Example from History:**
  - `Implement Phase 8: Access Password Gate, QR PNG Download, and Analytics CSV Exporter`

---

## 2. Commit Identity Configurations

To maintain consistent authorship and line up with automated workflows, commits are configured with the following author identity:

- **Name:** `Katomaran URL Shortener`
- **Email:** `hackathon@katomaran.com`

---

## 3. Reference Workflow Commands

Below are standard commands used in this environment for managing git commits:

### A. Environment Configuration
Ensure your local path is correctly set up (particularly in PowerShell-restricted environments):
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

### B. User Identity Setup
Ensure your commit author details are correctly set before committing:
```bash
git config user.name "Katomaran URL Shortener"
git config user.email "hackathon@katomaran.com"
```

### C. Staging and Committing Changes
Always review changes before staging:
```bash
git status
git add <modified-files>
git commit -m "feat/docs/fix: <message>"
git push origin main
```
