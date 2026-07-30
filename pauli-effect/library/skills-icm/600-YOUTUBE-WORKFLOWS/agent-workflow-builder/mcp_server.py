#!/usr/bin/env python3
"""
MCP Server: agent-workflow-builder
Exposes workflow generation tools to Claude Code, Goose, Cursor, Windsurf
"""

import json
import subprocess
import sys
import os
from pathlib import Path

# Tool definitions that agents discover
TOOLS = {
    "scrape_channel": {
        "description": "Scrape a YouTube channel and convert videos into A2A agent workflows. Automatically handles YouTube rate-limiting with Bright Data fallback.",
        "input_schema": {
            "type": "object",
            "properties": {
                "channel": {
                    "type": "string",
                    "description": "YouTube channel URL (e.g., https://www.youtube.com/@michtortiyt)"
                },
                "max_videos": {
                    "type": "integer",
                    "description": "Maximum videos to scrape (default: 20)",
                    "default": 20
                },
                "output_dir": {
                    "type": "string",
                    "description": "Directory to write workflows (default: ./agent-workflows)"
                },
                "repo_root": {
                    "type": "string",
                    "description": "Repository root for gap analysis (default: current dir)"
                },
                "auto_commit": {
                    "type": "boolean",
                    "description": "Auto-commit results to git (default: false)"
                }
            },
            "required": ["channel"]
        }
    },
    "analyze_repo_gaps": {
        "description": "Analyze a repository for missing infrastructure required by agent workflows. Returns gap report with remediation steps.",
        "input_schema": {
            "type": "object",
            "properties": {
                "repo_root": {
                    "type": "string",
                    "description": "Path to repository root"
                },
                "workflows_dir": {
                    "type": "string",
                    "description": "Path to agent-workflows directory"
                }
            },
            "required": ["repo_root"]
        }
    },
    "list_workflows": {
        "description": "List all available workflows in a directory, grouped by category.",
        "input_schema": {
            "type": "object",
            "properties": {
                "workflows_dir": {
                    "type": "string",
                    "description": "Directory containing workflows (default: ./agent-workflows)"
                }
            }
        }
    },
    "get_workflow": {
        "description": "Fetch a specific workflow JSON with full A2A specification.",
        "input_schema": {
            "type": "object",
            "properties": {
                "workflow_id": {
                    "type": "string",
                    "description": "Workflow ID (e.g., wf_sales_ai_agency_close_system_20260719)"
                },
                "workflows_dir": {
                    "type": "string",
                    "description": "Directory containing workflows"
                }
            },
            "required": ["workflow_id", "workflows_dir"]
        }
    },
    "health_check": {
        "description": "Run a health check on the installation. Verifies Bright Data, Supabase, and skill setup.",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    }
}


def call_tool(name: str, args: dict) -> dict:
    """Execute a tool and return results."""
    
    if name == "scrape_channel":
        return scrape_channel(**args)
    elif name == "analyze_repo_gaps":
        return analyze_repo_gaps(**args)
    elif name == "list_workflows":
        return list_workflows(**args)
    elif name == "get_workflow":
        return get_workflow(**args)
    elif name == "health_check":
        return health_check(**args)
    else:
        return {"error": f"Unknown tool: {name}"}


