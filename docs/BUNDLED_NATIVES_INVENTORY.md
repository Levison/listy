# Bundled executables and native artifacts (inventory for roadmap 1c)

This document inventories **prebuilt binaries, native libraries, and large model assets** used by the Alice-derived app in `alice-upstream/`. It covers provenance, how they enter the build, and whether they should live in git or be fetched by scripts (aligned with roadmap **1a**).

**Scope:** `alice-upstream` only. Paths below are relative to that directory unless noted.

---

## Summary


| Category                                     | Committed in git?                             | Typical source                                                   |
| -------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Go backend executable                        | No (ignored under `resources/` or `backend/`) | Local `go build` / CI                                            |
| STT/TTS helpers (ffmpeg, whisper.cpp, piper) | No                                            | `scripts/build-go.js` downloads                                  |
| Whisper / Piper voice data                   | No                                            | Same script + Hugging Face                                       |
| ONNX Runtime for embeddings (per-OS libs)    | No                                            | `scripts/setup-embeddings.js` + `native-artifacts.manifest.json` |
| MiniLM ONNX + tokenizer (optional dev setup) | No                                            | `setup-embeddings.js` (Python) or Go runtime download            |
| Electron `extraResources` payload            | N/A                                           | Whatever exists on disk at package time                          |
| Node native addons                           | No (built in `node_modules`)                  | `npm install` / `electron-rebuild`                               |
| VAD + ORT Web (browser/renderer)             | Indirectly via npm                            | Copied from `node_modules` at Vite build                         |


**Recommendation (1c):** Do **not** commit large binaries or models. Keep `**scripts/native-artifacts.manifest.json`** (and `**npm run artifacts:refresh-hashes**`) as the single pin for URLs + SHA-256 where used; extend **1a** so `**build-go.js`** uses the same verified-download path as `setup-embeddings.js` for every external artifact.

---

## 1. Electron packager output (`electron-builder.json5`)

`extraResources` pulls these trees into the installer:


| Resource              | Path in repo                    | Contents (expected)                                                             |
| --------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| App config            | `./app-config.json`             | JSON secrets placeholder (often gitignored locally)                             |
| Backend bundle        | `resources/backend` → `backend` | Go binary, `bin/*`, `models/*`, optional `libinternal/*` (macOS whisper dylibs) |
| Embedding native libs | `backend/lib`                   | Per-platform dirs with `onnxruntime` shared library (from `setup:embeddings`)   |
| Embedding models      | `backend/models`                | e.g. `all-MiniLM-L6-v2/` if `setup:embeddings` was run                          |


**Provenance:** Fully **build-machine dependent**. CI runs `npm run build:go` then `electron-builder`; whatever was produced is shipped.

**Update strategy:** Bump upstream versions in code/scripts (e.g. ONNX version in `setup-embeddings.js` and manifest), re-run setup scripts, refresh hashes, rebuild.

**In-repo?** **No** — `.gitignore` excludes `/resources`, `/backend/lib`, `/backend/models`, `/backend/bin`.

---

## 2. `npm run build:go` (`scripts/build-go.js`)

After `go build`, the script may download and unpack:


| Artifact                | Upstream (documented in code)                                                    | Role                               |
| ----------------------- | -------------------------------------------------------------------------------- | ---------------------------------- |
| FFmpeg                  | BtbN FFmpeg-Builds (Windows), evermeet.cx (macOS), johnvansickle (Linux static)  | Audio tooling for Whisper pipeline |
| whisper.cpp binary      | **aliceai.ca** mirrors (`whisper-*.zip`)                                         | Local STT                          |
| Whisper `ggml-base.bin` | Hugging Face `ggerganov/whisper.cpp`                                             | Default STT model                  |
| Piper                   | Rhasspy GitHub releases; **macOS arm64** also raw GitHub `pmbstyle/Alice` binary | Local TTS                          |
| Piper voices (3× en_US) | Hugging Face `rhasspy/piper-voices`                                              | Bundled TTS models                 |


**Note:** URLs and intended SHA-256 pins live in `**scripts/native-artifacts.manifest.json`** for **1a**-style verification; `**build-go.js`** still uses its own download helpers — consolidation is a **1a** follow-up.

**In-repo?** **No.**

---

