# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stand-combat.pw.mjs >> records a real Stand-only ground combo for the release preview
- Location: e2e\stand-combat.pw.mjs:235:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  locator('#arena')
Expected: "true"
Received: ""
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" locator('#arena') with timeout 5000ms
  - waiting for locator('#arena')
    14 × locator resolved to <canvas id="arena" width="1280" height="720" tabindex="0" aria-label="Dio e The World em combate"></canvas>
       - unexpected value "null"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - text: DIO + THE WORLD / COMBATE REAL / REVISÃO 3
      - heading "Dio comanda. The World luta." [level=1] [ref=e4]
    - link "Jogar no menu principal" [ref=e5] [cursor=pointer]:
      - /url: ../
  - paragraph [ref=e6]: Todos os nove normais pertencem ao Stand. Dio apenas assume poses e faz gestos de comando. Os combos mantêm The World na posição ofensiva, com transições próprias entre os golpes.
  - generic [ref=e7]:
    - generic [ref=e8]:
      - text: Sequência
      - combobox "Sequência" [ref=e9]:
        - option "Stand Light · Soco rápido" [selected]
        - option "Stand Medium · Soco direto"
        - option "Stand Heavy · Demolidor"
        - option "Crouch Light · Soco baixo"
        - option "Crouch Medium · Varredura"
        - option "Crouch Heavy · Uppercut"
        - option "Air Light · Soco aéreo"
        - option "Air Medium · Dois socos"
        - option "Air Heavy · Esmagamento"
        - option "Combo terrestre · 3 impactos"
        - option "Combo agachado · 3 impactos"
        - option "Combo aéreo · 4 impactos"
        - option "Launcher + combo aéreo · 5 impactos"
        - option "Interrupção por dano"
        - option "Golpe no vazio e retorno"
    - button "Executar sequência" [ref=e10] [cursor=pointer]
    - generic [ref=e11]:
      - text: Adversário
      - combobox "Adversário" [ref=e12]:
        - option "Samurai" [selected]
        - option "Dio + The World"
    - generic [ref=e13]:
      - text: Distância inicial
      - spinbutton "Distância inicial" [ref=e14]: "65"
    - generic [ref=e15]:
      - text: Avanço máximo do Stand
      - spinbutton "Avanço máximo do Stand" [ref=e16]: "12"
  - generic [ref=e17]:
    - button "Pausar" [ref=e18] [cursor=pointer]
    - button "Avançar 1 tick" [disabled] [ref=e19]
    - button "Próximo desenho" [disabled] [ref=e20]
    - generic [ref=e21]:
      - text: Avançar desenho de
      - combobox "Avançar desenho de" [ref=e22]:
        - option "The World" [selected]
        - option "Dio"
    - button "Restaurar posições" [ref=e23] [cursor=pointer]
    - button "Trocar adversário de lado" [ref=e24] [cursor=pointer]
    - generic [ref=e25]:
      - text: Velocidade
      - combobox "Velocidade" [ref=e26]:
        - option "0,25×"
        - option "0,5×"
        - option "1×" [selected]
    - generic [ref=e27]:
      - text: Zoom
      - combobox "Zoom" [ref=e28]:
        - option "1×" [selected]
        - option "2×"
        - option "3×"
    - generic [ref=e29]:
      - checkbox "Caixas e pivôs" [checked] [ref=e30]
      - text: Caixas e pivôs
    - generic [ref=e31]:
      - checkbox "Vida infinita no treino livre" [checked] [ref=e32]
      - text: Vida infinita no treino livre
    - generic [ref=e33]:
      - text: Parceiro
      - combobox "Parceiro" [ref=e34]:
        - option "Parado" [selected]
        - option "Defender em pé"
        - option "Defender agachado"
        - option "Pular"
        - option "BOT normal"
    - generic [ref=e35]:
      - checkbox "Dio à direita" [ref=e36]
      - text: Dio à direita
  - generic "Dio e The World em combate" [ref=e38]
  - paragraph [ref=e39]: "A/D mover · W pular · S agachar · J leve · K médio · L forte · Shift + direção: dash. Clique na arena para jogar livremente. Verde: hurtboxes de Dio; vermelho: punho ativo; roxo/dourado: origens. O Stand não recebe dano separadamente."
  - generic "Histórico do deslocamento relativo do Stand" [ref=e40]
  - generic [ref=e41]:
    - generic [ref=e42]:
      - text: Rever ticks gravados
      - slider "Rever ticks gravados" [ref=e43]: "0"
    - button "Voltar ao treino livre" [ref=e44] [cursor=pointer]
  - status [ref=e45]: Carregando…
  - alert
  - paragraph [ref=e46]:
    - link "Inspecionar todos os desenhos e as animações separadas" [ref=e47] [cursor=pointer]:
      - /url: dio.html
    - text: ·
    - link "Baixar golpes, comandos, transições e propriedades" [ref=e48] [cursor=pointer]:
      - /url: ../downloads/dio-normal-attacks.zip
  - text: O avanço configurado é um máximo. Sequências de combo usam uma distância de teste indicada no campo. Alterações de alcance valem para o próximo ensaio. O golpe só lança ou derruba se conectar. As reações de dano e os resultados de Dio ainda usam poses próprias provisórias.
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import fs from "node:fs";
  3   | const qa = "art/dio/qa/stand-only";
  4   | fs.mkdirSync(qa, { recursive: true });
  5   | const damage = {
  6   |   stand_light: 42,
  7   |   stand_medium: 72,
  8   |   stand_heavy: 116,
  9   |   crouch_light: 38,
  10  |   crouch_medium: 64,
  11  |   crouch_heavy: 88,
  12  |   air_light: 38,
  13  |   air_medium: 66,
  14  |   air_heavy: 108,
  15  | };
  16  | async function start(page, freeze = false) {
  17  |   const epoch = new Date("2026-10-30T12:00:00Z");
  18  |   await page.clock.install(freeze ? { time: epoch } : {});
  19  |   if (freeze) await page.clock.pauseAt(new Date(epoch.getTime() + 60000));
  20  |   await page.goto("/art/dio-combat.html");
  21  |   const c = page.locator("#arena");
> 22  |   await expect(c).toHaveAttribute("data-loaded", "true");
      |                   ^ Error: expect(locator).toHaveAttribute(expected) failed
  23  |   return c;
  24  | }
  25  | async function save(c, file) {
  26  |   fs.writeFileSync(
  27  |     file,
  28  |     Buffer.from(
  29  |       (await c.evaluate((n) => n.toDataURL("image/png"))).split(",")[1],
  30  |       "base64",
  31  |     ),
  32  |   );
  33  | }
  34  | 
  35  | test("nine Stand-only normals hit in both directions against Samurai and Dio", async ({
  36  |   page,
  37  | }) => {
  38  |   test.setTimeout(180000);
  39  |   const errors = [];
  40  |   page.on("pageerror", (e) => errors.push(e.message));
  41  |   const c = await start(page);
  42  |   const results = [];
  43  |   for (const enemy of ["samurai", "dio"])
  44  |     for (const mirror of [false, true]) {
  45  |       await page.selectOption("#opponent", enemy);
  46  |       await page.locator("#mirror").setChecked(mirror);
  47  |       for (const [name, value] of Object.entries(damage)) {
  48  |         await page.selectOption("#scenario", name);
  49  |         await page.locator("#gap").fill("65");
  50  |         await page.locator("#run").click();
  51  |         await page.clock.runFor(1800);
  52  |         await expect(c).toHaveAttribute("data-done", "true");
  53  |         await expect(c).toHaveAttribute(
  54  |           "data-hits",
  55  |           name === "air_medium" ? "2" : "1",
  56  |         );
  57  |         await expect(c).toHaveAttribute("data-damage", String(value));
  58  |         await expect(c).toHaveAttribute("data-stand-mode", "follow");
  59  |         await expect(c).toHaveAttribute("data-stand-boxes", "0");
  60  |         results.push({ enemy, mirror, name, damage: value });
  61  |       }
  62  |     }
  63  |   fs.writeFileSync(
  64  |     `${qa}/browser-attacks.json`,
  65  |     JSON.stringify(results, null, 2),
  66  |   );
  67  |   expect(errors).toEqual([]);
  68  | });
  69  | 
  70  | test("all four combos keep the Stand offensive until the final recovery", async ({
  71  |   page,
  72  | }) => {
  73  |   test.setTimeout(90000);
  74  |   const c = await start(page);
  75  |   const results = [];
  76  |   for (const enemy of ["samurai", "dio"])
  77  |     for (const [name, hits, actions] of [
  78  |       ["groundCombo", 3, 3],
  79  |       ["crouchCombo", 3, 3],
  80  |       ["airChain", 4, 3],
  81  |       ["airCombo", 5, 5],
  82  |     ]) {
  83  |       await page.selectOption("#opponent", enemy);
  84  |       await page.selectOption("#scenario", name);
  85  |       await page.locator("#run").click();
  86  |       const states = [];
  87  |       for (let i = 0; i < 200; i++) {
  88  |         await page.clock.runFor(17);
  89  |         const s = await c.evaluate((n) => ({ ...n.dataset }));
  90  |         states.push(s);
  91  |         if (s.standMode === "return") expect(Number(s.stage)).toBe(actions);
  92  |         if (s.done === "true") break;
  93  |       }
  94  |       await expect(c).toHaveAttribute("data-max-combo", String(hits));
  95  |       await expect(c).toHaveAttribute("data-hits", String(hits));
  96  |       await expect(c).toHaveAttribute("data-stand-mode", "follow");
  97  |       expect(states.some((s) => s.standClip.startsWith("bridge_"))).toBe(true);
  98  |       results.push({ enemy, name, hits, states });
  99  |     }
  100 |   fs.writeFileSync(
  101 |     `${qa}/browser-combos.json`,
  102 |     JSON.stringify(results, null, 2),
  103 |   );
  104 | });
  105 | 
  106 | test("pause, drawing stepping, slow playback, zoom, replay and recovery turning work", async ({
  107 |   page,
  108 | }) => {
  109 |   const c = await start(page);
  110 |   await page.selectOption("#zoom", "2");
  111 |   await page.selectOption("#speed", "0.25");
  112 |   await page.selectOption("#scenario", "stand_heavy");
  113 |   await page.locator("#run").click();
  114 |   await page.clock.runFor(1000);
  115 |   await page.locator("#pause").click();
  116 |   const before = await c.getAttribute("data-stand-frame");
  117 |   await page.locator("#next-frame").click();
  118 |   expect(await c.getAttribute("data-stand-frame")).not.toBe(before);
  119 |   await save(c, `${qa}/heavy-debug.png`);
  120 |   await page.locator("#pause").click();
  121 |   await page.clock.runFor(600);
  122 |   await page.locator("#swap-side").click();
```