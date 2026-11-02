# Dio Brando + The World — bases visuais

**Registro histórico da etapa inicial.** As bases originais continuam preservadas. O estado atual, com a revisão de movimento e Dio nos modos locais, está documentado em [DIO-MOVIMENTO.md](DIO-MOVIMENTO.md). As limitações abaixo descrevem a entrega das bases, não o jogo atual. `base.png` mantém a pose original. Use `npm run art:dio` para exportar as animações atuais.

Esta etapa entrega duas bases independentes utilizáveis na mesma arena do jogo. **Dio ainda não é selecionável para lutar em Contra BOT, Arcade ou online.** Não reutilizei os golpes de espada do Samurai para aparentar que seu combate estaria pronto.

## Visual e arquivos reais

- Dio: 130 px de altura visível, cabelo loiro, traje dourado/preto, detalhes verdes, mãos livres. `public/sprites/dio/base.png` e `idle.png`.
- The World: 155 px, armadura dourada, detalhes verdes, corpo robusto, capacete e olhar próprios. `public/sprites/the-world/base.png` e `hover.png`.
- Cada PNG tem célula 256×256, pivô (128,224), direção inicial direita, alpha 0/255 e RGB transparente zerado. Não há Stand dentro do atlas de Dio. Cada entidade tem **uma pose-base desenhada**, sem contagem artificial de quadros repetidos.
- Paletas de até 35 cores em `public/sprites/{dio,the-world}/palette.json`. Escala do jogo e prévias ampliadas usam nearest-neighbor, sem suavização.
- Bases geradas com a ferramenta integrada imagegen, depois importadas em grade/paleta pelo mesmo método usado no Samurai. Não são sprites desenhados manualmente quadro a quadro. Os prompts exatos ficam em `art/dio/generation-prompts.json`; originais gerados em `art/dio/generated-base.png` e `art/the-world/generated-base.png`. Nenhuma referência artística externa foi usada; o vocabulário de pixel, paleta, contorno e tamanho segue o Samurai existente.
- Fontes nativas em `art/{dio,the-world}/base-native.png`; informações da importação em `import.json`. A importação original está em `scripts/prepare_linked_characters.py` (`npm run art:dio:import`) e recusa sobrescrever personagens que já possuem animações.
- Pacote exportado: `public/downloads/dio-the-world-bases.zip`.

## Inspeção no jogo

No menu, abra **Dio + The World · teste de movimentação**, ou acesse `/art/dio.html`. Os controles e comportamentos abaixo registram a prévia inicial; consulte o documento de movimentação para os controles atuais.

- A/D: desloca a base de Dio e orienta as duas entidades. Ainda não existe walk desenhado.
- Espaço / Testar avanço: The World avança independentemente, passa à frente e retorna ao ponto atrás de Dio. **É teste de deslocamento e camadas; não é soco e não causa dano.**
- Pausar / avançar um tick; pausar apenas o Stand; inverter direção; zoom inteiro 1×/2×/3×; pivôs; comparação com o Samurai original.
- The World flutua de 15 a 21 px acima da referência dos pés de Dio, além do ajuste de avanço. A oscilação tem relógio próprio em ticks fixos. Usa deslocamento da pose-base; ainda não há desenhos de respiração/roupa/armadura variando no hover.

Capturas reais do Chrome: `art/dio/qa/arena-neutral.png` e `arena-front.png`. A prancha `art/dio/duo-preview-3x.png` é uma composição de inspeção feita com os mesmos PNGs; não é uma spritesheet carregada pelo motor.

## Arquitetura reutilizada

`Animator` continua lendo células, duração, loop e pivô de JSON. Dio e The World instanciam animadores separados com `src/data/dio-animations.json` e `the-world-animations.json`; os manifestos públicos correspondentes são exportados junto das imagens.

`src/engine/linked-entity.ts` mantém identidade do dono, estado, relógio e transformação da entidade vinculada. `hover`, `advance`, `hold` e `return` têm tempos próprios. O offset X acompanha o facing do dono; a posição responde ao movimento do dono durante o avanço/retorno. `src/data/the-world-visual.json` configura offsets, flutuação, tempos e profundidade.

`src/render/sprite-scene.ts` desenha entidades independentes por ordem estável de profundidade: Stand 0 atrás, Dio 10, Stand 20 durante o teste de avanço. Cada entidade usa seu atlas, pivô e orientação. O cenário original foi extraído, sem alterar seus comandos de desenho, para `src/render/arena.ts`, compartilhado pelo renderer normal e pela prévia. `FixedLoop` e `KeyboardInput` também são os existentes.

Os dados visuais estão separados dos dados de combate e marcados `combatReady: false`. Novos golpes deverão usar formas de socos/chutes/projéteis próprias e atribuição de acertos ao dono; não devem receber as cápsulas de katana do Samurai. Ainda não há hitboxes de ataques, facas, dano, especiais ou integração de Dio em salas online. Isso está deliberadamente fora desta etapa de bases.

## Validação executada

- 152 testes TypeScript e 33 de arte no projeto, incluindo independência, orientação, flutuação, retorno a um dono que se moveu/virou, ordem de desenho e transparência/tamanho dos PNGs novos.
- Teste do Chrome da nova prévia: carregamento dos dois atlases, controle de Dio, espelhamento, flutuação, pausa geral/quadro a quadro, pausa independente do Stand, avanço e retorno de profundidade.
- Regressão no Chrome para menu, três dificuldades, treinamento, combo real, Ultimate, defesa, áudio e downloads; os 19 cenários completos da auditoria também foram executados antes desta adição visual. Cinco cenários online com dois processos de Chrome passaram após as correções do Samurai.
- `art/dio/samurai-preservation.json` registra os hashes dos PNGs do Samurai na entrada desta etapa. O teste confirma que todos permanecem iguais após adicionar Dio/The World. As correções anteriores da auditoria têm backup separado descrito em `AUDITORIA-SAMURAI.md`.
- Build de produção inclui `/art/dio.html` e os PNGs/pacotes exportados.

O visual pode ser inspecionado agora, sem investir em dezenas de poses antes de estabilizá-lo. Rosto em ângulos adicionais, atuação facial, volumes em rotação e movimento real de roupas/membros ainda precisam ser desenhados nas próximas animações.
