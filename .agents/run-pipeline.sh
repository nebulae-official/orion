#!/bin/bash
# Orion Autonomous Engineering Pipeline — Full Run
# Chains: Analyst → Architect+Pragmatist (parallel) → Judge → Planner
# Usage: ./run-pipeline.sh [--notify]

set -euo pipefail

ORION_DIR="$HOME/Dev/Projects/orion"
AGENTS_DIR="$ORION_DIR/.agents"
OUTPUT_DIR="/tmp/orion-agents"
NOTIFY="${1:-}"
TODAY=$(date +%Y-%m-%d)

mkdir -p "$OUTPUT_DIR"

log() { echo "[$(date +%H:%M:%S)] $1"; }

log "🔭 Phase 1/4 — Analyst starting..."
cd "$ORION_DIR" && claude --permission-mode bypassPermissions --print "$(cat "$AGENTS_DIR/analyst.txt")" > "$OUTPUT_DIR/analyst-$TODAY.txt" 2>&1
log "✅ Analyst done ($(wc -l < "$OUTPUT_DIR/analyst-$TODAY.txt") lines)"

log "🏛️⚡ Phase 2/4 — Architect + Pragmatist (parallel)..."
cd "$ORION_DIR" && claude --permission-mode bypassPermissions --print "$(cat "$AGENTS_DIR/architect.txt")" > "$OUTPUT_DIR/architect-$TODAY.txt" 2>&1 &
ARCH_PID=$!
cd "$ORION_DIR" && claude --permission-mode bypassPermissions --print "$(cat "$AGENTS_DIR/pragmatist.txt")" > "$OUTPUT_DIR/pragmatist-$TODAY.txt" 2>&1 &
PRAG_PID=$!
wait $ARCH_PID $PRAG_PID
log "✅ Architect done ($(wc -l < "$OUTPUT_DIR/architect-$TODAY.txt") lines)"
log "✅ Pragmatist done ($(wc -l < "$OUTPUT_DIR/pragmatist-$TODAY.txt") lines)"

log "⚖️ Phase 3/4 — Judge starting..."
cd "$ORION_DIR" && claude --permission-mode bypassPermissions --print "$(cat "$AGENTS_DIR/judge.txt")" > "$OUTPUT_DIR/judge-$TODAY.txt" 2>&1
log "✅ Judge done ($(wc -l < "$OUTPUT_DIR/judge-$TODAY.txt") lines)"

log "📋 Phase 4/4 — Sprint Planner..."
cd "$ORION_DIR" && claude --permission-mode bypassPermissions --print "$(cat "$AGENTS_DIR/planner.txt")" > "$OUTPUT_DIR/planner-$TODAY.txt" 2>&1
log "✅ Planner done"

log "🎉 Full pipeline complete!"
log "Outputs: $OUTPUT_DIR/*-$TODAY.txt"

# Print the sprint plan
echo ""
echo "========== SPRINT PLAN =========="
cat "$OUTPUT_DIR/planner-$TODAY.txt"
echo "================================="

# Notify via OpenClaw if requested
if [ "$NOTIFY" = "--notify" ]; then
  openclaw system event --text "🏗️ Orion nightly pipeline complete. $(grep -c 'CRITICAL\|critical' "$OUTPUT_DIR/analyst-$TODAY.txt" 2>/dev/null || echo 0) critical findings. Sprint plan ready." --mode now
fi
