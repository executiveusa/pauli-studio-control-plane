
#!/usr/bin/env python3
import json, time
from pathlib import Path
ROOT = Path('/opt/pauli-effect')
Q = ROOT / 'missions' / 'sandcastle_queue.jsonl'
STATE = ROOT / 'runs' / 'sandcastle_state.json'
STATE.parent.mkdir(parents=True, exist_ok=True)
Q.parent.mkdir(parents=True, exist_ok=True)
if not Q.exists():
    Q.write_text('')
state = {'last_tick': None, 'processed': 0, 'max_parallel': 1, 'budget_usd': 5.0, 'spent_usd': 0.0}
if STATE.exists():
    try:
        state.update(json.loads(STATE.read_text()))
    except Exception:
        pass
lines = [ln for ln in Q.read_text().splitlines() if ln.strip()]
processed, remaining = [], []
for i, ln in enumerate(lines):
    if i < state.get('max_parallel', 1):
        try:
            job = json.loads(ln)
        except Exception:
            job = {'raw': ln}
        job['status'] = 'queued_ack'
        job['ticked_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        processed.append(job)
        state['processed'] = state.get('processed', 0) + 1
    else:
        remaining.append(ln)
Q.write_text('\n'.join(remaining) + ('\n' if remaining else ''))
state['last_tick'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
state['last_batch'] = processed
STATE.write_text(json.dumps(state, indent=2))
print(json.dumps({'ok': True, 'processed': len(processed), 'remaining': len(remaining)}))
