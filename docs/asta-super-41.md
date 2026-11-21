# Asta R 4.1 — Devil Union / Infinite Slash Equinox

Base preservada: `b1b9d54c5fa474381a5cbee08a1f2fc4fa24a132`, incluindo a implementação inicial da Super e a cadeia de PRs #11–14. Branch: `codex/asta-super-devil-union-cinematic`.

A abertura continua sendo Black Meteorite em Black Asta parcial. Somente o acerto real da lâmina confirma a captura. Defesa e erro gastam uma barra, recuperam e restauram a aparência normal. A sequência confirmada agora desenvolve a parceria com Liebe, a formação da Devil Union e quatro capítulos de espada, seguidos de perseguição aérea e Equinox à distância.

## Timeline determinística

`src/engine/asta-super-acts.ts` é a fonte dos capítulos, quadros, contatos, pausas e trocas. A transformação inicial ocupa os 14 ticks interrompíveis anteriores à confirmação. Depois disso:

- 0–89: Meteorite, transferência de peso, continuação ascendente e queda do alvo.
- 90–157: encontro e gesto de parceria com Liebe.
- 158–231: formação progressiva da Devil Union.
- 232–351: Demon-Slayer horizontal, diagonal e ascendente.
- 352–483: perseguição e cortes físicos com Demon-Dweller, incluindo Black Slash aéreo.
- 484–579: ruptura ofensiva com Demon-Destroyer; não invoca cura nem reinicia Causality Break.
- 580–723: ofensiva de katana com cruzamentos de posição e lançamento.
- 724–823: voo, ultrapassagem, giro e redirecionamento; entrada gradual do céu cinematográfico.
- 824–871: recuo animado de Asta, estabelecendo a distância até o adversário.
- 872–931: preparação de Equinox com katana em tamanho normal.
- 932–1003: movimento completo, liberação remota no tick 945, impacto principal no tick 956 e consequência.
- 1004–1100: retorno de Liebe, dissipação Union → parcial → normal, restauração da câmera e controles.

Os 1.100 ticks e as pausas de contato produzem aproximadamente 19 segundos. Os deslocamentos são contínuos e quantizados em 1/16 px. Nenhuma partícula ou relógio da renderização determina dano, posição ou equipamento.

## Equinox remoto

Asta recua para ficar a 515 px do eixo final. A Demon-Slasher física conserva seu alcance de 80 px. O corte final é outro elemento: um plano vertical de antimagia na posição distante do alvo, do céu ao piso, expresso por `astaEquinoxPlane`.

A incisão aparece depois do movimento dos braços; o impacto principal chega onze ticks após a liberação. A abertura da fenda, separação das camadas de nuvens, pressão lateral e fragmentos são transitórios. Não se altera a geometria da arena. Não há dano gerado por cada fragmento.

## Dano e equipamento

São sete aplicações controladas: 50 + 30 + 30 + 30 + 30 + 30 + 140 = 340, sujeitas à escala de combo existente (mínimo 0,55). Os demais contatos apenas sincronizam atuação, reação e hitstop. O alvo conserva ao menos 1 HP até o evento final, que pode causar KO. Nenhum evento se repete durante as pausas.

A sequência principal começa com Slayer; os saques do grimório para Dweller, Destroyer e Slasher ocorrem nos ticks 352, 484 e 580. Cada saque confirma a espada uma vez e exibe somente uma arma. Asta encerra com Slasher equipada, inclusive nos movimentos básicos e normais posteriores.

## Arte e efeitos

São 17 novos atlas curtos de seis quadros (102 desenhos), incluindo encontro/encerramento de Liebe, transformação progressiva, atuação das quatro espadas, voo, recuo e preparação/execução de Equinox. Fontes e prompts do `imagegen` integrado estão em `art/asta-source/super41-sources.json`; os pontos de pegada estão em `super41-sockets.json`. Os originais gerados são preservados, e as cópias utilizadas ficam no repositório.

O empacotamento usa a escala fixa 0,30, interpolação nearest, células de 256 px e pivô 128/224. Nenhum quadro recebe redimensionamento individual. Os recursos aprovados da base e dos especiais permanecem preservados. Algumas animações da primeira Super são utilizadas quando a ação continua apropriada, como subida, mergulho e retorno à forma normal.

Todas as manifestações de antimagia, projéteis cinematográficos, pós-imagens, pressão, céu, nuvens, iluminação e fenda são desenhadas por código. Não há FX embutido nos sprites corporais. As variações cosméticas são determinísticas e independentes das regras de dano. Os sons são sintetizados originalmente no módulo de áudio existente.

## Verificação reproduzível

`tests/asta-super.test.ts` cobre confirmação, defesa, erro, interrupção anterior ao saque, quatro espadas iniciais, dois lados, snapshots em vários capítulos, sete danos únicos, KO, escala, adversários diferentes/cantos, recuo e impacto remoto atrasado.

`e2e/asta-super.pw.mjs` grava a sequência real no Treinamento, seus contatos, a recuperação, defesa/erro e uma reprodução sem efeitos. Os testes `Asta Super R` em `e2e/lan/game.pw.ts` usam dois clientes e o backend Socket.IO existente. Os utilitários `scripts/verify-asta-super-modes.mjs` e `scripts/verify-asta-super-lan.mjs` exercitam também a versão servida, sem comandos de depuração para preencher barra no LAN.

As capturas e os resultados finais desta revisão são registrados em `deployment/audit/asta-super41/`. A publicação local utiliza `atualizar-msfd.cmd -Branch codex/asta-super-devil-union-cinematic`, seguida da checagem HTTP dos arquivos, backend e Socket.IO. A aprovação de uma build não significa atualização de outra máquina.


## Resultados desta revisão

- TypeScript e build de produção aprovados.
- Vitest completo: 58 arquivos / 1.470 testes aprovados, incluindo 23 testes específicos da Super.
- Três cenários visuais aprovados: sequência completa, defesa/erro e coreografia sem FX.
- Três cenários LAN aprovados: sequência e restauração, defesa/erro, e Asta como jogador 2 contra Goku. Câmera, recursos e hashes entre os clientes e o servidor conferidos pelo teste existente.
- 83 atlas de ações corporais com seis cels distintos; 26 atlas da Super (156 desenhos contando os anteriores), alpha, margens e pegadas verificados. Nenhuma pegada pendente.
- Todos os 71 recursos de Asta previamente versionados permanecem idênticos. Não foram alteradas as sprites dos outros lutadores nem os recursos de Pandemonium.
- O aviso preexistente do Vite sobre chunks acima de 500 kB permanece. A coleção completa de scripts Python legados dos demais lutadores não foi reexecutada.

As capturas antigas de `deployment/audit/asta-super/` documentam a versão de aproximadamente cinco segundos e o corte próximo horizontal. As novas gravações em `deployment/audit/asta-super41/` mostram a expansão para onze capítulos e o corte remoto vertical. A diferença pode ser examinada com os efeitos desligados, por meio de `no-fx.webm`.
