# Building with LLM APIs (chat, tools, streaming, RAG, agents)
tags: ai llm openai anthropic claude openrouter gpt chatbot agent tool calling streaming embeddings rag prompt mcp ذكاء اصطناعي شات بوت وكيل نموذج لغوي

Chat Completions shape (OpenAI-compatible; OpenRouter exposes every vendor through it at `https://openrouter.ai/api/v1`):
```js
const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST", headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "anthropic/claude-sonnet-5.5", messages: [{ role: "system", content: "…" }, { role: "user", content: "…" }], stream: true }),
});
```
Never call a paid API from browser code with the key embedded — proxy through your server and keep the key in an env var.

Streaming: the response is SSE — lines `data: {json}` ending with `data: [DONE]`; append `choices[0].delta.content`; forward to the browser as SSE or a ReadableStream; allow cancel with AbortController.

Tool calling loop: send `tools: [{ type: "function", function: { name, description, parameters: <JSON Schema> } }]` → the assistant message contains `tool_calls` (id, name, JSON-string arguments; in streams the arguments arrive in fragments keyed by index) → run each tool → append `{ role: "tool", tool_call_id, content }` for every call → call the model again → repeat until there are no tool calls. Validate arguments; return errors as tool results so the model can recover; cap iterations.

Anthropic native SDK: `client.messages.create({ model, max_tokens, system, messages, tools })`; content is an array of blocks (`text`, `tool_use`, `tool_result`); prompt caching with `cache_control: { type: "ephemeral" }` on stable prefixes.

Prompts: say who the model is, what the task and success criteria are, give context in tagged sections (`<document>…</document>`), show the output format, and put long material before the question. Ask for JSON with a schema (structured outputs / `response_format`) when code consumes the result, and still validate it.

RAG: chunk documents (≈ 300–800 tokens with overlap, split on structure), embed, store vectors (pgvector, sqlite-vec, Qdrant, LanceDB, Chroma), retrieve top-k by cosine similarity (+ keyword/BM25 hybrid, rerank), put the passages in the prompt with source ids, and tell the model to answer only from them and cite.

Production: timeouts and retries with backoff on 429/5xx, token and cost accounting from the `usage` field, context-window management (summarise or drop old turns), rate limits per user, moderation of inputs where needed, never log secrets or more user content than necessary, evaluate changes against a fixed test set.

MCP (Model Context Protocol): expose tools/resources to agents through a server (`@modelcontextprotocol/sdk`, Python `mcp`), over stdio or HTTP.
