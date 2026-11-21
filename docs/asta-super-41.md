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
- 932–1003: movimento completo, liberação da onda no tick 942, impacto principal no tick 956 e consequência.
- 1004–1100: retorno de Liebe, dissipação Union → parcial → normal, restauração da câmera e controles.

Os 1.100 ticks e as pausas de contato produzem aproximadamente 19 segundos. Os deslocamentos são contínuos e quantizados em 1/16 px. Nenhuma partícula ou relógio da renderização determina dano, posição ou equipamento.

## Equinox remoto

Asta recua para ficar a 515 px do alvo. A Demon-Slasher física conserva seu alcance de 80 px. O corte nasce na ponta real da katana e avança pelo intervalo até o adversário. Sua frente reta cresce do ponto de emissão até uma lâmina colossal e alongada de antimagia que se estende para além do céu visível e alcança o piso. A fenda no chão e a separação do céu progridem junto da borda; o corte continua além do alvo e se dissipa.

A incisão aparece depois do movimento dos braços; o impacto principal chega quatorze ticks após a liberação. A abertura da fenda, separação das camadas de nuvens, pressão lateral e fragmentos são transitórios. Não se altera a geometria da arena. Não há dano gerado por cada fragmento.

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
- Vitest completo: 59 arquivos / 1.476 testes aprovados, incluindo 23 testes de combate da Super e seis testes da geometria de Equinox.
- Três cenários visuais aprovados: sequência completa, defesa/erro e coreografia sem FX.
- Três cenários LAN aprovados: sequência e restauração, defesa/erro, e Asta como jogador 2 contra Goku. Câmera, recursos e hashes entre os clientes e o servidor conferidos pelo teste existente.
- 83 atlas de ações corporais com seis cels distintos; 26 atlas da Super (156 desenhos contando os anteriores), alpha, margens e pegadas verificados. Nenhuma pegada pendente.
- Todos os 71 recursos de Asta previamente versionados permanecem idênticos. Não foram alteradas as sprites dos outros lutadores nem os recursos de Pandemonium.
- O aviso preexistente do Vite sobre chunks acima de 500 kB permanece. A coleção completa de scripts Python legados dos demais lutadores não foi reexecutada.

As capturas antigas de `deployment/audit/asta-super/` documentam a versão de aproximadamente cinco segundos e o corte próximo horizontal. As novas gravações em `deployment/audit/asta-super41/` mostram a expansão para onze capítulos e o corte remoto vertical. A diferença pode ser examinada com os efeitos desligados, por meio de `no-fx.webm`.


## Correção de leitura: onda cortante, não descarga vertical

A primeira apresentação de Equinox foi reprovada por parecer um raio. A correção substitui inteiramente a borda em zigue-zague na posição do alvo por uma lâmina larga e afilada, com frente vertical reta e contínua, que parte do socket de Demon-Slasher no tick 942 e cruza a distância até o contato no tick 956. A abertura progressiva do piso começa sob a ponta inferior da onda; o céu é separado pela ponta superior. O efeito atravessa o adversário e continua avançando, sem deixar um pilar vertical fixo. Planos escuros sobrepostos dão espessura à antimagia; pressão rasante e fragmentos irregulares com trajetórias balísticas acompanham a incisão no chão.

Referências pesquisadas: [Ichigo TYBW de Meiloorun, incluindo as definições públicas de Getsuga](https://github.com/Meiloorun/mugen-ichigo-tybw-jus) e [publicação de Vergil por Resentone](https://www.youtube.com/watch?v=suNYR9DDmO8). A solução visual é própria, por código, e não importa sprites ou efeitos desses personagens. A referência de comportamento extraída das definições de Ichigo é a separação entre atuação do espadachim e emissão/deslocamento do corte.

`tests/asta-equinox-fx.test.ts` verifica emissão na ponta real, avanço contínuo nas duas orientações, frente reta, massa densa e extensão vertical sem alternâncias de raio, afilamento das extremidades, corte progressivo de chão/céu, passagem além do adversário e dissipação. Não há dano adicional nem alteração dos demais capítulos.

## Referência da técnica em Black Clover

A descrição de [Demon-Slasher: Infinite Slash Equinox](https://blackclover.fandom.com/wiki/Demon-Slasher%3A_Infinite_Slash_Equinox), que referencia o capítulo 316, identifica um corte descendente com a katana acima da cabeça, emitindo uma enorme lâmina voadora de antimagia de longo alcance. O [catálogo oficial da VIZ](https://www.viz.com/shonenjump/chapters/black-clover?locale=en) confirma o capítulo; suas páginas completas exigem acesso e não foram usadas como arquivos de arte do projeto. A imagem colorida enviada pelo usuário orienta a escala, a superfície negra e a pressão sobre o piso, sem ser copiada para a renderização.

A adaptação mantém a preparação corporal acima da cabeça, a conclusão descendente e a emissão à distância. O corte cresce do ponto de emissão até alcançar céu e chão e se desloca como uma superfície afiada, mantendo uma frente reta em toda a altura. Somente a massa escura e as bordas posteriores apresentam irregularidades e fragmentação. A borda tem apenas um brilho estreito; não há descargas em zigue-zague. A abertura dos cenários é cosmética e temporária. `complete-equinox.webm` contém uma gravação curta do recuo, preparação, emissão, impacto e dissipação na arena real; `equinox-before.png` conserva o aspecto anterior para comparação.

A descrição adicional enviada pelo usuário orientou a revisão final da silhueta: frente vertical reta, extensão acima do enquadramento e massa negra com largura constante no corpo principal. A forma oval/arredondada da primeira onda foi substituída. Os 29 testes de combate/geometria e as capturas reais foram repetidos depois desse ajuste; a simulação e seu hash permanecem os mesmos.

O acabamento posterior foi comparado à [demonstração de Yami de John X com edição de Mateo G9, publicada por XTREME_R](https://www.youtube.com/watch?v=oHIa89uEPSo), observando a pressão no piso durante o grande ataque. O [tutorial visual de cortes M.U.G.E.N. preservado em Kayin](https://kayin.moe/mugen/Mugen-FX/contents/Page08.htm) mostra a construção da silhueta a partir do arco da arma e sua redução entre quadros. A adaptação usa três rastros escuros desiguais e afilados, com recortes varridos que se desfazem em momentos diferentes; a frente vertical permanece íntegra. As referências são consultas visuais, sem importar seus efeitos para os recursos finais. A miniatura e as definições públicas de Ichigo de Meiloorun complementam a pesquisa de emissão independente, mas não foram tratadas como uma análise quadro a quadro do vídeo inteiro.
