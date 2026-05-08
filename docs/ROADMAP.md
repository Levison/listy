# Listy roadmap

Short-term work for the voice assistant (Alice upstream fork). Items are tracked here until implemented.

## 1. Native binaries and build pipeline

**1a)** Add scripts that give **strong-ish guarantees** when fetching native binaries: download from **documented upstream origins**, verify integrity (checksums / signatures where available), and fail loudly on mismatch.

**1b)** **Validate and rebuild** the Go backend shipped under `resources/backend/`; add or tighten **compilation scripts** if the current `build:go` flow is incomplete for all target platforms.

**1c)** **Inventory and evaluate** any other bundled executables or prebuilt natives (dependencies, resources, optional models): confirm provenance, update strategy, and whether they belong in-repo or should be fetched by the scripts in **1a**.  
→ **Done (inventory):** [BUNDLED_NATIVES_INVENTORY.md](./BUNDLED_NATIVES_INVENTORY.md)

## 2. Wake word: “Listy”

Change defaults and any hardcoded trigger strings so the local wake-word / voice pipeline responds to **“listy”** instead of **“alice”**, including settings labels where it affects user-facing behavior.

## 3. LLM: Cursor API usage

Route assistant LLM calls so they consume **Cursor account / API usage** (for example via `@cursor/sdk` in the Electron main process with a user API key from [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations), or another officially supported path). Clarify in settings what leaves the device and how keys are stored.

**Dependency:** `@cursor/sdk` is already added to `alice-upstream/package.json` for this effort.

## 4. Ambient noise

Add playback for **white**, **pink**, and **grey** noise (for example as assistant-callable tools and/or a small Web Audio helper), with clear start/stop behavior so playback does not fight TTS or recording.

## 5. Backlog: TypeScript-only local AI backend (replace Go)

**Backlog — not in active scope.** Optionally replace the Go process that serves local STT (whisper.cpp), TTS (Piper), and embeddings (ONNX) with a TypeScript / Electron-main implementation to reduce dual-toolchain cost and optionally drop localhost HTTP. Performance expectations are unchanged for subprocess-based STT/TTS; embeddings depend on choosing a native ONNX path in Node.

**Migration plan:** [go-backend-to-typescript-migration.md](./plans/go-backend-to-typescript-migration.md) (phases, architecture options, and open decision points).

---

*Status: planning only — behavior not yet wired in the app.*