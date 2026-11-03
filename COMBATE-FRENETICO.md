# Combate mais rápido — revisão de ritmo

Esta revisão usa o mesmo motor, personagens e recursos. Nenhum PNG aprovado foi redesenhado ou substituído. Os modos locais e as salas por Apache continuam usando a mesma simulação de 60 Hz.

## Controles atuais

**R é a única tecla de Super, para todos os personagens.** Samurai: Mil Cortes, custo configurado de 100. Dio: Road Roller, 200 (duas barras). Goku: Fúria Saiyajin, 100 da barra especial, com ganho lento de energia preservado. O antigo comando direcional de Super do Goku foi removido; ↓ → ↓ → + L não ativa uma Super. O último quarto de círculo ainda pode ser reconhecido como Rajada de Ki forte, um especial comum.

O teclado registra a borda de pressionamento de R, ignora repetição/keydown duplicado e consome uma tentativa por comando. Estados de dano, agarrão, KO, falta de energia e outra cinematografia impedem a ativação. As Supers mantêm alcance, colisão inicial, recuperação ao errar/defender, custo e sequência confirmada. SSJ1 continua exclusivo da cinematografia; não há modo transformado jogável.

J/K/L continuam sendo normais. Goku mantém Ki ↓ →, Kamehameha ↓ ← e Teletransporte ↓ ↓ + J/K/L. Samurai e Dio mantêm seus comandos de especiais. Especiais comuns não gastam Super.

## Mobilidade e timings

Os valores ficam em `src/data/combat-pace.json`, aplicados por `src/engine/pace.ts`, sem sobrescrever os dados/PNGs originais.

- Samurai: caminhada 6,6 px/tick; recuo 5,8; salto com 3 ticks de preparação; aterrissagem 4. Dashes aumentados em 12%.
- Dio: caminhada 3,2; recuo 2,6; preparação 4; aterrissagem 5. Dashes aumentados em 16%. Mantém a caminhada mais deliberada e os ataques normais exclusivos de The World.
- Goku: caminhada 7,2; recuo 6,1; velocidade aérea 7,6; preparação 3; aterrissagem 4. Dashes aumentados em 10%.

Startups dos normais foram reduzidos individualmente em até três ticks e recuperações em até quatro. Frames ativos e desenhos de contato são preservados. O relógio de apresentação é mapeado por preparação/ativo/recuperação: hurtboxes, lâmina/punho/pé e sprites consultam a mesma fase original. O Stand usa esse relógio também na aproximação, soco e retorno. Caminhadas continuam acompanhando a distância percorrida; as fases de salto acompanham a física. Não há morphing ou deformação dos sprites.

## Rotas e defesa

J → K → L → especial funciona para os três personagens. Posturas em pé/agachadas podem se conectar pelos botões correspondentes, incluindo médio → launcher. Jump cancel após launcher continua permitindo J → K → L no ar. Não há retorno obrigatório ao Idle entre cancelamentos válidos.

No acerto, o cancelamento alcança parte da recuperação. Um **médio → leve** adicional é permitido uma vez por combo terrestre confirmado; depois é necessário progredir para médio/forte/especial ou encerrar. Esse recurso não reinicia até o adversário sair do combo e o atacante deixar seu ataque. Na defesa, a janela é menor, o retorno para leve é proibido e fortes defendidos não cancelam livremente em especial/Super. Erros não abrem cancelamentos.

A perseguição após launcher regula o avanço para manter aproximadamente 64 px de separação, evitando atravessar o alvo. O impulso vertical do jump cancel considera a altura e a velocidade atuais do alvo, com teto de 30 px/tick; o salto comum não recebe esse impulso. Se não houver continuação, o impulso extra termina de forma limitada. Os acertos aéreos do Goku alinham sua velocidade de sustentação à do lançamento, para que a espera por inputs não separe artificialmente os corpos. Tudo está configurável no mesmo arquivo.

R pode finalizar um normal confirmado compatível. Para o Goku, um cancelamento confirmado em Fúria mantém o hitstun do alvo durante sua transformação inicial, permitindo o encadeamento. Isso só ocorre a partir de um normal realmente conectado; a ativação em neutro continua vulnerável e o primeiro soco ainda precisa colidir. Não há captura automática a distância.

## Teletransporte aéreo do Goku

O comando permanece **↓ ↓ + J/K/L**, com soltura entre os dois baixos. Também funciona durante hitstop, usando a ordem das amostras de input para distinguir duas bordas reais.

- **J:** avanço aéreo curto de 130 px. Startup 5, desaparecimento 3, recuperação 6 ticks.
- **K:** reaparece atrás do alvo quando ele está no alcance configurado, mantendo posição aérea válida. Startup 6, desaparecimento 4, recuperação 8.
- **L:** persegue um adversário vivo, no ar, em hitstun de combo e não derrubado, até 460 px. Startup 5, desaparecimento 3, recuperação 3. Sem alvo válido, não há avanço ofensivo arbitrário.

