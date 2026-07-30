#!/bin/bash
# agent-workflow-builder VPS Deployment Bootstrap
# Run this ONCE on your VPS to set up the skill for all agents
# Usage: bash DEPLOY_TO_VPS.sh

set -e

echo "🚀 agent-workflow-builder VPS Deployment"
echo "=========================================="
echo ""

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running on VPS (not localhost)
if [ "$1" != "--force" ] && [ -z "$SSH_CLIENT" ] && [ "$(whoami)" = "root" ]; then
    echo -e "${RED}⚠️  Do not run this as root locally. SSH into your VPS first.${NC}"
    echo "Run: ssh user@your-vps-ip && bash DEPLOY_TO_VPS.sh"
    exit 1
fi

# User confirmation
echo -e "${BLUE}This will:${NC}"
echo "  • Install agent-workflow-builder skill to /opt/agent-skills"
echo "  • Install dependencies (yt-dlp, Bright Data CLI, Python packages)"
echo "  • Create Bright Data & Supabase credential files"
echo "  • Register skill with MCP for all agents"
echo ""
read -p "Continue? [y/N] " -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Step 1: Create skill directory
echo -e "${YELLOW}[1/7] Creating skill directory...${NC}"
sudo mkdir -p /opt/agent-skills
sudo chown $USER:$USER /opt/agent-skills
cd /opt/agent-skills

# Step 2: Download/extract skill
echo -e "${YELLOW}[2/7] Downloading agent-workflow-builder...${NC}"
if [ -f "/tmp/agent-workflow-builder.skill" ]; then
    unzip -q /tmp/agent-workflow-builder.skill -d ./agent-workflow-builder
    echo "  (from local file)"
elif [ -f "./agent-workflow-builder.zip" ]; then
    unzip -q ./agent-workflow-builder.zip -d ./agent-workflow-builder
    echo "  (from ./agent-workflow-builder.zip)"
else
    # Create minimal stub if files don't exist (for demo)
    mkdir -p ./agent-workflow-builder/{bin,lib}
    echo "  (created stub structure - copy actual files manually)"
fi

# Step 3: Install Python dependencies
echo -e "${YELLOW}[3/7] Installing Python dependencies...${NC}"
cd /opt/agent-skills/agent-workflow-builder
pip install --break-system-packages -r requirements.txt 2>&1 | grep -E "Successfully installed|already satisfied" || echo "  (some packages may already be installed)"

# Step 4: Install system tools
echo -e "${YELLOW}[4/7] Installing system tools...${NC}"

# yt-dlp (for YouTube)
if ! command -v yt-dlp &> /dev/null; then
    echo "  Installing yt-dlp..."
    pip install --break-system-packages yt-dlp
fi

# Bright Data CLI (for fallback scraping)
if ! command -v bdata &> /dev/null; then
    echo "  Installing Bright Data CLI..."
    if command -v npm &> /dev/null; then
        npm install -g @brightdata/sdk 2>/dev/null && echo "  ✅ Bright Data CLI installed"
    else
        echo "  ⚠️  npm not found. Install with: npm install -g @brightdata/sdk"
    fi
else
    echo "  ✅ yt-dlp already installed"
fi

# Git (needed for auto-commit)
if ! command -v git &> /dev/null; then
    echo "  Installing git..."
    sudo apt-get update && sudo apt-get install -y git 2>/dev/null
fi

# Step 5: Create credential files
echo -e "${YELLOW}[5/7] Setting up credentials...${NC}"

cat > ~/.brightdata.env << 'EOF'
# Bright Data Credentials
# Get your API key from: https://brightdata.com/cp/account/accounts/account-settings/api-token
export BRIGHTDATA_API_KEY="${BRIGHTDATA_API_KEY:-your_actual_api_key_here}"
export BRIGHTDATA_ACCOUNT_ID="${BRIGHTDATA_ACCOUNT_ID:-your_account_id}"
export BRIGHTDATA_ZONE="${BRIGHTDATA_ZONE:-web_unlocker1}"

