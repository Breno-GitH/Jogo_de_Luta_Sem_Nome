# Sasuke Uchiha · Hebi

A etapa adiciona Sasuke Hebi ao treinamento, ao versus, à seleção do Arcade e ao LAN. O Arcade conserva os três confrontos. Sasuke combina taijutsu curto, chutes de alcance médio e a Kusanagi nos ataques fortes. A altura visível da pose neutra é de 128 px.

## Controles

- **J / K / L** usam os três normais em pé. Segure **S** para os normais baixos e use os mesmos botões durante o salto.
- **J → K → L** encadeia em pé. **S + J → S + K → S + L** encadeia agachado.
- Acerte **S + L** para lançar e pressione **W** durante a janela de cancelamento. No ar, **J → K → L** termina com o corte descendente e derruba o alvo.
- Segure a direção oposta ao adversário para defender. Segure **S** junto dela para a guarda baixa.

A Marca da Maldição nível 2 e o Kirin estão disponíveis.

## Arte e integração

- [Base](public/sprites/sasuke/base.png), [movimentação](public/sprites/sasuke/movement.png), [normais](public/sprites/sasuke/normals.png) e [reações](public/sprites/sasuke/reactions.png) usam células transparentes de 256 px, pivô comum e espelhamento do renderizador.
- Os 45 desenhos de movimento seguem as contagens pedidas. Os nove normais têm quatro cels cada, com duração definida em ticks.
- [Configuração do lutador](src/data/sasuke.json), [tempos e atributos dos normais](src/data/sasuke-normals.json), [tempos de locomoção](src/data/sasuke-clips.json) e [caixas e contatos por cel](src/data/sasuke-frames.json).
- [Integração de combate](src/engine/sasuke-data.ts), [apresentação](src/render/sasuke-presentation.ts) e [brilho da lâmina](src/render/sasuke-fx.ts). A Kusanagi é desenhada nas poses e o brilho é uma camada separada.
- [Pranchas e prompts](art/sasuke-hebi-source/PROMPTS.md) foram produzidos com o ImageGen integrado. Regere a exportação com `node scripts/run_art.mjs scripts/pack_sasuke_hebi.py`.