def scrape_channel(channel: str, max_videos: int = 20, output_dir: str = None, repo_root: str = None, auto_commit: bool = False) -> dict:
    """Scrape YouTube channel and convert to workflows."""
    
    output_dir = output_dir or "./agent-workflows"
    repo_root = repo_root or "."
    
    try:
        # Import the skill's main scraper module
        from agent_workflow_builder import scraper
        
        result = scraper.scrape_channel(
            channel_url=channel,
            max_videos=max_videos,
            output_dir=output_dir,
            repo_root=repo_root,
            auto_commit=auto_commit
        )
        
        return {
            "status": "success",
            "message": f"Scraped {result['videos_processed']} videos from {channel}",
            "workflows_created": result.get("workflows", []),
            "output_dir": output_dir,
            "metrics": {
                "videos_processed": result['videos_processed'],
                "clusters_generated": result.get('clusters', 0),
                "workflows_output": result.get('workflow_count', 0),
                "execution_time_seconds": result.get('duration', 0)
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "message": f"Failed to scrape channel: {e}"
        }


def analyze_repo_gaps(repo_root: str, workflows_dir: str = None) -> dict:
    """Analyze repository for missing infrastructure."""
    
    workflows_dir = workflows_dir or os.path.join(repo_root, "agent-workflows")
    
    try:
        from agent_workflow_builder import gap_analyzer
        
        gaps = gap_analyzer.analyze(repo_root, workflows_dir)
        
        return {
            "status": "success",
            "repo_root": repo_root,
            "gaps": gaps,
            "critical_count": len([g for g in gaps if g.get("severity") == "critical"]),
            "warning_count": len([g for g in gaps if g.get("severity") == "warning"]),
            "remediation": {
                "command": f"cd {repo_root} && agent-workflow-builder fix-gaps --workflows-dir {workflows_dir}"
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


def list_workflows(workflows_dir: str = None) -> dict:
    """List all workflows grouped by category."""
    
    workflows_dir = workflows_dir or "./agent-workflows"
    
    try:
        workflows_by_category = {}
        
        for category in ["sales", "lead_gen", "ops", "research", "marketing", "product"]:
            cat_path = Path(workflows_dir) / category
            if cat_path.exists():
                wf_files = list(cat_path.glob("*.json"))
                workflows_by_category[category] = [
                    {
                        "id": f.stem,
                        "path": str(f),
                        "prompt_md": str(f.parent / f"{f.stem}.prompt.md")
                    }
                    for f in wf_files
                ]
        
        return {
            "status": "success",
            "workflows_dir": workflows_dir,
            "categories": list(workflows_by_category.keys()),
            "workflows": workflows_by_category,
            "total_count": sum(len(v) for v in workflows_by_category.values())
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


def get_workflow(workflow_id: str, workflows_dir: str) -> dict:
    """Get full workflow specification."""
    
    try:
        # Find the workflow file
        for category in ["sales", "lead_gen", "ops", "research", "marketing", "product"]:
            wf_path = Path(workflows_dir) / category / f"{workflow_id}.json"
            if wf_path.exists():
                with open(wf_path) as f:
                    workflow = json.load(f)
                
                # Also load the prompt.md
                prompt_path = wf_path.parent / f"{workflow_id}.prompt.md"
                prompt_text = prompt_path.read_text() if prompt_path.exists() else None
                
                return {
                    "status": "success",
                    "workflow_id": workflow_id,
                    "category": category,
                    "workflow": workflow,
                    "prompt_md": prompt_text,
                    "agents": len(workflow.get("agents", [])),
                    "tasks": len(workflow.get("tasks", []))
                }
        
        return {
            "status": "not_found",
            "error": f"Workflow {workflow_id} not found in {workflows_dir}"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


def health_check() -> dict:
    """Verify installation health."""
    
    checks = {}
    
    # Check Bright Data
    try:
        result = subprocess.run(["bdata", "--version"], capture_output=True, timeout=5)
        checks["bright_data_cli"] = result.returncode == 0
    except:
        checks["bright_data_cli"] = False
    
    # Check Bright Data credentials
    checks["bright_data_key"] = bool(os.environ.get("BRIGHTDATA_API_KEY"))
    
    # Check Supabase
    try:
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if url and key:
            sb = create_client(url, key)
            sb.table("workflow_metrics").select("*").limit(1).execute()
            checks["supabase_connection"] = True
        else:
            checks["supabase_connection"] = False
    except:
        checks["supabase_connection"] = False
    
    # Check skill location
    checks["skill_location"] = Path("/opt/agent-skills/agent-workflow-builder").exists()
    
    # Check Python dependencies
    try:
        import supabase
        import yt_dlp
        import dotenv
        checks["python_dependencies"] = True
    except:
        checks["python_dependencies"] = False
    
    status = "healthy" if all(checks.values()) else "degraded" if any(checks.values()) else "failed"
    
    return {
        "status": status,
        "checks": checks,
        "message": f"System is {status}",
        "recommendations": [
            "Run: source ~/.brightdata.env" if not checks.get("bright_data_key") else None,
            "Install Bright Data CLI: npm install -g @brightdata/sdk" if not checks.get("bright_data_cli") else None,
            "Configure Supabase credentials" if not checks.get("supabase_connection") else None,
            "Install Python dependencies: pip install -r requirements.txt" if not checks.get("python_dependencies") else None
        ]
    }


def main():
    """MCP server main loop."""
    
    # MCP protocol handler
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            
            message = json.loads(line)
            
            if message.get("method") == "tools/list":
                response = {
                    "jsonrpc": "2.0",
                    "id": message.get("id"),
                    "result": {
                        "tools": [
                            {
                                "name": name,
                                "description": spec["description"],
                                "inputSchema": spec.get("input_schema", {})
                            }
                            for name, spec in TOOLS.items()
                        ]
                    }
                }
            
            elif message.get("method") == "tools/call":
                tool_name = message["params"]["name"]
                tool_args = message["params"]["arguments"]
                
                result = call_tool(tool_name, tool_args)
                
                response = {
                    "jsonrpc": "2.0",
                    "id": message.get("id"),
                    "result": result
                }
            
            else:
                response = {
                    "jsonrpc": "2.0",
                    "id": message.get("id"),
                    "error": {"code": -32601, "message": "Method not found"}
                }
            
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
        
        except Exception as e:
            error_response = {
                "jsonrpc": "2.0",
                "error": {"code": -32700, "message": str(e)}
            }
            sys.stdout.write(json.dumps(error_response) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
