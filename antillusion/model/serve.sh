#!/usr/bin/env bash
# Serve an open-weights coding model with an OpenAI-compatible API for Antillusion (run on the rented GPU machine).
#   bash serve.sh                         # base model
#   LORA=./out/antillusion-lora bash serve.sh   # base model + your fine-tuned adapter
# Then in Antillusion: Settings → مصدر النماذج → "سيرفري السحابي" → http://<server-ip>:8000/v1  (API key = the value of API_KEY below)
set -euo pipefail

MODEL="${MODEL:-Qwen/Qwen3-Coder-30B-A3B-Instruct}"   # Apache-2.0. Bigger and stronger: Qwen/Qwen3-Coder-Next (needs ~2x the VRAM)
PORT="${PORT:-8000}"
API_KEY="${API_KEY:-change-me}"                       # anyone who knows this can use your GPU: set a long random value
CTX="${CTX:-65536}"                                   # context window in tokens; lower it if the GPU runs out of memory
# Tool calling needs the parser that matches the model family. For Qwen coder models try "qwen3_coder" first and
# fall back to "hermes" if your vLLM version does not know it (see: vllm serve --help | grep tool-call-parser).
TOOL_PARSER="${TOOL_PARSER:-qwen3_coder}"

pip install -q -U vllm

ARGS=(serve "$MODEL" --host 0.0.0.0 --port "$PORT" --api-key "$API_KEY" --max-model-len "$CTX"
      --enable-auto-tool-choice --tool-call-parser "$TOOL_PARSER" --gpu-memory-utilization 0.92)
if [[ -n "${LORA:-}" ]]; then
  ARGS+=(--enable-lora --lora-modules "antillusion=$LORA" --max-lora-rank 64)   # the adapter shows up in the app as the model "antillusion"
fi

echo "Serving $MODEL on :$PORT (context $CTX, tool parser $TOOL_PARSER)"
exec vllm "${ARGS[@]}"
