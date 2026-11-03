# Sem Nome — luta 2D

**Revisão de combate:** R agora ativa a Super de qualquer personagem. Mobilidade e normais mais rápidos, cancelamentos por confirmação, um reverse beat terrestre, combos aéreos e teletransporte aéreo J/K/L do Goku. [Regras, parâmetros, laboratório e testes](COMBATE-FRENETICO.md). Os PNGs aprovados e as três cinematografias foram preservados.

**XAMPP + LAN:** abra [o jogo no Apache](http://localhost/jogo-luta/), ou [o caminho completo](http://localhost/2025/Jogo_de_Luta_Sem_Nome/). Inicie Apache no XAMPP e execute `iniciar-multiplayer.bat`. Atualize com `atualizar-xampp.bat`. [Instalação, rede, proxy, testes e limites](README_LAN.md). Samurai, Dio/The World e Goku estão disponíveis em salas reais com seleção, confirmação, prontidão e início pelo anfitrião. Não é necessário Vite para jogar.

**Goku — Fúria Saiyajin:** Super cinematográfica, **R**, uma barra completa com ganho mais lento. Transformação, primeiro soco com confirmação, combo terrestre/aéreo, teletransportes, Kamehameha descendente e retorno gradual à forma base. SSJ1 existe somente nessa sequência. [Executar e inspecionar](http://localhost/jogo-luta/art/goku-fury.html), [PNG/APNG/JSON](http://localhost/jogo-luta/downloads/goku-fury.zip), [gravação real](http://localhost/jogo-luta/previews/goku-fury-gameplay.png), [arquivos, regras, testes e limitações](GOKU-FURIA.md).

**Goku — três especiais comuns:** Rajada de Ki (↓ →), Kamehameha (↓ ←) e Teletransporte (↓ ↓), todos com J/K/L, sem gastar Super. Há projéteis independentes, feixe com pulsos limitados, teletransporte validado, cancelamentos e laboratório com comandos reais. [Testar e inspecionar](http://localhost/jogo-luta/art/goku-specials.html), [PNG/JSON](http://localhost/jogo-luta/downloads/goku-specials.zip), [prévia real](http://localhost/jogo-luta/previews/goku-specials-gameplay.png), [comandos, arquivos e limites](GOKU-ESPECIAIS.md).

**Goku — normais e combate:** nove ataques físicos, combos em pé/agachados/aéreos, launcher com jump cancel, defesa, reações, queda/levantar, KO e agarrão universal. São 31 animações de combate, 126 quadros exportados e dados separados da movimentação aprovada. Disponível nos modos locais. [Laboratório e depuração](http://localhost/jogo-luta/art/goku-combat.html), [PNGs e dados](http://localhost/jogo-luta/downloads/goku-combat.zip), [prévia real](http://localhost/jogo-luta/previews/goku-combat-gameplay.png), [arquivos, comandos, testes e limitações](GOKU-COMBATE.md).

**Goku — movimentação reconstruída (revisão 5):** Idle, caminhadas, agachamento, saltos direcionais, dashes, transições e reações de apoio usam poses completas, sem morphing ou montagem de membros. São 33 animações e 98 desenhos distintos em 142 células. [Inspecionar e comparar no jogo](http://localhost/jogo-luta/art/goku.html?rebuild=5), [PNG/JSON e ampliações](http://localhost/jogo-luta/downloads/goku-movement.zip), [prévia real](http://localhost/jogo-luta/previews/goku-rebuild-gameplay.png), [diagnóstico, contagens, testes e limitações](art/goku/rebuild/REBUILD.md). Disponível no Treinamento; ainda há deslizamento residual na caminhada e variações de desenho a polir.

**Reações de Dio:** defesa, dano, queda, recuperação, entrada, provocação, vitória e dissipação independente do Stand. [Laboratório](http://localhost/jogo-luta/art/dio-secondary.html), [arquivos e verificação](DIO-SECUNDARIAS.md). T provoca.

**Road Roller:** Super de Dio, tecla R, duas barras e cinematografia somente após confirmar o primeiro soco. Voo, veículo, socos, explosão e retorno têm recursos próprios. [Laboratório](http://localhost/jogo-luta/art/road-roller.html), [arquivos, testes e limitações](ROAD-ROLLER.md).

**Especiais comuns de Dio:** facas J/K/L com projéteis independentes, Muda Muda de 4/7/10 contatos e Parada do Tempo de 120 ticks. Sem consumo de Super; recarga do Tempo cresce por uso e permanece entre rounds. [Laboratório](http://localhost/jogo-luta/art/dio-specials.html), [arquivos, comandos e limites](DIO-ESPECIAIS.md).

Auditoria visual/técnica e limitações reais do Samurai: [AUDITORIA-SAMURAI.md](AUDITORIA-SAMURAI.md). As correções preservam o Idle, atualizam poses e colisões e mantêm um backup verificável da arte anterior. O laboratório permite baixar P1/P2 e o pacote de PNGs auditados.

**Dio + The World — combate revisado:** todos os nove normais são executados exclusivamente pelo Stand. Dio usa poses de comando. Há combos terrestres, agachados e aéreos, launcher com jump cancel, dois contatos separados no Air Medium e retorno contínuo do Stand. `/art/dio-combat.html` executa e depura o combate real; `/art/dio.html` inspeciona desenhos individuais. Treinamento e Contra BOT permitem selecionar Samurai ou Dio como adversário. Propriedades, arquivos, testes e limites: [DIO-COMBATE.md](DIO-COMBATE.md).

A movimentação aprovada continua com 26 sheets e 178 desenhos, sem alterar os PNGs do Samurai. Reações e apresentações secundárias de Dio estão integradas; agarrão próprio de Dio permanece limitado; o online LAN agora inclui Dio e The World. Registro da movimentação: [DIO-MOVIMENTO.md](DIO-MOVIMENTO.md). Registro das bases: [DIO-BASES.md](DIO-BASES.md).

TypeScript, Canvas 2D e Vite. Samurai jogável em **Contra BOT, Arcade de três confrontos, Treinamento e Contra Amigo online**. Movimentação, nove normais, especiais, contra-ataque, Ultimate e reações próprias: **58 sequências dedicadas, 293 quadros e 42 quadros de efeitos separados**. As paletas vermelha/ciano exportadas são preservadas; Arcade acrescenta âmbar e violeta por troca exata de cores em memória. Os modos locais não precisam de servidor; Contra Amigo usa Node.js e Socket.IO.

## Executar

Requer Node.js 22 ou superior e npm.

```sh
npm install
npm run dev
```

Abra http://127.0.0.1:5173 e escolha um modo. Em Contra BOT, selecione Fácil, Normal ou Difícil. O Arcade usa dificuldade crescente automaticamente. Treinamento permite configurar o parceiro durante a prática. Samurai, Dio e Goku estão disponíveis nos modos locais e no online LAN. O botão **Animações** abre `/art/samurai.html`.

```sh
npm test
npm run build
npm run test:browser
npm run preview
```

Os testes de navegador usam o Chrome instalado. O build fica em `dist/` e inclui o laboratório. Sirva por HTTP. Para publicar no XAMPP, use `npm run build:lan`; os dois aliases servem o mesmo `dist`. Consulte [README_LAN.md](README_LAN.md).

## Modos e apresentação

Contra BOT disputa dois rounds para vencer. A IA aproxima, recua, defende, pula, tenta punir recuperações, agarra, confirma combos terrestres/aéreos, usa especiais e gasta energia. Sua percepção do adversário tem atraso de 26/17/10 ticks nas dificuldades Fácil/Normal/Difícil, além de intervalos de decisão e variação probabilística. Ela lê poses públicas passadas, sem consultar teclado ou buffer do jogador. Não existe defesa perfeita. As regras, perfis e limites estão em [PLAYABLE.md](PLAYABLE.md).

Arcade tem três confrontos completos de melhor de três rounds: Samurai Ciano/Fácil, Âmbar/Normal e Violeta/Difícil. Após vencer, use **Próximo confronto**; derrota permite repetir o adversário atual. Concluir a sequência abre a vitória do Arcade. Reiniciar combate restaura o confronto atual; jogar novamente após a conclusão começa a rota do início. O progresso existe apenas na sessão aberta.

Treinamento tem vida infinita opcional para ambos, energia infinita independente, cronômetro parado e parceiro parado, defendendo em pé/agachado, pulando ou controlado por BOT. Mostra último dano, dano de combo, maior dano, maior combo, dano total e estados dos dois lutadores. Desativar vida infinita permite KO, seguido de restauração automática. Zerar medidores não reposiciona os lutadores; Reiniciar restaura o treino e mantém suas opções.

Há barras de vida com animação e rastro de dano, energia, rounds, anúncios de início/KO, feedback de combo/dano, efeitos pixelados e transições de menu. Sons originais são sintetizados por Web Audio, com volume e mute. O áudio é desbloqueado após uma interação; a ausência de áudio não impede jogar. Não há música nem vozes.

## Contra Amigo online

Na instalação final, execute Apache e `iniciar-multiplayer.bat`, abrindo `http://localhost/jogo-luta/`. O backend escuta apenas em 127.0.0.1:3001 e o Apache encaminha HTTP/WebSocket pela mesma origem dos jogadores. Amigos usam o IP local do servidor. Não há necessidade de abrir a porta interna no navegador.

Crie/entre pelo código, escolha Samurai, Dio ou Goku, confirme o personagem e marque pronto. O anfitrião inicia quando ambos estiverem prontos. O servidor executa o combate a 60 Hz, publica inputs numerados e hashes, controla dano e resultado e permite recuperação por checkpoint e revanche. [Instruções LAN, testes e limitações](README_LAN.md); [arquitetura do netcode](ONLINE.md). `npm run test:lan` testa o build por Apache com dois Chromes independentes.

## Controles

- **A/D**: andar. **W**: pular. **S**: agachar.
- **J/K/L**: ataques leve/médio/forte, em pé, agachado ou no ar.
- **Shift + direção**: dash frontal ou backdash. Pressione Shift com a direção segurada.
- Segure para trás para defender; adicione S contra baixos. Aéreos exigem defesa em pé. Não há defesa aérea.
- **U**: agarrão próximo em solo. Ignora defesa; não agarra no ar, em stun ou durante levantamento.
- **↓ ↘ → + J/K/L**: Saque Relâmpago leve/médio/forte.
- **↓ ↙ ← + J/K/L**: Postura de Contra-ataque.
- **→ ↓ ↘ + J/K/L**: Corte Crescente leve/médio/forte, anti-aéreo.
- **R**: Mil Cortes, requer e consome **100 de energia**. **T**: provocar.
- **Esc**: pausa. Perder o foco também pausa. **Caixas** mostra a depuração.

O teclado preserva direção e agachamento do instante em que o ataque é pressionado, mesmo se a tecla for solta antes do próximo tick. Pressionar pulo repetidamente não reinicia sua preparação. Campos de configuração não enviam comandos ao combate.

As setas são relativas ao lado para o qual Samurai olha. À direita, faça o saque segurando S, adicionando D, soltando S e apertando o ataque. O contra usa A no lugar de D. Corte Crescente: D, S, S+D e ataque. Cada direção deve existir por pelo menos um tick. A janela total é 24 ticks; a direção final aceita seis ticks de tolerância. O buffer de botões dura oito ticks. O relógio de comandos congela no hitstop.

Leve → médio → forte cancela após contato, inclusive na defesa. Normais terrestres cancelam em especial/Ultimate. **S+L → W → J → K → L** lança, persegue e finaliza no ar; o salto de cancelamento avança brevemente para alcançar o alvo. Stand Heavy é horizontal. Air Heavy derruba, seguido de queda, derrubado e levantamento protegido. O dano diminui durante combos. A energia cresce com acertos e dano recebido e persiste entre rounds.

## Especiais e Ultimate

Saque leve tem preparação curta e menos avanço; forte alcança mais longe, causa mais dano e deixa mais recuperação. Crescente leve tem proteção parcial e curta na parte superior; médio/forte têm proteção inicial completa, maior salto e recuperação longa. São puníveis ao errar ou na recuperação. Especiais comuns não gastam a energia reservada para Mil Cortes.

O contra tem seis ticks de entrada, 18 de espera e 24 de recuperação sem ativação. Responde a cortes frontais médios/altos na espera, cancela o ataque recebido e executa seu corte. Perde para baixos, agarrões, ataques pelas costas e Ultimate.

Mil Cortes gasta energia na ativação, mesmo ao errar ou ser defendido. Só um acerto inicia a captura: golpe inicial, oito cortes e finalizador, com zoom inteiro de 2×, efeitos e hitstop. O cronômetro para durante a captura; ambos ficam presos à sequência e entradas são descartadas. Sem combo prévio: dez impactos e 299 de dano. A derrota é resolvida ao fim da sequência, seguida de vitória/KO. O alvo sobrevivente retorna por queda e levantamento.

## Laboratório

Escolha as 58 animações, pause, avance/volte quadro, amplie de 1× a 4×, espelhe, troque paleta e veja pivô, chão e caixas. Os testes executam o motor real com entradas programadas e adversário de teste: movimentos, normais, combos, seis especiais ofensivos, contra com sucesso/falha/baixo/agarrão, Ultimate acertando/defendido/errando, agarrão, defesas, entrada, provocação, vitória e derrota. A energia é preenchida automaticamente apenas nesses testes de Ultimate.

Vermelho = lâmina ativa; verde = áreas que recebem dano; azul = corpo que empurra; amarelo = lâmina inativa dos golpes. Reações usam a mesma seleção de pose para desenho e hurtboxes. Efeitos podem ser ocultados para inspecionar o personagem.

Marque **Ver testes na arena** para reproduzir uma sequência com a câmera, o HUD e a renderização da partida, incluindo o close de Mil Cortes. Desmarque para voltar à inspeção ampliada.

## Estrutura

```text
public/sprites/samurai/    PNGs P1/P2, células, manifestos e prévias
public/sprites/fx/         atlas separado de efeitos pixelados
art/samurai.html           laboratório, segunda entrada Vite
art/samurai/               base aprovada, camadas, rigs, locks e documentação
scripts/                  pipeline Python/Pillow/numpy reproduzível
src/
  data/samurai.json        atributos, golpes e caixas por pose
  data/animations.json     spritesheets, pivôs, durações e loops
  data/cinematics.json     tempos da captura, agarrão e contra
  data/fx.json             células dos efeitos
  data/bot-profiles.json   tempos de reação e probabilidades da IA
  data/arcade.json         ordem, cores, dificuldade e sementes do Arcade
  data/palettes.json       rampas de cores alternativas
  engine/
    input.ts / types.ts    teclado, comandos, buffers e contratos
    combat.ts             física, dano, cancelamentos, capturas e rounds
    lifecycle.ts          seleção das reações e suas caixas
    geometry.ts / moves.ts colisões, fases e poses dos golpes
    bot.ts / loop.ts       BOT com três dificuldades e atualização a 60 Hz
    stats.ts               eventos de dano e medidas de combo
  game/
    app.ts                 fluxo de telas, pausa e carregamento
    session.ts             progressão Arcade e sessões por modo
    training.ts            regras e parceiro de treinamento
  ui/screens.ts            seleção, menus e resultados
  audio/sound.ts           efeitos originais sintetizados
  render/
    animator.ts            relógio visual independente do combate
    presentation.ts        seleção e sincronização de animações
    renderer.ts            arena, câmera, HUD e lutadores
    effects.ts / debug.ts  efeitos e caixas compartilhados
    hud.ts / palette.ts    barras animadas e troca exata de paletas
  art-lab.ts               inspeção e cenários de teste
  main.ts / style.css      telas, partida e pausa
tests/                     regras, transições e arquivos PNG
e2e/                       testes de execução no Chrome
```

## Arte e geração

Idle, movimentação e nove normais aprovados são preservados byte a byte por hashes. O novo pacote acrescenta 36 sequências e 203 quadros usando o mesmo rig, camadas originais, rosto preservado, membros articulados, katana e retoques de bainha, pano e costas. Células 256×256, pivô (128,224), alpha binário e nearest-neighbor. [Prévia ampliada](public/sprites/samurai/complete-preview.png).

```sh
npm run art:movement
npm run art:attacks
npm run art:complete
```

Gerar arte exige Python com `requirements-art.txt`; o lançador também encontra o Python incluído no ambiente Codex. Depois de reconstruir normais, execute `art:complete` para reaplicar agarrão, especiais e reações. Rodar e compilar o jogo não exige Python.

Os novos quadros usam recortes articulados da base e correções específicas. Preservam a identidade e são assets reais, mas torções extremas, a virada de costas e a passagem ao chão ainda têm rigidez desse método; não equivalem a perspectivas redesenhadas à mão. Veja [COMPLETE.md](art/samurai/COMPLETE.md), [ATTACKS.md](art/samurai/ATTACKS.md), [MOVEMENT.md](art/samurai/MOVEMENT.md) e [README da arte](art/samurai/README.md).

## Escopo e limites

Funcionam: Contra BOT com três dificuldades, Arcade completo de teste, treinamento configurável, arena 1280×720, combate fixo a 60 Hz, locomoção, normais, seis especiais ofensivos, contra, Ultimate, defesa, agarrão, combos, vida, energia, cronômetro, rounds, empate, reinício, vitória/derrota, pausa, áudio e menus. O BOT é heurístico; diversão e balanceamento ainda precisam de playtests humanos prolongados.

Contra Amigo tem salas privadas online, duas vagas, seleção/pronto, comandos por tick, autoridade do servidor, retomada e revanche. Consulte [ONLINE.md](ONLINE.md) para executar cliente/servidor e conhecer a sincronização. Não há matchmaking público nem rollback. Controladores entregam `InputFrame`; `Match` recebe dados de personagem. Novos personagens ainda precisam de catálogo e seleção. Não há gamepad/touch, remapeamento, gravação de inputs, replays nem persistência de progresso. Escala fracionária da janela pode dar tamanhos diferentes aos pixels, embora o desenho interno não tenha suavização.