[Abra o laboratório](http://localhost/2025/Jogo_de_Luta_Sem_Nome/art/sasuke.html) para tocar os movimentos e combos, espelhar a luta, pausar por tick ou mostrar as caixas.

## Arquivos de integração e validação

O registro usa [characters.ts](src/engine/characters.ts) e [protocol.ts](src/net/protocol.ts). A seleção, as telas e o Arcade usam [catalog.ts](src/ui/catalog.ts), [screens.ts](src/ui/screens.ts), [app.ts](src/game/app.ts), [session.ts](src/game/session.ts) e [style.css](src/style.css). [presentation.ts](src/render/presentation.ts) e [renderer.ts](src/render/renderer.ts) escolhem o atlas e desenham a lâmina. [vite.config.mjs](vite.config.mjs) registra a página do laboratório e [net_version.mjs](scripts/net_version.mjs) inclui os dados na versão da simulação.

A cobertura nova está em [combate e movimento](tests/sasuke.test.ts), [atlas e pontos de contato](tests/test_sasuke_hebi_art.py), [navegador](e2e/sasuke.pw.mjs) e [LAN](e2e/lan/game.pw.ts).

## Etapa 2 — Especiais

Os comandos são terrestres e usam direções relativas à orientação de Sasuke. A segunda pressionada de baixo exige uma soltura entre os toques. A lista de golpes do jogo acompanha o remapeamento de teclas.

- **↓ → + J/K/L** executa Chidori Senbon (três agulhas), Chidori Eisō (lança de alcance crescente) ou Chidori (avanço com descarga na mão).
- **↓ ← + J/K/L** executa Katon: Gōkakyū (bola de fogo), Hōsenka (três trajetórias) ou Gōryūka (dragão de fogo ondulante).
- **↓ ↓ + J/K** executa Serpentes ou Chidori Nagashi. As serpentes prendem brevemente por hitstun com baixo empurrão. Nagashi é vulnerável e deixa tempo para encaixar um normal no acerto próximo.
- **↓ ↓ + L** ativa a Marca da Maldição nível 2 a partir de um estado neutro em solo.
- Normais terrestres cancelam em especial na janela configurada após confirmação de acerto. Projéteis já lançados seguem sua trajetória. A interrupção da preparação impede novas emissões e elimina o contato corpo a corpo.

Gōryūka forma nuvens temporárias na arena quando o dragão é lançado. O efeito usa o relógio da simulação e é sincronizado no multiplayer. O sistema de tempestade do Kirin usa a intensidade acumulada durante o combate.

### Arte e código

- [Pranchas de origem](art/sasuke-special-source/PROMPTS.md), [atlas corporal](public/sprites/sasuke/specials.png), [atlas de efeitos](public/sprites/sasuke/special-effects.png) e [folha de poses](public/sprites/sasuke/specials-contact.png). São 32 desenhos corporais e 12 cels de efeitos em atlas. Os arcos elétricos são desenhados em pixels pelo renderizador.
- [Balanceamento](src/data/sasuke-specials.json), [âncoras e caixas](src/data/sasuke-special-frames.json), [definições de combate](src/engine/sasuke-specials.ts) e [efeitos](src/render/sasuke-special-fx.ts).
- Execute `node scripts/run_art.mjs scripts/pack_sasuke_specials.py` para exportar os atlas. Use `node scripts/capture_sasuke_specials.mjs` e `node scripts/run_art.mjs scripts/compose_sasuke_specials.py` com o Apache atualizado para recriar a [prévia animada](deployment/audit/sasuke-specials/especiais-em-combate.webp).
- Abra o [laboratório do jogo](http://localhost/2025/Jogo_de_Luta_Sem_Nome/art/sasuke.html) e escolha a técnica. Os controles permitem espelhar, pausar, avançar um tick e mostrar as caixas.

### Validação

- [Testes de combate](tests/sasuke-specials.test.ts) cobrem os oito especiais contra Samurai, Dio, Goku e Luffy dos dois lados. Também cobrem guarda, interrupção, emissão única de cada projétil, reserva do comando, cancelamento, pressão de curta distância e determinismo do dragão e das nuvens.
- [Validação dos atlas](tests/test_sasuke_special_art.py) confere desenho único, alfa binário, margens, pivô e âncoras.
- [Testes de navegador](e2e/sasuke.pw.mjs) conferem animação e dano no laboratório e o acesso ao Sasuke pelo treinamento. [Testes LAN](e2e/lan/game.pw.ts) usam dois clientes no mesmo computador atrás do Apache.

## Etapa 3 — Marca da Maldição nível 2

Pressione **↓ ↓ + L** em solo, soltando baixo entre os toques. A transformação exige uma abertura vulnerável e usa um relógio separado da barra de Super. A forma fica ativa por **13 segundos efetivos de combate**. A recarga de **18 segundos** começa após o retorno, ou após uma interrupção do despertar. O relógio não avança durante hitstop, congelamento do lutador, cinematografias ou pausa. O estado da Marca é reiniciado a cada round.

A forma altera os nove normais, oito especiais e as poses de movimento. O multiplicador de dano é **1,15** e o de movimento horizontal é **1,10**. Raiton ganha eletricidade escura, Senbon dispara quatro agulhas, Eisō tem mais alcance, Hōsenka abre quatro trajetórias e Nagashi cobre uma área maior com recuperação vulnerável. Use **Shift** no ar para um avanço com as asas por salto. A expiração permite que o golpe em curso termine antes da reversão. As asas são parte da arte, enquanto o corpo mantém as hurtboxes de combate.

O novo atlas usa **81 desenhos**, margem de segurança e pivô comum. O torso fica descoberto, a corda roxa e as sandálias continuam visíveis e o tecido claro fica abaixo da cintura. As duas palmas enormes têm volumes taupe e cinza, cristas grossas, dobras, pontas irregulares e contorno assimétrico. O rascunho anterior só entra na comparação.

- [Comparação visual](public/sprites/sasuke/curse-comparison.png) e [atlas](public/sprites/sasuke/curse.png).
- [Pranchas e instruções de origem](art/sasuke-curse-v2-source/PROMPTS.md). Use `node scripts/run_art.mjs scripts/pack_sasuke_curse.py` para exportar.
- [Balanceamento](src/data/sasuke-curse.json), [controlador](src/engine/sasuke-curse.ts), [caixas e âncoras](src/data/sasuke-curse-frames.json) e [efeitos e HUD](src/render/sasuke-curse-fx.ts).
- [Laboratório no Apache](http://localhost/2025/Jogo_de_Luta_Sem_Nome/art/sasuke.html) com transformação, locomoção, ataques, avanço aéreo e reversão quadro a quadro.
- [Testes de simulação](tests/sasuke-curse.test.ts), [testes do atlas](tests/test_sasuke_curse_art.py), [navegador](e2e/sasuke.pw.mjs) e [multiplayer](e2e/lan/game.pw.ts).

A [prévia animada](deployment/audit/sasuke-curse/marca-ii-em-combate.webp) foi capturada na build do Apache. A publicação preservou os 3.872 PNGs anteriores byte a byte. Os testes LAN rodaram com dois clientes independentes no mesmo computador.

## Etapa 4 — Kirin

**R** gasta uma barra completa e tenta uma palma de curto alcance. Acerto confirmado inicia a cena, inclusive após um normal cancelável. Erro, esquiva ou interrupção deixam a recuperação regular. A guarda comum não bloqueia o contato. O ataque é acessível na forma base e na Marca da Maldição nível 2.

Os três Katon acumulam nuvens quando o primeiro projétil é emitido. Gōryūka contribui mais para a atmosfera. A intensidade altera o início da cinematografia e a barra cheia basta para tentar a Super. A cena compartilha confirmação, poses do adversário, cronômetro, hitstop, dano escalonado, knockdown e KO com as Supers encenadas do motor. A Marca conserva seus ticks durante a cena e conclui uma reversão pendente após a liberação.

- [Configuração](src/data/sasuke-kirin.json), [linha do tempo](src/engine/sasuke-kirin.ts), [efeitos](src/render/sasuke-kirin-fx.ts) e [empacotamento](scripts/pack_sasuke_kirin.py).
- [Pranchas de origem e prompts](art/sasuke-kirin-source/PROMPTS.md), [poses base](public/sprites/sasuke/kirin-base.png), [poses da Marca II](public/sprites/sasuke/kirin-curse.png) e [folha de efeitos](public/sprites/sasuke/kirin-effects-contact.png).
- [Laboratório no Apache](http://localhost/2025/Jogo_de_Luta_Sem_Nome/art/sasuke.html) com câmera lenta, espelhamento e avanço por tick. [Cinematografia gravada](deployment/audit/sasuke-kirin/kirin-cinematografia.webp).
- [Testes do motor](tests/sasuke-kirin.test.ts), [testes gráficos](tests/test_sasuke_kirin_art.py), [teste no navegador](e2e/sasuke.pw.mjs) e [teste LAN](e2e/lan/game.pw.ts).

## Polimento dos especiais e do Kirin

- **Gōryūka (↓ ← + L)**. Cabeça animada, corpo e cauda seguem a mesma senoide. O percurso completo busca cinco ondas. Perto do canto, o comprimento mínimo de cada onda reduz a contagem conforme o espaço disponível. O dragão causa um único contato por lançamento e continua até que a cauda saia. O laboratório permite observar o percurso inteiro e espelhá-lo.
- **Chidori (↓ → + L)**. Seis poses próprias por forma sincronizam a carga na palma e a investida. A colisão acompanha a mão também entre ticks. O acerto produz um breve enquadramento fechado e um clarão. A guarda comum continua funcionando e o erro compromete a recuperação.
- **Chidori Nagashi (↓ ↓ + K)**. Seis ramos elétricos abrem em torno de Sasuke. Na extensão máxima, as cápsulas chegam a 129 px por lado na forma base e 149 px na Marca II. Os mesmos ramos orientam os efeitos e a área ativa. A dissipação é visual.
- **Supers (R)**. A confirmação ignora a guarda comum para todo o elenco. Hitbox, alcance e invulnerabilidade continuam determinando o contato. Por exemplo, a abertura do Road Roller passa acima do Samurai já agachado, mas confirma contra Sasuke agachado quando o punho toca sua hurtbox.
- **Kirin**. A forma no momento de pressionar R seleciona a variante de toda a cena. O Kirin azul usa seu núcleo branco-azulado. O Kirin negro tem desenho próprio, relâmpagos violetas e novos cels de nuvens e impacto. A cena recebeu abertura das nuvens, enquadramento de revelação, mergulho acelerado, trovão, pausa no impacto, poeira e ondas no chão. As duas variantes mantêm 320 de dano sem escalonamento e pausam o relógio da Marca durante a cena.

### Arquivos e prévias

- [Parâmetros](src/data/sasuke-polish.json), [geometria de combate](src/engine/sasuke-polish.ts), [resolução de impacto](src/engine/combat.ts), [regra central de Super](src/engine/moves.ts), [estado sincronizado](src/engine/state.ts) e [câmera do Kirin](src/engine/sasuke-kirin.ts).
- [Chidori base](public/sprites/sasuke/chidori-dash.png), [Chidori Marca II](public/sprites/sasuke/chidori-dash-curse.png), [cabeças de fogo](public/sprites/sasuke/goryuka-heads.png), [Kirin negro](public/sprites/sasuke/kirin-dragon-black.png) e [tempestade violeta](public/sprites/sasuke/kirin-sky-black.png). [Fontes e prompts](art/sasuke-polish-source/PROMPTS.md). Para exportar novamente, execute `node scripts/run_art.mjs scripts/pack_sasuke_polish.py`.
- [Efeitos dos especiais](src/render/sasuke-special-fx.ts), [efeitos do Kirin](src/render/sasuke-kirin-fx.ts) e [áudio](src/audio/sound.ts).
- [Laboratório no XAMPP](http://localhost/2025/Jogo_de_Luta_Sem_Nome/art/sasuke.html) e capturas da simulação [Gōryūka](deployment/audit/sasuke-polish/goryuka/animacao.webp), [Chidori](deployment/audit/sasuke-polish/chidori/animacao.webp), [Nagashi](deployment/audit/sasuke-polish/nagashi/animacao.webp), [Kirin azul](deployment/audit/sasuke-polish/kirin-azul/animacao.webp) e [Kirin negro](deployment/audit/sasuke-polish/kirin-negro/animacao.webp).
- [Testes dos especiais](tests/sasuke-polish.test.ts), [guarda e esquiva das cinco Supers](tests/super-guard.test.ts), [Kirin](tests/sasuke-kirin.test.ts), [atlas](tests/test_sasuke_kirin_art.py), [Chrome no Apache](e2e/sasuke.pw.mjs) e [clientes LAN](e2e/lan/game.pw.ts).

## Etapa 5 — Integração final

Sasuke permanece no elenco de Arcade Torre, Versus BOT, Treinamento e Multiplayer LAN. A seleção ganhou uma prévia animada de Idle, com retrato estático quando o navegador indica preferência por movimento reduzido. Os comandos acompanham o lutador selecionado, inclusive no lobby.

**U** inicia o agarrão de pulso. As formas Hebi e Marca II usam seis desenhos próprios cada, com a caixa de captura calibrada na palma. O arremesso exige contato com um adversário em solo, vence a guarda em pé e termina em knockdown. A tentativa deixa uma abertura ao errar. As duas formas causam 105 de dano no arremesso universal. O bônus de 15% continua nos normais e especiais transformados. **T** usa a provocação da forma atual em solo. Ela pode ser interrompida por dano.

A IA continua usando entradas normais do jogo e percepção atrasada. Alterna técnicas conforme a distância, defende e tenta punir a recuperação. Usa Katon para controlar espaço, Raiton e serpentes para pressão ou confirmação e o avanço com asas para perseguir. O despertar pede espaço para cobrir a vulnerabilidade da preparação. Kirin é priorizado em acertos confirmados ou aberturas observadas com barra cheia.

A revisão manteve os tempos de **13 s** de combate efetivo e **18 s** de recarga. O avanço com asas continua limitado a um por salto. Kirin custa **100 de energia**, requer confirmação e causa até **320 de dano bruto**. A variante escolhida na ativação e o relógio da Marca são preservados durante a cena.

### Arte e prévias

- [Prévia animada base](public/sprites/sasuke/menu-idle.webp), [Marca II](public/previews/sasuke-final/marca-ii.webp), [Kirin azul](public/previews/sasuke-final/kirin-azul.webp) e [Kirin negro](public/previews/sasuke-final/kirin-negro.webp).
- [Agarrão Hebi em combate](public/previews/sasuke-final/agarrao-hebi.webp), [agarrão da Marca II](public/previews/sasuke-final/agarrao-marca-ii.webp) e [provocação](public/previews/sasuke-final/provocacao.webp).
- [Atlas Hebi do agarrão](public/sprites/sasuke/throw-base.png), [atlas da Marca II](public/sprites/sasuke/throw-curse.png) e [fontes e prompts do ImageGen](art/sasuke-final-source/PROMPTS.md). Para reproduzir os atlas e a prévia do seletor, execute `node scripts/run_art.mjs scripts/pack_sasuke_throw.py`.
- [Laboratório no XAMPP](http://localhost/2025/Jogo_de_Luta_Sem_Nome/art/sasuke.html) com ensaios de agarrão, provocação e vitória.

- A provocação de **T** recebeu três novas poses em cada forma, com um gesto de desafio visível. [Atlas Hebi](public/sprites/sasuke/taunt-hebi.png), [atlas Marca II](public/sprites/sasuke/taunt-marca.png) e [prévia da Marca II](public/previews/sasuke-final/provocacao-marca-ii.webp).

### Arquivos de integração

- [Agarrão e trilha da vítima](src/engine/sasuke-grab.ts), [colisão medida](src/data/sasuke-throw-boxes.json), [dados do lutador](src/engine/sasuke-data.ts) e [seletor de movimentos da Marca](src/engine/sasuke-curse.ts).
- [IA](src/engine/bot.ts), [clipes de animação](src/render/sasuke-animations.ts), [renderização](src/render/renderer.ts), [catálogo](src/ui/catalog.ts), [telas](src/game/app.ts) e [assinatura da simulação LAN](scripts/net_version.mjs).
- [Laboratório](art/sasuke.html), [ensaios reproduzíveis](src/sasuke-lab.ts) e [captura de prévias](scripts/capture_sasuke_kirin.mjs).
- [Testes de integração](tests/sasuke-final.test.ts), [atlas](tests/test_sasuke_hebi_art.py), [Chrome](e2e/sasuke.pw.mjs) e [LAN](e2e/lan/game.pw.ts).

### Validação

A simulação passou em 892 testes. A suíte de arte de Sasuke passou em nove testes, incluindo a transparência, o contato na mão e os desenhos únicos do agarrão. As técnicas foram exercitadas nas duas formas, com verificações de dano, cancelamento, relógio efetivo da Marca, recarga e Kirin. O agarrão foi testado contra Samurai, Dio, Goku, Luffy e Sasuke.

Os oito testes de navegador passaram no build publicado. A provocação por T foi verificada em uma partida iniciada pelo menu de Treinamento nas duas formas.

Os seis testes LAN passaram em dois processos independentes do Chrome no mesmo computador. Eles cobriram especiais, transformação e expiração, Kirin azul e negro, U e T pelo teclado, KO, mudança de round, revanche e troca de personagem. O teste com dois computadores físicos permanece pendente.

A publicação foi feita pelo fluxo existente do XAMPP. Apache e backend usam a versão de simulação `ec85b4b76ac4ec7f4e89eb29`.