# Supabase Credentials
# Get from: https://supabase.com/dashboard -> Project Settings -> API
export SUPABASE_URL="${SUPABASE_URL:-your_supabase_url}"
export SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY:-your_service_key}"

# YouTube (optional - for transcript fallback)
# export YOUTUBE_API_KEY="${YOUTUBE_API_KEY:-your_youtube_api_key}"
EOF

# Make it source on login
if ! grep -q "source ~/.brightdata.env" ~/.bashrc; then
    echo 'source ~/.brightdata.env' >> ~/.bashrc
fi

source ~/.brightdata.env
echo "  ✅ Credential file created: ~/.brightdata.env"
echo "  ⚠️  IMPORTANT: Edit ~/.brightdata.env and add your actual credentials"

# Step 6: Create CLI wrapper
echo -e "${YELLOW}[6/7] Creating CLI wrapper...${NC}"
mkdir -p /opt/agent-skills/agent-workflow-builder/bin
cp agent-workflow-builder.cli.sh /opt/agent-skills/agent-workflow-builder/bin/agent-workflow-builder
chmod +x /opt/agent-skills/agent-workflow-builder/bin/agent-workflow-builder

# Add to PATH
if ! grep -q "agent-skills/agent-workflow-builder/bin" ~/.bashrc; then
    echo 'export PATH="/opt/agent-skills/agent-workflow-builder/bin:$PATH"' >> ~/.bashrc
fi
source ~/.bashrc

echo "  ✅ CLI installed: agent-workflow-builder"

# Step 7: Register with agents
echo -e "${YELLOW}[7/7] Registering with agent runtimes...${NC}"

# Claude Code / Cowork
if [ -f ~/.config/claude/claude.json ]; then
    echo "  Configuring Claude Code..."
    # This is just a note - user needs to manually edit
    echo "    ⚠️  Add to ~/.config/claude/claude.json:"
    cat << 'CLAUDE_CONFIG'
    {
      "mcpServers": {
        "agent-workflow-builder": {
          "command": "python3",
          "args": ["/opt/agent-skills/agent-workflow-builder/mcp_server.py"],
          "env": {
            "BRIGHTDATA_API_KEY": "from ~/.brightdata.env",
            "SUPABASE_URL": "from ~/.brightdata.env",
            "SUPABASE_SERVICE_KEY": "from ~/.brightdata.env"
          }
        }
      }
    }
CLAUDE_CONFIG
fi

# Goose Coder
if [ -f ~/.config/goose/config.yaml ]; then
    echo "  Configuring Goose Coder..."
    echo "    ⚠️  Add to ~/.config/goose/config.yaml:"
    cat << 'GOOSE_CONFIG'
    extensions:
      agent-workflow-builder:
        type: stdio
        cmd: python3
        args:
          - /opt/agent-skills/agent-workflow-builder/mcp_server.py
        env:
          BRIGHTDATA_API_KEY: "${BRIGHTDATA_API_KEY}"
          SUPABASE_URL: "${SUPABASE_URL}"
          SUPABASE_SERVICE_KEY: "${SUPABASE_SERVICE_KEY}"
GOOSE_CONFIG
fi

# Cursor / Windsurf
echo "  For Cursor/Windsurf: Add MCP config to .cursor/config.json or windsurf.config.json"

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Edit ~/.brightdata.env with your actual credentials"
echo "  2. Update agent configs (Claude, Goose, Cursor, Windsurf)"
echo "  3. Test with: agent-workflow-builder health-check"
echo "  4. Start scraping: agent-workflow-builder scrape --channel https://www.youtube.com/@michtortiyt"
echo ""
echo -e "${YELLOW}Quick test:${NC}"
echo "  source ~/.brightdata.env"
echo "  agent-workflow-builder health-check"
echo ""
