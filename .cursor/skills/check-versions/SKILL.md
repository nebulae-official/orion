---
name: check-versions
description: Verify all dependencies use latest stable versions (not beta/RC). Use when adding or updating dependencies.
---

# Check Versions

- Compare requirements.txt, package.json, and Docker base images to docs/TECH_STACK.md.
- Flag any alpha, beta, RC, canary, or preview versions.
- Suggest exact stable versions from TECH_STACK.md where applicable.
