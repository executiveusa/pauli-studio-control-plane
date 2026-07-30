# Real-ESRGAN — Image Super-Resolution Skill

## Identity
- **id:** real-esrgan
- **name:** Real-ESRGAN Image Enhancement
- **shelf:** 500-SKILLS-AND-PATTERNS
- **version:** 0.3.0
- **purpose:** Upscale and enhance images using AI super-resolution

## What It Does
Real-ESRGAN enhances low-resolution images to high-resolution using deep learning.
- 4x upscale (configurable: 2x, 3x, 4x, arbitrary via outscale param)
- Face enhancement via GFPGAN integration
- Anime-optimized model available
- CPU inference on VPS (no GPU required, slower but functional)

## Models Available
| Model | Best For | Size |
|-------|----------|------|
| RealESRGAN_x4plus | General photos, real-world images | 64MB |
| RealESRGAN_x4plus_anime_6B | Anime, illustrations, cartoons | 18MB |

## API Endpoint
```
POST http://api.thepaulieffect.com/esrgan/enhance
GET  http://api.thepaulieffect.com/esrgan/health
GET  http://api.thepaulieffect.com/esrgan/models
```

### Enhance Image
```bash
# General image (4x upscale)
curl -X POST "http://api.thepaulieffect.com/esrgan/enhance?model=RealESRGAN_x4plus&outscale=4" \
  -H "Content-Type: image/png" \
  --data-binary @input.png > output.json

# Anime image
curl -X POST "http://api.thepaulieffect.com/esrgan/enhance?model=RealESRGAN_x4plus_anime_6B&outscale=4" \
  -H "Content-Type: image/png" \
  --data-binary @input.png > output.json

# With face enhancement
curl -X POST "http://api.thepaulieffect.com/esrgan/enhance?model=RealESRGAN_x4plus&face_enhance=true" \
  -H "Content-Type: image/png" \
  --data-binary @input.png > output.json
```

### Response Format
```json
{
  "success": true,
  "model": "RealESRGAN_x4plus",
  "outscale": 4,
  "elapsed_s": 12.5,
  "output_b64": "<base64-encoded-output>",
  "output_path": "/tmp/esrgan_out_abc123.png"
}
```

## Usage Patterns

### TARS (Builder)
Use when: building UIs, generating marketing assets, enhancing client images
```bash
curl -s -X POST "http://api.thepaulieffect.com/esrgan/enhance?outscale=4" \
  -H "Content-Type: image/png" --data-binary @raw-screenshot.png | \
  python3 -c "import json,sys,base64; d=json.load(sys.stdin); open('enhanced.png','wb').write(base64.b64decode(d['output_b64']))"
```

### JARVIS (Memory)
Use when: storing enhanced images in the second brain, cataloging visual assets

### Pi (Orchestrator)
Use when: routing image enhancement requests to TARS, quality-checking outputs

### Hermes (Dispatcher)
Use when: including image enhancement in multi-agent workflows

## Guardrails
- CPU-only inference: expect 10-60s per image depending on size
- Max input: 4096x4096 (memory constraint on 8GB VPS)
- No batch processing (one image at a time via API)
- Output is base64-encoded in JSON (decode before saving)
- Models auto-download on first use (~82MB total)

## Access
All agents: hermes, cosmos-pi, tars, cosmos-brain, dashboard
