# Work in progress — full Goku reconstruction (latest user scope)

The active task is ALL movement, not only walk. User mandated order: diagnose → base/Idle → walking → crouch → jump → dash → transitions → whole set review/tests. User explicitly authorizes replacing previous Goku non-walk art. Samurai/Dio/World, menus, physics/combat must remain. Do not spawn agents: latest developer disallows proactive delegation and former agents hit usage limits.

## Current state

- Root `C:/xampp/htdocs/2025/Jogo_de_Luta_Sem_Nome`, PowerShell; Python bundled in `C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`. `node scripts/run_art.mjs ...` selects Pillow/numpy.
- Production server3001 currently running from the PRIOR eight-complete-walk v4 build in exec session47729. Its engineVersion wasf6d433868036ae2670528d94. Restart only own server after final build. Browser may show old production until rebuilt.
- Full last v4 tests (361unit/95art/10Chrome) were before this full-scope reconstruction. DO NOT present them as verification of newly changed Idle/all movement. Fresh full testing required at end.
- `art/goku/preservation.json` protects all other characters and data; `rebuild/physics-freeze.json` freezes Goku movement parameters, engine TS, shared Animator and Dio director. New generator calls protect(). Physics stays4.2/3.8,air6.5,jump−17.7,gravity.72,start6,landing8,dash profiles14ticks.
- Read/compared Samurai and Dio scripts and shared renderer. `diagnostic-pipeline.md` documents findings. `comparison-initial.png` shows untouched whole native guard versus rebuilt old Idle and other characters. Existing Goku's AnatomyRig/SourceRig cause the distortion BEFORE packing. Shared Animator handles columns/durations/pivots correctly, smoothing off.

## Foundation stage

- Generated six WHOLE Idle drawings from approved raw guard via built-in imagegen. Raw: `idle-source-attempt1.png`, tool output exec-35957e1a-eace-4ece-8f4f-f348119ea9e1.png. Output visually showed RGB glow but those background pixels have alpha0, so normal alpha threshold180 removes it; bodyalpha max254.
- Source grid3columns×2rows. Six poses complete, bodyconnected>=99.9%, heights127–130, clean palette32, no clipped limbs. No body part masks, mesh, grafted head, rescaling bones or morphing.
- `scripts/goku_rebuild.py` is new generic active pipeline: standing calibration cell0 sets ONEuniform scale per source sheet. Import only whole cell crop, uniform nearest, palette/alpha and integer placement. Ground poses currently register bottom+shoe midpoint; aerial defaults top94. For walking/dash, explicit per-pose registration/whole prepared sources are needed so a lifted boot does not recenter the entire character.
- `sources.json` currently only foundation/idle with6frames, durations[9,9,10,11,10,11]total60. `goku_rebuild.py foundation` prepared and validated; `foundation --publish` ALREADY published new Idle/base and its poses/hurtboxes to src/data + public. Root manifestrevision5,rebuildStagefoundation. Other movement still old except clean v4walking. Needs full completion.
- Before publishing, copied all prior Goku public assets to `art/goku/rebuild/before-public` and `public/sprites/goku-before-rebuild` for comparisons. No other characters modified.
- Foundation files: `prepared/idle-00..05.png`, `idle-contact.png`, `foundation-production.json`, `foundation-validation.json`. Canonical source can be cropped first rawIdlecell with `extract_sheet`. Use this whole guard as reference for following stages, validate Foundation live FIRST.
- New `e2e/goku-rebuild.pw.mjs` foundation test created but NOT run yet. Run with approved Playwright prefix. It checks8secidle,6frames,pause,frame step,camera slow using actual renderer, records `rebuild/qa/idle-NN.png`.
- `src/goku-lab.ts` now labels per-cliprebuildStage and exposes revision5 from movement root. Existing old e2e asserts revision2 and old frozen139Goku tests need updating for NEW authorization, while retaining other character/physics locks. Do NOT merely weaken art checks.
- `scripts/build_goku.py` __main__ now delegates to goku_rebuild.build_all (does NOT run old rig). build_all requires stagesfoundation/walk/crouch/jump/dash/transitions/reactions before full export, so currently correctly fails missing stages.

