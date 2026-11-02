# Dio e The World — reações e apresentações

**R ativa Road Roller**, com duas barras, nos dois lados. O antigo duplo quarto de círculo não ativa mais a Super. A tecla usa a borda de pressionamento e o buffer de ações existente; manter R pressionado não repete o golpe. O custo, a confirmação do primeiro acerto e a recarga independente da Parada do Tempo permanecem iguais. Samurai mantém Mil Cortes em R.

**T provoca** com Dio. Sua provocação dura os 54 ticks desenhados e retorna ao controle normal. O agarrão ofensivo próprio de Dio e seu uso online continuam fora desta revisão. Dio recebe os agarrões do Samurai com uma reação própria.

## Executar

```sh
npm install
npm run build
npm start
```

[Jogo principal](http://127.0.0.1:3001/) · [Laboratório de estados](http://127.0.0.1:3001/art/dio-secondary.html) · [Inspeção de cada desenho](http://127.0.0.1:3001/art/dio.html).

Para desenvolvimento, `npm run dev` serve as mesmas telas na porta 5173. O laboratório está ligado ao menu principal e à tela de animações. Permite escolher os estados, espelhar, pausar, avançar ticks, alterar a velocidade, ampliar em passos inteiros e ver pivôs e caixas. O inspetor permite avançar desenhos individuais e selecionar as expressões.

## Recursos produzidos

Os PNGs e metadados anteriores foram preservados. As novas sequências usam nomes com prefixo `secondary`; o motor resolve seus nomes a partir de um mapa separado. Não foram substituídos os desenhos de movimentação, ataques, especiais ou Super.

Dio tem **19 sequências corporais, 139 células**, mais oito células de expressões:

- Defesa em pé: 4; defesa agachada: 4.
- Impacto na defesa alta: 3; impacto na defesa baixa: 3.
- Dano leve: 4; médio: 5; forte: 6; agachado: 4; aéreo: 4.
- Lançado: 4; queda: 4; derrubado: 4; levantando: 7.
- Agarrado: 5; nocaute: 8; derrota no chão: 6.
- Entrada: 46; provocação: 10; vitória: 8.
- Expressões: neutra, sorriso arrogante, raiva, provocação, surpresa, vitória, dor e olhos fechados.

The World tem **nove sequências, 54 células**:

- Interromper ataque: 4; recuar: 5; retornar à posição neutra: 6.
- Desaparecer: 6; ausente: 1 célula completamente transparente.
- Reaparecer: 8; dissipar no K.O.: 10.
- Ameaça durante provocação: 6; vitória com braços cruzados: 8.

São células exportadas, não uma alegação de 201 desenhos corporais exclusivos sem reaproveitamento. A entrada reaproveita a anatomia e o ciclo aprovado de caminhada, com expressão e assentamento próprios. Há poses independentes para joelhos, quadril, braços e ombros; a rotação de quedas complementa essas poses. Não há espadas. As expressões alteram os pixels dos olhos, sobrancelhas e boca sem trocar o contorno do rosto ou o cabelo.

Todos os corpos usam células 256×256, pivô (128,224), transparência binária e pixels nítidos. A dissolução do Stand remove pequenos grupos de pixels de poses articuladas; não exige pausar o jogo ou misturar os corpos nas folhas.

## Integração

O estado físico continua separado do desenho. A seleção de reações também fornece as hurtboxes da pose para colisões. Foi corrigida uma prioridade incorreta: o apresentador de movimentação de Dio podia esconder sua defesa por ela compartilhar o estado físico Idle/Agachado.

As reações de dano usam um relógio de fase: lançado, queda e contato com o chão começam em seus próprios primeiros desenhos. Um Dio lançado só é marcado como derrubado ao tocar o chão, permitindo os combos aéreos anteriores. O chão e a trajetória continuam sendo decididos pela física. A duração do getup acompanha os sete desenhos próprios de Dio, mantendo invulnerabilidade durante a recuperação.

Ao receber dano, o Stand perde sua sequência ofensiva, identificação do golpe, ligações de combo e hitboxes imediatamente. Em seguida articula interrupção, recuo e retorno. Seu trajeto de retorno sobe discretamente ao cruzar a posição do controlador. Quando já está recolhido, pode aceitar um novo comando antes de terminar a pequena acomodação visual. Começar outro ataque limpa a reação anterior.

Em queda grave ou agarrão, o Stand pode desaparecer e permanecer ausente. Ele começa a reaparecer durante o levantamento de Dio, em vez de acrescentar uma longa espera após o getup. No K.O., a dissipação ocorre uma única vez e não reinicia ao trocar do estado Nocaute para Derrota. No round seguinte, as novas entidades executam sua entrada normalmente.

The World não tem vida, dano recebido ou medidor independente. Seu estado, relógios e deslocamentos são serializáveis e restaurados junto com a partida. Hitstop, pausa e congelamento temporal conservam as regras existentes. Uma captura cinematográfica confirmada continua protegida contra interrupção.

A entrada dura os 100 ticks do anúncio existente: Dio anda 64 pixels durante 40 ticks, na velocidade correspondente ao ciclo aprovado, assenta sua pose e o Stand se manifesta a partir do tick 64. Os dois jogadores terminam em suas posições iniciais de luta, sem se sobrepor no centro. Na vitória, The World se recoloca atrás de Dio e cruza os braços. No K.O., Dio perde o equilíbrio e cai antes da pose de derrota.

## Arquivos

- `scripts/build_dio_secondary.py`: pipeline aditivo reproduzível, executado por `npm run art:dio:secondary`.
- `public/sprites/dio/secondary.json` e `public/sprites/the-world/secondary.json`: folhas, células, limites e tempos individuais.
- `src/data/dio-secondary.json`: mapa de reações, hurtboxes e tempos de apresentação.
- `src/data/the-world-secondary.json`: dados independentes do Stand.
- `art/dio/secondary-preservation.json`: hashes dos recursos anteriores e cópia dos metadados aprovados.
- `art/dio/secondary-rig.json` e `art/the-world/secondary-rig.json`: poses articuladas da produção.
- `src/dio-secondary-lab.ts` e `art/dio-secondary.html`: ensaios dos estados reais do motor.
- `tests/dio-secondary.test.ts`, `tests/test_dio_secondary_art.py`, `e2e/dio-secondary.pw.mjs`: verificações de estados, arte e navegador.

[Baixar PNGs, APNGs individuais e dados](http://127.0.0.1:3001/downloads/dio-secondary.zip). O ZIP é aditivo ao projeto, com arquivos de Dio e The World em diretórios separados. Cada sequência possui também seu PNG animado `secondary…-animated.png`.

## Verificação e limites

Os testes verificam as 19 seleções de estado, defesa, colisão real interrompendo o Stand nos dois lados, launcher do Samurai, queda, levantamento, desaparecimento e reaparecimento, K.O., novo round, provocação, vitória e restauração determinística durante uma reação. As verificações de arte cobrem preservação dos arquivos anteriores, transparência, pivôs, chão, expressões distintas, poses que não são simples translações e conteúdo do ZIP. R e T são testados com teclado no jogo principal, inclusive a remoção do comando antigo e a ausência de repetição ao segurar R.

O laboratório identifica os cenários preparados: a interrupção usa colisão real; os demais ensaios de dano iniciam diretamente o estado para permitir inspeção repetível. O launcher e os agarrões também são cobertos pelo combate real nos testes do motor. A prévia reúne quatro ensaios capturados do Canvas real — entrada, provocação, lançamento/recuperação e K.O. — e não representa uma única luta contínua.

Logs, capturas e resultados desta revisão ficam em `art/dio/qa/secondary/`. O relatório final é `validation.json`.

Na versão final passaram **337 testes de simulação, 73 verificações de arte, 54 cenários de navegador e cinco testes online das salas existentes do Samurai**. A compilação TypeScript/Vite/Node passou. A versão compilada foi testada na porta 3001: entrada real no modo Contra BOT, reações, launcher, interrupção nos dois lados, K.O., T/R e igualdade dos arquivos servidos. Road Roller também foi repetido na versão compilada contra ambos os personagens, nos dois lados, com confirmação, energia, defesa, K.O., pausa, câmera e histórico temporal preservado.

[Prévia real dos quatro ensaios em APNG](http://127.0.0.1:3001/previews/dio-secondary.png) · [GIF](http://127.0.0.1:3001/previews/dio-secondary.gif). São 205 capturas a 30 fps, sobre a simulação de 60 ticks. O APNG é conferido pixel a pixel contra cada PNG capturado; o GIF usa uma paleta compartilhada, com duração total de aproximadamente 6,83 segundos. A prévia anterior de Road Roller também foi atualizada para mostrar R no HUD.

A arte mantém o rig pixelado existente. Expressões em um rosto de aproximadamente nove por onze pixels são sutis; a anatomia em ângulos extremos e a atuação facial ainda se beneficiariam de retoques manuais. Esta entrega não substitui uma revisão artística humana quadro a quadro. Os sons continuam os recursos sintetizados existentes, sem vozes. Não foram habilitados o agarrão ofensivo próprio nem o multiplayer de Dio.
