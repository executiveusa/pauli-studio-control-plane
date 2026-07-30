#!/bin/bash
# agent-workflow-builder CLI
# Universal entry point for all agents (Claude Code, Goose, Cursor, Windsurf)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="${SKILL_DIR:-/opt/agent-skills/agent-workflow-builder}"

# Load environment variables if available
if [ -f ~/.brightdata.env ]; then
    source ~/.brightdata.env
fi

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Usage
usage() {
    cat << EOF
agent-workflow-builder — Convert YouTube channels into A2A agent workflows

USAGE:
  agent-workflow-builder [COMMAND] [OPTIONS]

COMMANDS:
  scrape              Scrape YouTube channel and generate workflows
  analyze-gaps        Analyze repository for missing infrastructure
  list-workflows      List all available workflows
  get-workflow        Fetch specific workflow specification
  health-check        Verify installation status
  help                Show this help message

SCRAPE OPTIONS:
  --channel URL       YouTube channel URL (required)
  --max-videos N      Maximum videos to scrape (default: 20)
  --output-dir DIR    Output directory (default: ./agent-workflows)
  --repo-root DIR     Repository root (default: .)
  --auto-commit       Auto-commit results to git
  --verbose           Show detailed output

EXAMPLES:
  # Scrape @michtortiyt channel
  agent-workflow-builder scrape \\
    --channel https://www.youtube.com/@michtortiyt \\
    --max-videos 20 \\
    --output-dir ~/agent-workflows

  # Check repository gaps
  agent-workflow-builder analyze-gaps --repo-root ~/my-repo

  # List all workflows
  agent-workflow-builder list-workflows --dir ./agent-workflows

  # Health check
  agent-workflow-builder health-check

EOF
    exit "${1:-0}"
}

# Main command handler
main() {
    local cmd="${1:-help}"
    
    case "$cmd" in
        scrape)
            shift
            cmd_scrape "$@"
            ;;
        analyze-gaps)
            shift
            cmd_analyze_gaps "$@"
            ;;
        list-workflows|list)
            shift
            cmd_list_workflows "$@"
            ;;
        get-workflow)
            shift
            cmd_get_workflow "$@"
            ;;
        health-check|health)
            cmd_health_check
            ;;
        help|-h|--help)
            usage 0
            ;;
        *)
            echo -e "${RED}✗ Unknown command: $cmd${NC}" >&2
            usage 1
            ;;
    esac
}

cmd_scrape() {
    local channel=""
    local max_videos=20
    local output_dir="./agent-workflows"
    local repo_root="."
    local auto_commit=false
    local verbose=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --channel) channel="$2"; shift 2 ;;
            --max-videos) max_videos="$2"; shift 2 ;;
            --output-dir) output_dir="$2"; shift 2 ;;
            --repo-root) repo_root="$2"; shift 2 ;;
            --auto-commit) auto_commit=true; shift ;;
            --verbose) verbose=true; shift ;;
            *) echo "Unknown option: $1"; exit 1 ;;
        esac
    done
    
    if [ -z "$channel" ]; then
        echo -e "${RED}✗ --channel is required${NC}" >&2
        exit 1
    fi
    
    echo -e "${YELLOW}→ Scraping $channel${NC}"
    
    # Call Python scraper via MCP
    python3 << PYEOF
import sys
sys.path.insert(0, "$SKILL_DIR")
from mcp_server import call_tool

result = call_tool("scrape_channel", {
    "channel": "$channel",
    "max_videos": $max_videos,
    "output_dir": "$output_dir",
    "repo_root": "$repo_root",
    "auto_commit": $auto_commit
})

print(f"Status: {result.get('status')}")
if result.get('status') == 'success':
    print(f"✅ {result.get('message')}")
    metrics = result.get('metrics', {})
    print(f"   Videos processed: {metrics.get('videos_processed')}")
    print(f"   Clusters generated: {metrics.get('clusters_generated')}")
    print(f"   Workflows created: {metrics.get('workflows_output')}")
    print(f"   Output directory: $output_dir")
    print(f"   Time: {metrics.get('execution_time_seconds')}s")
else:
    print(f"❌ {result.get('error')}")
    sys.exit(1)
PYEOF
}

cmd_analyze_gaps() {
    local repo_root="."
    local workflows_dir=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --repo-root) repo_root="$2"; shift 2 ;;
            --workflows-dir) workflows_dir="$2"; shift 2 ;;
            *) echo "Unknown option: $1"; exit 1 ;;
        esac
    done
    
    echo -e "${YELLOW}→ Analyzing $repo_root for infrastructure gaps${NC}"
    
    python3 << PYEOF
