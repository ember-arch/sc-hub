# pipeline

Windows-only. Runs on the owner's PC on patch days: detect, extract (StarBreaker), normalize onto `packages/schema`, optimize models (gltf-transform), publish to R2. Output goes to `pipeline/out/` (git-ignored); halted-run reports go to `pipeline/reports/`. Lands with spec 01 (data) and spec 04 (models). Until then this folder is a placeholder.
