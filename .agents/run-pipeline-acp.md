# Orion Pipeline — ACP Orchestration Notes

## How to run
From Andromeda's main session, spawn a single orchestrator sub-agent:

```
sessions_spawn:
  runtime: "acp"
  agentId: "claude"
  mode: "run"
  cwd: "~/Dev/Projects/orion"
  task: <orchestrator prompt from orchestrator.txt>
```

The orchestrator handles sequencing internally using Claude Code's native agent tool.

## Why ACP over raw exec
- sessions_spawn returns immediately (non-blocking)
- Completion auto-announced to parent session
- Proper lifecycle management via subagents list/steer/kill
- No shell escaping issues
- OpenClaw handles all routing