## Walking work already made, pending revalidation as stage3

- v3 mesh was rejected. v4 eight complete poses per direction was clean and integrated; source contract proves whole RGBA sources. No deformed walkStop active; removed large transitionsJSON from src to v3 historical archive.
- To reduce held-cel sliding, generated eight MORE COMPLETE poses per direction (not pixel interpolation). Both raw sheets copied to `art/goku/walk-v4/forward-mid-sheet-source.png` (exec53520955...) and `back-mid-sheet-source.png` (exec47c077de...). Prompts `mid-prompts.json`. Guide scripts/data there; all are NEW complete drawings.
- `scripts/prepare_goku_clean_walk.py` now has prepare_base() then prepare() interleaves baseeven/newmidodd to16frames each, timings2/2/2/3 repeated (36ticks). Has NOT been run with mid sources yet. Running prepare only writes ART, no public; permitted AFTER foundation validated. It uses original base raw sources + separately redrawn forward3/7. All source info in production.json, whole normalization512PNG → native256. No mesh.
- `scripts/build_goku_clean_walk.py` partly updated dynamiccount/columns, publicpreviews rows; but its preserve_other() locks139nonwalk Goku and WILL FAIL under new full scope. Do not use to publish now. Integrate those freshly prepared whole poses through new rebuild pipeline or adapt its source handling, while retaining raw-source proof.
- `scripts/package_goku_clean_walk.py` updated dynamicframecount but not run after sourceexpansion; old v4 downloads/previews currently8frames. Repackage at final.
- `walk-v4/landmarks.json` still8perdirection. Needs16annotations/new source hashes after preparing; active support metadata must refer to real alpha223pixels, hidden solesnull; don't invent bones as proof. Former8source images indexed0..7 will be interleaved and overwritten in ART by prepare() using in-memory copies, public unchanged until publish.
- v4 runtime `src/render/goku-motion.ts`: no mesh/stopJSON, timing from source durations/travel, optional maxFootCorrection0 (whole figure compensation disabled). DirectIdle return; full new scope requires explicit clean transition poses/recovery. Preserve physics/input response.

## Full reconstruction approach

All remaining clips must be whole newly drawn poses. Use built-in imagegen, not CLI/API. Skill read; save sources/prompts in workspace. Use one standing calibration pose in EACH source sheet to set scale; crouched pose must NOT be scaled back to130px. Ground floor224; air retracted feet may end above224, never force air feet to floor or below physical foot origin. Prefer guard hands below hair so hair remains top for registration. Additional joints are annotations/planning, never render limbs.

Existing25clips inventory in animation-inventory.json includes4crouchstart/3idle/4end,2crouchWalk transitions,7+7dash,3takeoff,3rise/2apex/3fall ×3directions,4landing and trainingHit/AirHit/Down/Getup. Need replace the additional training movement reactions too to prevent old deformed body appearing after damage. Entrances/guard/victory currently aliases; no Goku attacks requested/implemented, remains training-only.

Suggested counts/timings keeping physics: crouchstart/end4×2ticks; jumpstart3×2=6; landing4×2=8; air phases selected by actual trajectory (existing director), directional poses distinct; dash physical14ticks, add whole recovery visual tails interruptible. Idle-to-walk/walk-to-idle require explicit complete transitions, not old synthetic576meshstops.

Current goku_rebuild.py supports sourceSheet perclip, whole source crop/scale/registration, grounded variable height, pre-atlas integrity checks, publishing one stage. Extend for whole prepared walk frames from validated v4provenance or sourceRefs. It currently lacks all joint annotations, gait updates, variable source sheets perclip and frame references; add as needed. It doesn't validate artistic naturalness automatically. Visual inspection remains mandatory.

Final tools/tests: browser Playwright Chrome needs scoped require_escalated prefix["node","node_modules/@playwright/test/cli.js","test"]. Latest3001production smoke script `e2e/goku-walk-production.mjs` only v4walk, needs fullrebuild counterpart. Full npmtest and build after allnew data. Need publish real APNG/GIFactualgame capture, contact sheets, allPNG+JSONdownload, stage-specific results and candid limitations. No final until all required stages handled.
