#!/usr/bin/env python3
"""
Pauli Effect — Bridge Listener (Laptop side)

Listens to the observation API SSE stream for bridge.command events.
When a command arrives (sent from LibreChat on your phone), it:
  1. Speaks the command aloud via ElevenLabs TTS (or browser fallback)
  2. Shows a mission-card popup on screen
  3. Forwards the command to the local TARS server (localhost:4321) for visual reaction

Run: python bridge-listener.py
Requires: local TARS running on port 4321 (START-TARS.bat)
"""
import json, sys, urllib.request, urllib.error, subprocess, os, time, threading

OBSERVE_URL = os.environ.get("PAULI_OBSERVE_URL", "https://api.thepaulieffect.com/observe")
OBSERVE_SECRET = os.environ.get("PAULI_OBSERVE_SECRET", "pauli-observe-tailnet-2026")
LOCAL_TARS = os.environ.get("LOCAL_TARS_URL", "http://127.0.0.1:4321")

def log(msg):
    print(f"[bridge] {msg}", flush=True)

def speak(text):
    """Announce via Windows SAPI (free, no API key needed)."""
    try:
        # PowerShell SAPI voice — works on any Windows, no deps
        ps = f'Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak("{text[:200]}")'
        subprocess.Popen(["powershell", "-Command", ps], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log(f"  spoke: {text[:80]}")
    except Exception as e:
        log(f"  speak failed: {e}")

def popup(title, body):
    """Show a Windows toast/notification popup."""
    try:
        ps = f'''
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$textNodes = $template.GetElementsByTagName("text")
$textNodes.Item(0).AppendChild($template.CreateTextNode("{title}")) | Out-Null
$textNodes.Item(1).AppendChild($template.CreateTextNode("{body[:150]}")) | Out-Null
$toast = [Windows.UI.Notifications.ToastNotification]::new($template)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("PauliEffect.Bridge").Show($toast)
'''
        subprocess.Popen(["powershell", "-Command", ps], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log(f"  popup: {title}")
    except Exception as e:
        log(f"  popup failed: {e}")

def forward_to_local_tars(agent, message):
    """Forward the command to the local TARS for visual reaction + build."""
    try:
        body = json.dumps({"text": message}).encode()
        req = urllib.request.Request(
            f"{LOCAL_TARS}/chat",
            data=body,
            headers={"Content-Type": "application/json", "User-Agent": "PauliBridge/1.0"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode())
            reply = data.get("reply", data.get("response", ""))
            log(f"  local {agent} replied: {str(reply)[:100]}")
            return reply
    except urllib.error.HTTPError as e:
        log(f"  local TARS HTTP {e.code}: {e.reason}")
    except Exception as e:
        log(f"  local TARS unreachable: {e}")
    return None

def handle_bridge_command(data):
    agent = data.get("agent", "?")
    message = data.get("message", "")
    response = data.get("response", "")

    log(f"⚡ BRIDGE COMMAND from {agent}: {message[:80]}")

    # 1. Voice announcement
    speak(f"Command for {agent}: {message[:150]}")

    # 2. Popup notification
    popup(f"⚡ {agent.upper()} command", message[:150])

    # 3. Forward to local TARS for visual reaction + build (if running)
    if agent == "tars":
        reply = forward_to_local_tars(agent, message)
        if reply:
            speak(reply[:150])

def listen_sse():
    """Connect to the observation SSE stream and handle bridge.command events."""
    url = f"{OBSERVE_URL}/stream"
    log(f"Connecting to {url} ...")
    while True:
        try:
            req = urllib.request.Request(url, headers={
                "X-Observe-Secret": OBSERVE_SECRET,
                "Accept": "text/event-stream",
                "User-Agent": "PauliBridge/1.0",
            })
            with urllib.request.urlopen(req, timeout=300) as resp:
                log("✓ Connected to observation stream — listening for bridge commands")
                event_type = None
                data_lines = []
                for line in resp:
                    line = line.decode("utf-8", errors="ignore").strip()
                    if line.startswith("event:"):
                        event_type = line[6:].strip()
                    elif line.startswith("data:"):
                        data_lines.append(line[5:].strip())
                    elif line == "" and event_type:
                        # Event boundary — process
                        if event_type == "bridge.command" and data_lines:
                            try:
                                data = json.loads("".join(data_lines))
                                threading.Thread(target=handle_bridge_command, args=(data,), daemon=True).start()
                            except Exception as e:
                                log(f"parse error: {e}")
                        event_type = None
                        data_lines = []
        except Exception as e:
            log(f"stream disconnected: {e} — retrying in 5s")
            time.sleep(5)

if __name__ == "__main__":
    log("=" * 50)
    log("Pauli Effect — Bridge Listener")
    log(f"Observation API: {OBSERVE_URL}")
    log(f"Local TARS: {LOCAL_TARS}")
    log("Listening for commands from LibreChat...")
    log("=" * 50)
    listen_sse()