Usa os desenhos aéreos próprios já existentes em `public/sprites/goku/specials/teleport_air.png`, com tempos adaptados por fase e efeitos separados. As versões terrestres são preservadas. As variantes aéreas são dados independentes com alias visual para esses desenhos, não uma pose terrestre suspensa.

Há **um uso por salto/combo**. O uso só é restaurado depois de aterrissar, recuperar Idle/Walk/Crouch e o combo anterior terminar. Dano, agarrão e KO não permitem utilizar o recurso. A chegada respeita os limites 40–1240, separação física e uma altura aérea válida. Na perseguição, Goku acompanha a velocidade vertical do alvo; isso evita que o alvo caia para fora da altura dos próximos socos durante a curta recuperação. Se o alvo se tornar inválido durante a preparação, não é criada uma posição ofensiva alternativa.

Rota verificada: **S+L → W → J → K → ↓ ↓ + L → J → K → L**, seis acertos contínuos e finalização em queda. O teletransporte não é um hit extra.

## Limites e feedback

O limite global inicial é 22 acertos, 14 aéreos ou 480 ticks ativos de combo. Ao atingir o limite, o alvo entra em knockdown e deixa de aceitar colisões da sequência. Golpes com limites próprios, como sequências de socos, continuam respeitando-os. O dano diminui 7,5 pontos percentuais por acerto até um piso de 20%; knockback cresce após o décimo acerto. São parâmetros de balanceamento, não uma promessa de equilíbrio competitivo definitivo.

Leves têm hitstop de 4 ticks, médios 6 e fortes 9. Sparks usam tamanhos inteiros de pixel e durações proporcionais; fortes têm tremor discreto de até 3 px por seis ticks. Dash/perseguição recebem até duas imagens de rastro com baixa opacidade. Os efeitos podem ser desligados e não alteram colisões, posições ou inputs.

## Inspeção e execução

Inicie Apache e `iniciar-multiplayer.bat`; abra [o jogo](http://localhost/jogo-luta/). Para atualizar após editar configurações/código: pare o backend, execute `atualizar-xampp.bat`, reinicie o backend e atualize os navegadores. [Instruções completas do XAMPP/LAN](README_LAN.md).

No [laboratório de especiais do Goku](http://localhost/jogo-luta/art/goku-specials.html), escolha os novos cenários de teletransporte aéreo J/K e o combo com perseguição. Há velocidade normal/lenta, pausa, avanço por tick, caixas, pivô e espelhamento. O Treinamento continua oferecendo parceiro parado/defendendo/BOT, vida/energia infinitas e medidores de dano. Os laboratórios anteriores continuam disponíveis.

## Verificação e limites

**Resultado final:** TypeScript e build de produção aprovados; **527 testes de lógica, 123 de arte e 16 cenários de navegador** passaram. Os 12 cenários Apache incluem salas, trio de personagens/Supers em R, confronto entre personagens diferentes, combo aéreo de seis acertos por teclado entre dois clientes, teletransporte J/K/L nos dois sentidos, laboratório, rounds, revanche, atualização da página, desconexão e reinício do backend. Os quatro cenários de produção adicionais inspecionam toda a movimentação, normais/agarrão, especiais e Fúria Saiyajin do Goku. **3.915 recursos de sprites permaneceram idênticos.** Registro verificável: `deployment/audit/frenzy-result.json`. Capturas atuais dos dois clientes: `deployment/audit/lan/goku-air-chase-p1.png` e `goku-air-chase-p2.png`.

A interrupção real do Apache foi testada durante a migração anterior e recuperou a partida. O cenário opcional de parada manual do Apache foi deliberadamente pulado na suíte final de combate, que preserva a configuração do proxy.

Os testes de unidade exercitam nove normais por personagem, rotas, especiais, defesa, dano, limites, agarrões, cinematografias, espelhamento e restauração determinística. Os testes novos em `tests/frenzy.test.ts` cobrem R/custos/estados, cancelamentos para Super, reverse beat limitado, J → K → L → especial, comando durante hitstop, os três teletransportes aéreos, alvo inválido e o combo de seis acertos nos dois sentidos.

O codec inclui confirmação de acerto, uso de reverse beat e contador do teletransporte. O fingerprint de rede inclui a nova configuração e seu código. O servidor continua sendo a autoridade sobre inputs numerados, posições, dano, recursos e cinematografias; clientes antigos são recusados pela versão. A sincronização é por atraso de inputs/checkpoint, sem rollback e sem promessa de ausência de latência.

Os testes Apache usam dois processos Chrome independentes **no mesmo computador**, um por localhost e outro pelo IP real da interface. Não há segundo computador físico disponível; conectividade LAN através de outro dispositivo/firewall continua sendo um teste manual. Resultados e capturas desta revisão ficam em `deployment/audit/` (logs `frenzy-*`) e `deployment/audit/lan/`. As configurações de Apache/proxy permanecem as da migração anterior.

Os registros anteriores de imutabilidade de todo o motor em `deployment/audit/preserved-game.json` descrevem a migração de infraestrutura. Nesta etapa, alterações de gameplay foram expressamente solicitadas. Os PNGs aprovados continuam sujeitos à comparação de bytes original; o motor e os controles agora evoluíram conforme este documento.
