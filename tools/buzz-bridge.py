#!/usr/bin/env python3
"""
Buzz → Pauli Agent Bridge
==========================
Polls the Buzz relay for @mention messages addressed to each agent,
routes them to the agent's HTTP endpoint, and posts the response back.

Each agent has a Nostr keypair and polls for messages where it's @mentioned.
When a message arrives, it's forwarded to the agent's VPS HTTP endpoint
(e.g., BARS at localhost:4321/chat), and the response is posted back to Buzz.

Run: python3 buzz-bridge.py
"""
import json, os, time, urllib.request, urllib.error, threading, ssl, sys

# Load agent keypairs
KEYS_PATH = os.environ.get("BUZZ_KEYS_PATH", os.path.join(os.path.dirname(__file__), "buzz-agent-keys.json"))
RELAY_URL = os.environ.get("BUZZ_RELAY_URL", "https://buzz.thepaulieffect.com")

with open(KEYS_PATH) as f:
    AGENTS = json.load(f)

# Agent HTTP endpoints (on the VPS)
AGENT_ENDPOINTS = {
    "pi":     {"url": "http://127.0.0.1:4717/chat", "field": "message"},
    "hermes": {"url": "http://127.0.0.1:4800/fleet/chat", "field": "message"},
    "bars":   {"url": "http://127.0.0.1:4321/chat", "field": "text"},
    "jarvis": {"url": "http://127.0.0.1:4719/chat", "field": "question"},
}

# Track processed event IDs to avoid duplicates
processed = set()

def log(agent, msg):
    print(f"[buzz-bridge][{agent}] {msg}", flush=True)

def query_relay(agent_slug, agent_info, since_ts):
    """Query the Buzz relay for recent messages mentioning this agent.
    Uses the POST /query HTTP endpoint (Nostr REQ over HTTP)."""
    privkey = agent_info["private_key"]
    # Build a Nostr filter for text messages (kind 9 in Buzz = channel messages)
    # Buzz /query expects a raw array of Nostr filters, not wrapped in {"filters": [...]}
    filter_body = json.dumps([{
        "kinds": [9, 45001],  # Buzz message kinds
        "since": since_ts,
        "limit": 20
    }]).encode()

    req = urllib.request.Request(
        f"{RELAY_URL}/query",
        data=filter_body,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "BuzzBridge/1.0",
            "Host": "localhost:3000",
            "X-Pubkey": agent_info.get("pubkey", ""),
        },
    )
    try:
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            events = json.loads(r.read().decode())
            return events if isinstance(events, list) else events.get("events", [])
    except urllib.error.HTTPError as e:
        log(agent_slug, f"relay query HTTP {e.code}: {e.read().decode()[:200]}")
        return []
    except Exception as e:
        log(agent_slug, f"relay query error: {e}")
        return []

def send_to_agent(agent_slug, message_text):
    """Forward a message to the agent's HTTP endpoint and get the response."""
    ep = AGENT_ENDPOINTS.get(agent_slug)
    if not ep:
        return f"[{agent_slug} endpoint not configured]"

    payload = json.dumps({ep["field"]: message_text}).encode()
    req = urllib.request.Request(
        ep["url"],
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "BuzzBridge/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read().decode())
            # Extract response based on agent's format
            return (data.get("reply") or data.get("response") or
                    data.get("answer") or json.dumps(data)[:500])
    except Exception as e:
        return f"[{agent_slug} error: {e}]"

def post_to_relay(agent_slug, agent_info, channel_id, content):
    """Post a message back to the Buzz relay as the agent."""
    privkey = agent_info["private_key"]
    # Use POST /events to submit a signed Nostr event
    # For now, use the simpler HTTP bridge (POST /events accepts unsigned in dev mode)
    event = {
        "kind": 9,  # Buzz channel message
        "content": content[:4000],
        "tags": [["h", channel_id]] if channel_id else [],
        "created_at": int(time.time()),
    }
    body = json.dumps(event).encode()
    req = urllib.request.Request(
        f"{RELAY_URL}/events",
        data=body,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "BuzzBridge/1.0",
            "Host": "localhost:3000",
            "X-Pubkey": agent_info.get("pubkey", ""),
        },
    )
    try:
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            result = json.loads(r.read().decode())
            return result.get("accepted", False)
    except Exception as e:
        log(agent_slug, f"post to relay error: {e}")
        return False

def agent_loop(agent_slug, agent_info):
    """Main loop for one agent: poll → route → respond."""
    log(agent_slug, f"starting bridge loop (endpoint: {AGENT_ENDPOINTS.get(agent_slug, {}).get('url', '?')})")
    since_ts = int(time.time())
    channel_id = None  # Will be set once we see the first message

    while True:
        try:
            events = query_relay(agent_slug, agent_info, since_ts)
            for evt in events:
                evt_id = evt.get("id", "")
                if evt_id in processed:
                    continue
                processed.add(evt_id)
                if len(processed) > 500:
                    processed.clear()

                content = evt.get("content", "")
                tags = evt.get("tags", [])

                # Find channel ID from h tags
                for tag in tags:
                    if len(tag) >= 2 and tag[0] == "h":
                        channel_id = tag[1]

                # Check if this agent is mentioned
                agent_name = agent_info["name"].lower()
                if f"@{agent_slug}" in content.lower() or f"@{agent_name}" in content.lower():
                    # Strip the @mention from the message
                    import re
                    clean_msg = re.sub(rf"@{agent_slug}\s*", "", content, flags=re.I).strip()
                    if not clean_msg:
                        clean_msg = content

                    log(agent_slug, f"received: {clean_msg[:80]}...")

                    # Forward to agent
                    response = send_to_agent(agent_slug, clean_msg)
                    log(agent_slug, f"response: {response[:80]}...")

                    # Post response back to Buzz
                    if channel_id:
                        posted = post_to_relay(agent_slug, agent_info, channel_id, response)
                        log(agent_slug, f"posted to Buzz: {posted}")

            since_ts = int(time.time()) - 60  # Look back 60s to catch any missed
        except Exception as e:
            log(agent_slug, f"loop error: {e}")

        time.sleep(3)  # Poll every 3 seconds

if __name__ == "__main__":
    print("=" * 60, flush=True)
    print("Buzz → Pauli Agent Bridge", flush=True)
    print(f"Relay: {RELAY_URL}", flush=True)
    print(f"Agents: {', '.join(AGENTS.keys())}", flush=True)
    print("=" * 60, flush=True)

    # Start one thread per agent
    threads = []
    for slug, info in AGENTS.items():
        t = threading.Thread(target=agent_loop, args=(slug, info), daemon=True)
        t.start()
        threads.append(t)
        time.sleep(0.5)

    # Keep alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nBuzz bridge stopped.", flush=True)
