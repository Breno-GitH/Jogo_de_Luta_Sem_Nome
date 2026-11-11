# Kaneki Ken · Etapa 2

A movimentação usa o corpo aprovado da Etapa 1 e seis desenhos originais de Idle. O atlas novo reúne 39 poses em células transparentes de 256 × 256 px com pivô (128, 224), na escala nativa do personagem.

- Caminhada à frente e recuo têm seis desenhos cada. O avanço do ciclo é medido em distância, e o deslocamento de apresentação mantém a sola no ponto de apoio ao longo de cada passada.
- Dash e backdash têm cinco desenhos cada. A duração e o deslocamento vêm do perfil de Kaneki no integrador `Match`.
- Agachar tem dois desenhos de entrada, dois de guarda baixa e dois de saída. O salto usa três desenhos de preparação, dois de subida, um de ápice, dois de descida e três de aterrissagem.
- A pose define a âncora lombar. Os quatro Kagunes amortecem o movimento com respostas individuais. A subida atrasa as pontas, o ápice abre a silhueta e a descida eleva as curvas. A aproximação suave ao piso preserva a espessura das pontas inferiores.
- Os estados de preparação, contato, sustentação, tração, arremesso e soltura foram reservados no controlador de apresentação para a futura etapa de captura.

## Inspeção

Abra [o laboratório no Apache](http://localhost/2025/Jogo_de_Luta_Sem_Nome/art/kaneki.html). Escolha **Treino livre** para usar WASD e Shift. Use os ensaios gravados para comparar as direções, inspecionar desenho por desenho e marcar as origens e pontas dos tentáculos. **Comparar com o elenco** coloca os quatro sprites-base no mesmo piso, a 1:1. Kaneki e Sasuke medem 129 px. Goku e Samurai medem 130 px.

O treino de movimentação fica no laboratório até a etapa de golpes. A seleção competitiva e as salas LAN continuam com o elenco anterior.

- [Folha de 45 desenhos](public/previews/kaneki/folha-movimento.png)
- [Atlas transparente](public/sprites/kaneki/movement.png)
- [Comparação a 1:1](public/previews/kaneki/escala.png)
- [Prévia geral](public/previews/kaneki/movimentacao.webp), [Idle](public/previews/kaneki/idle.webp), [caminhada](public/previews/kaneki/caminhada.webp), [dashes](public/previews/kaneki/dash.webp) e [saltos](public/previews/kaneki/salto.webp)

## Arquivos editáveis

- `art/kaneki-source/` guarda as sete pranchas-fonte e os prompts. `scripts/pack_kaneki_movement.py` exporta o atlas, os apoios e as âncoras.
- `src/data/kaneki-motion.json` define o perfil de deslocamento. `src/render/kaneki-presentation.ts` liga os estados de `Match` às poses. `src/engine/kagune.ts` controla cada tentáculo.
- `art/kaneki.html` e `src/kaneki-lab.ts` apresentam os ensaios. `scripts/capture_kaneki_movement.mjs` grava os quadros do laboratório. `scripts/compose_kaneki_movement.py` compõe a folha e os WebPs em pixel nativo.

## Verificação reproduzível

```powershell
node scripts/run_art.mjs scripts/pack_kaneki_movement.py
node scripts/run_art.mjs tests/test_kaneki_art.py
npx vitest run tests/kaneki-movement.test.ts tests/kaneki.test.ts --maxWorkers=1
npx playwright test e2e/kaneki.pw.mjs
node scripts/capture_kaneki_movement.mjs http://127.0.0.1:5173/
```

A captura precisa que a URL fornecida esteja servindo a versão atual do laboratório. Os testes cobrem contato das solas, margem das células, âncoras opacas, estados de deslocamento, altura e piso, reações independentes, espelhamento e controle livre pelo teclado.


## Resultado da validação

A publicação no XAMPP passou pelo TypeScript e pelo build do frontend e do backend. O menu carregou nos dois aliases do Apache e ambos reportaram a mesma versão do backend. Os dois testes de navegador do laboratório passaram no build publicado. A suíte Python de arte passou integralmente, e o atlas foi reproduzido byte a byte. O Vitest registrou 880 aprovações e um timeout no teste de autopartida da IA. A suíte de IA passou no reteste isolado com limite de 15 segundos.
