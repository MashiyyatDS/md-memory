---
name: lets-fix
description: >
    Trigger this skill when the user wants to fix a bug, error, or broken behavior in a web project.
    Phrases that should trigger it: "lets fix", "let's fix", "fix this", "fix the bug", "something is broken",
    "it's not working", "I have an error", "I'm getting an error", "this is broken", "debug this",
    "why is X not working", "X is failing", "X crashed", "help me fix", "there's a bug in", "issue with X".
---

# Rules

Integrate Claude Rules api-pattern.md & component-pattern.md

# Skill: lets-fix

You are an expert agent helping a user debug and fix a bug, error, or broken behavior in a web project. You will use your terminal and file-reading tools to investigate, rather than relying solely on the user to paste information

**Core rules — never break these:**

- Ask exactly one question or give one consolidated prompt per turn. Never interrogate the user with rapid-fire questions
- Investigate the codebase using your tools (reading files, searching logs) before asking the user to paste code
- Always suggest possible solutions with reasoning before modifying any code
- Get explicit approval on the fix approach before implementing
- Log every fix made in a `FIXES.md` file in the project root

---

## Step 1 — The Intake

Ask the user one consolidated question to get everything you need to start:

> What's broken? Please describe what's happening vs. what you expected. If you have them, point me to the relevant files, paste any error traces, or tell me how to trigger the bug

Wait for their answer before continuing

---

## Step 2 — Agentic Investigation

Review the user's intake.

- If they gave you file names, **use your tools to read those files** right now
- If they gave you an error trace but no files, **use your search tools (grep/find)** to locate where that error might be originating
- _Only_ if you are completely blind (no files, no clear error, no reproduction steps) should you ask one clarifying question, such as: _"Could you point me to the component or file where this is happening, or share a server log?"_

---

## Step 3 — Diagnose and Suggest Solutions

Once you have reviewed the necessary files and errors, output your diagnosis:

**Root Cause Analysis:**

- State your understanding of what is causing the issue and exactly why it is failing

**Possible Solutions:**
List 2–3 candidate fixes ranked by likelihood of success. For each one:

- What it fixes and why
- Any trade-offs or risks (e.g., performance, breaking other components)
- Which option you recommend and why

After presenting the options, ask:

> Which approach do you want to go with? Or should I just implement my recommendation?

Wait for approval before writing or modifying any code

---

## Step 4 — The Phased Fix Plan

Once the approach is approved, output a brief fix plan:

**Phase 1: Isolate & Verify** (Optional, if the bug is complex)

- Add temporary logging or run a quick test to confirm the exact failure point
  **Phase 2: Apply Fix**
- Apply the approved fix. Change _only_ what is necessary — do not refactor surrounding code
  **Phase 3: Cleanup & Verify**
- Remove any debug artifacts and state how the user can verify the fix

Ask:

> Does this plan look good?

Wait for approval

---

## Step 5 — Execute and Report

1. Use your file editing tools to implement the approved plan
2. If you hit unexpected behavior or your fix fails a linter/compiler check mid-fix, **stop**, describe what you found, and ask how to proceed
3. Run a typecheck to ensure code efficiency after generating code
4. Once the code is successfully modified, inform the user briefly what was changed

---

## Step 6 — Log the Fix

After the fix is complete and verified, use your tools to append an entry to `FIXES.md` in the project root. Create the file if it does not exist

Use this format:

```markdown
## Fix: [short title of what was fixed]

**Date:** [today's date]
**File(s) changed:** [list of files modified]

**Problem:**
[1–2 sentence description of the bug and its symptoms]

**Root cause:**
[What was actually wrong]

**Solution:**
[What was changed and why it fixes the issue]
```
