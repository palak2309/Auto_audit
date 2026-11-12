# Auto Audit Developer & Agent Guidelines

- **AI Leakage Analysis**: Runs in an authenticated TanStack server function using server-only AI SDKs (Google Gemini, Vertex AI, OpenAI, or local heuristics fallback), returning validated transient results. This keeps financial records and API credentials strictly out of the browser.
- **Server Architecture**: TanStack Start + Nitro server-side functions authenticate all data mutations against Supabase with strict tenant isolation.
- **Client Bundle**: Built with Vite and React 19; client-side environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are baked at build time.