## 3. Go backend runtime downloads (fallback paths)

Even without `build-go.js`, services can fetch at runtime (see `backend/internal/**/*.go`):


| Component                         | Primary URLs                                                           | Risk / note                                                 |
| --------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| ONNX Runtime                      | `github.com/microsoft/onnxruntime/releases`                            | Official Microsoft                                          |
| MiniLM `model.onnx` + `vocab.txt` | Hugging Face (Xenova / onnx-community / sentence-transformers mirrors) | Multiple fallbacks                                          |
| Whisper binary                    | **aliceai.ca**                                                         | Third-party mirror; manifest flags “prefer signed upstream” |
| Whisper model                     | Hugging Face `ggerganov/whisper.cpp`                                   | Well-known model repo                                       |
| Piper                             | Rhasspy releases + **pmbstyle/Alice** raw for some macOS paths         | Apple Silicon binary is a **fork-hosted** artifact          |


**In-repo?** **No** (cached under user/temp or `resources/backend` at runtime).

---

## 4. `npm run setup:embeddings` (`scripts/setup-embeddings.js`)


| Artifact                               | Mechanism                                                   | Verification                                      |
| -------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| ONNX Runtime (win/linux/darwin × arch) | `downloadVerified()` + `**native-artifacts.manifest.json`** | SHA-256 enforced                                  |
| MiniLM                                 | Python + Hugging Face `transformers` / `optimum` export     | **Not** pinned in manifest; environment-dependent |


**In-repo?** **No.**

**Evaluation:** ONNX path is the **reference pattern** for 1a. MiniLM setup should eventually use pinned URLs + hashes (or rely solely on Go runtime downloads with the same manifest).

---

## 5. Node.js native addons (`package.json` dependencies)

Built during `npm install` / `npm run rebuild` for Electron’s Node ABI:


| Package          | Purpose                    |
| ---------------- | -------------------------- |
| `better-sqlite3` | SQLite in main process     |
| `hnswlib-node`   | Vector index               |
| `bufferutil`     | Optional `ws` acceleration |


**Provenance:** npm registry; compiled locally or in CI.

**In-repo?** **No** (only source in lockfile).

**Update strategy:** Dependabot / manual bumps; run `electron-rebuild` after Electron version changes.

---

## 6. Renderer / Vite static copy (`vite.config.ts`)

Copied into the web build from `node_modules`:


| Source               | Files                                                                       | Role                     |
| -------------------- | --------------------------------------------------------------------------- | ------------------------ |
| `@ricky0123/vad-web` | `vad.worklet.bundle.min.js`, `silero_vad_v5.onnx`, `silero_vad_legacy.onnx` | Voice activity detection |
| `onnxruntime-web`    | `*.wasm`                                                                    | ORT in the renderer      |


**Provenance:** npm packages (Silero / ONNX Runtime Web distributed by package maintainers).

**In-repo?** **No** — version pinned by `package-lock.json` / `bun.lock`.

---

## 7. Go `embed` (`backend/internal/embedded/assets.go`)

The `//go:embed` directive currently only includes `**assets/.gitkeep`**. There is **no** committed binary embed in-tree; extraction paths exist for a hypothetical future embed.

---

## 8. Legacy / unrelated paths


| Path                                                    | Note                                                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `.gitignore` entries for `resources/python/`, `python/` | Legacy Python backend artifacts — not part of the current Go + Electron path documented above |


---

## Evaluation checklist (1c)

1. **Single source of truth for pins:** Prefer `**native-artifacts.manifest.json`** + verified download for **all** fetched natives (extend **1a** to `build-go.js`).
2. **Highest-risk mirrors:** **aliceai.ca** (whisper) and **raw pmbstyle/Alice** (piper arm64) — document why they exist; plan replacements from upstream or your fork with checksums.
3. **Do not commit:** `resources/backend`, `backend/lib`, `backend/models`, large ONNX/zip artifacts.
4. **Optional models:** MiniLM via Python is hard to reproduce; prefer pinned HF artifacts + SHA-256 or the Go downloader URLs with manifest entries.
5. **npm natives:** Treat like any Electron app — CI must run install on each OS/arch you ship.

---

*Generated for Listy roadmap item **1c**; revise when packaging or download scripts change.*