import sys
sys.path.insert(0, "$SKILL_DIR")
from mcp_server import call_tool

result = call_tool("analyze_repo_gaps", {
    "repo_root": "$repo_root",
    "workflows_dir": "$workflows_dir" if "$workflows_dir" else None
})

if result.get('status') == 'success':
    gaps = result.get('gaps', [])
    print(f"✅ Analysis complete")
    print(f"   Critical gaps: {result.get('critical_count')}")
    print(f"   Warnings: {result.get('warning_count')}")
    if gaps:
        print(f"\nGaps found:")
        for gap in gaps:
            severity = gap.get('severity', 'info').upper()
            icon = '⚠️ ' if severity == 'WARNING' else '🔴' if severity == 'CRITICAL' else 'ℹ️ '
            print(f"  {icon} {gap.get('title')}: {gap.get('description')}")
    print(f"\nFix with:")
    print(f"  {result.get('remediation', {}).get('command')}")
else:
    print(f"❌ {result.get('error')}")
    sys.exit(1)
PYEOF
}

cmd_list_workflows() {
    local workflows_dir="./agent-workflows"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dir) workflows_dir="$2"; shift 2 ;;
            *) echo "Unknown option: $1"; exit 1 ;;
        esac
    done
    
    python3 << PYEOF
import sys
sys.path.insert(0, "$SKILL_DIR")
from mcp_server import call_tool

result = call_tool("list_workflows", {
    "workflows_dir": "$workflows_dir"
})

if result.get('status') == 'success':
    print(f"✅ Found {result.get('total_count')} workflows")
    for category, workflows in result.get('workflows', {}).items():
        print(f"\n📋 {category.upper()} ({len(workflows)})")
        for wf in workflows:
            wf_id = wf.get('id', 'unknown')
            print(f"   • {wf_id}")
else:
    print(f"❌ {result.get('error')}")
    sys.exit(1)
PYEOF
}

cmd_get_workflow() {
    local workflow_id=""
    local workflows_dir="./agent-workflows"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --id) workflow_id="$2"; shift 2 ;;
            --dir) workflows_dir="$2"; shift 2 ;;
            *) 
                if [ -z "$workflow_id" ]; then
                    workflow_id="$1"
                fi
                shift
                ;;
        esac
    done
    
    if [ -z "$workflow_id" ]; then
        echo -e "${RED}✗ Workflow ID required${NC}" >&2
        exit 1
    fi
    
    python3 << PYEOF
import sys
import json
sys.path.insert(0, "$SKILL_DIR")
from mcp_server import call_tool

result = call_tool("get_workflow", {
    "workflow_id": "$workflow_id",
    "workflows_dir": "$workflows_dir"
})

if result.get('status') == 'success':
    workflow = result.get('workflow', {})
    print(f"✅ Found workflow: {workflow.get('metadata', {}).get('title')}")
    print(f"   Category: {result.get('category')}")
    print(f"   Version: {workflow.get('metadata', {}).get('version')}")
    print(f"   Agents: {result.get('agents')}")
    print(f"   Tasks: {result.get('tasks')}")
    print(f"\nFull specification:")
    print(json.dumps(workflow, indent=2))
else:
    print(f"❌ {result.get('error')}")
    sys.exit(1)
PYEOF
}

cmd_health_check() {
    echo -e "${YELLOW}→ Running health check${NC}\n"
    
    python3 << PYEOF
import sys
sys.path.insert(0, "$SKILL_DIR")
from mcp_server import call_tool

result = call_tool("health_check", {})

status = result.get('status', 'unknown').upper()
icon = '✅' if status == 'HEALTHY' else '⚠️ ' if status == 'DEGRADED' else '❌'

print(f"{icon} System status: {status}\n")

checks = result.get('checks', {})
for check_name, passed in checks.items():
    icon = '✅' if passed else '❌'
    print(f"{icon} {check_name.replace('_', ' ').title()}: {'OK' if passed else 'FAILED'}")

recommendations = [r for r in result.get('recommendations', []) if r]
if recommendations:
    print(f"\nRecommendations:")
    for rec in recommendations:
        print(f"  • {rec}")

sys.exit(0 if status == 'HEALTHY' else 1)
PYEOF
}

# Run main
main "$@"
