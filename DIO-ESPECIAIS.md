# Dio — três especiais comuns, revisão 4

**Atualização:** Road Roller foi implementado separadamente como Super de duas barras, sem alterar os especiais comuns desta etapa. Veja [ROAD-ROLLER.md](ROAD-ROLLER.md). As contagens de testes e a lista de limitações abaixo registram a revisão dos especiais comuns.

Facas, Muda Muda Rush e Parada do Tempo são especiais direcionais. Nenhum consome Super, inicia captura cinematográfica ou executa Road Roller. Os nove normais continuam exclusivos de The World e seus dados, desenhos e tempos aprovados foram preservados. Samurai não recebeu mudanças de dados ou arte.

## Executar

```sh
npm install
npm run dev
```

Abra [o laboratório dos especiais](http://127.0.0.1:5173/art/dio-specials.html), ou selecione Dio no Treinamento, Contra BOT ou Arcade. Adversário Dio pode ser selecionado nos modos locais apropriados. Os especiais usam o mesmo buffer e a mesma simulação nesses modos.

Para servir o jogo compilado e o servidor existente:

```sh
npm run build
npm start
```

O endereço é [127.0.0.1:3001](http://127.0.0.1:3001/). O laboratório compilado fica em [/art/dio-specials.html](http://127.0.0.1:3001/art/dio-specials.html). O online continua Samurai contra Samurai.

## Comandos reais

- **Facas:** baixo → frente + J/K/L. Aceita baixo → diagonal para frente → frente.
- **Rush:** baixo → trás + J/K/L. Aceita baixo → diagonal para trás → trás.
- **Tempo:** frente → baixo + L. Aceita frente → diagonal para frente → baixo.

Tudo é relativo ao lado de Dio. Olhando à direita, as facas são S, D + botão; olhando à esquerda, S, A + botão. Para formar a diagonal, segure S, adicione a direção e depois solte S antes de apertar o ataque. No Tempo, solte a direção horizontal e termine em baixo + L. Não é necessário apertar W.

O reconhecimento exige as duas direções cardinais na ordem certa, dentro de 24 ticks, com botão até cinco ticks após a direção final. Diagonais intermediárias são opcionais; um simples diagonal + botão não basta. O ataque é relacionado ao instante do botão, impedindo que direções posteriores convertam retroativamente um normal em especial. O buffer também preserva a ordem de entradas durante hitstop.

Tempo com L tem prioridade. Uma sequência consumida não pode ativar novamente sem uma nova execução. Tempo indisponível consome o comando e não vira um normal forte por acidente. Repetição automática do teclado é ignorada. As habilidades desta etapa são terrestres.

## Facas

- Leve: uma faca, startup 11 ticks, duração total do movimento 29 ticks.
- Média: duas facas, nos ticks 16 e 24, duração total 46.
- Forte: três facas no tick 22, com dispersão de −0,045/0/+0,045 radianos, duração total 56.

Velocidades iniciais: 13, 13,5 e 14 px por tick. Danos base por faca: 38/32/28, sujeitos ao escalonamento de combo. Podem ser bloqueadas em pé ou agachado, sem dano residual. Há startup e recuperação vulneráveis, sem consumo de Super.

Cada faca tem ID, posição, velocidade, orientação, idade, vida útil e colisão próprios. A colisão percorre o segmento entre a posição anterior e a atual para evitar atravessar hurtboxes estreitas. Um contato remove a faca. Fora da arena ou após 110 ticks de trajetória, ela é removida. Há no máximo seis facas simultâneas por dono, com verificação de capacidade antes do início e em cada liberação.

A posição de saída vem da mão desenhada no quadro de arremesso. As facas só são seguradas nas poses da habilidade. Após interrupção, lançamentos futuros são cancelados; projéteis já lançados permanecem. The World não executa esses arremessos.

Durante o tempo parado, todas as facas, inclusive as lançadas por Dio durante o efeito, ficam suspensas. Seus relógios de vida útil e suas colisões também param. Elas retomam a trajetória ao terminar o efeito. Isso permite preparar facas suspensas, respeitando o limite de seis.

## Muda Muda Rush

- Leve: quatro contatos, startup 10, recuperação 16 ticks, avanço máximo relativo de 60 px.
- Médio: sete contatos, startup 13, recuperação 22, avanço máximo de 95 px.
- Forte: dez contatos, startup 17, recuperação 28, avanço máximo de 130 px.

Contatos duram dois ticks, espaçados por cinco ticks; cada um tem seu próprio ID. Os braços alternam e a finalização usa um soco pesado. Danos base por soco são 17/15/13, com finalizadores de 32/40/50. Há escalonamento de combo e hitstop curto por impacto; não se somam esses valores como dano garantido.

O Stand usa poses de preparação, avanço, alternância, impacto e recuperação, sem braços duplicados. A virada do quadril aproxima o ombro do braço mais próximo sem esticar seus ossos. A aproximação pode acompanhar o pequeno deslocamento causado pelo golpe anterior, com distância e velocidade máximas; não persegue o adversário indefinidamente. Hitboxes são os punhos desenhados na transformação real do Stand.

Normais terrestres confirmados podem ser cancelados em especiais durante sua parte ativa. Os normais preservam seus cancelamentos anteriores; a regra adicional fica fora dos arquivos aprovados. Existem 33 ligações desenhadas entre poses ativas dos normais e o início do Rush. The World mantém sua posição ofensiva durante o cancelamento e retorna depois da recuperação. Receber dano interrompe caixas futuras e provoca retorno.

Rush não cancela em si mesmo ou em outros especiais. Seu limite de combo é 16 impactos, para permitir finalizá-lo após uma sequência normal. Outros limites existentes de juggle e duração continuam aplicáveis. Durante a Parada do Tempo, prevalece também o limite temporal de oito impactos.

## Parada do Tempo

Startup vulnerável de 24 ticks, com nove ticks de recuperação de ativação. O efeito dura **120 atualizações da simulação, a 60 Hz**. O loop principal, o teclado do dono e a interface continuam funcionando.

O controlador pertence a `Match`, não ao lutador recriado a cada round. Cada jogador Dio tem seu próprio histórico na partida. A primeira utilização começa disponível. O uso é registrado quando a ativação efetivamente acontece; interrupção durante startup não o consome.

Ao terminar o efeito, a recarga é:

`60 × (20 + (utilizações − 1) × 10)` ticks.

Assim, usos 1–5 produzem 20, 30, 40, 50 e 60 segundos. A fórmula continua crescendo depois do quinto uso. Valores são configuráveis em `src/data/dio-specials.json`.

Usos e ticks restantes sobrevivem a dano, KO, vitória, derrota e mudança de round. A recarga não corre durante o efeito, hitstop, capturas, intro, intervalo, pausa ou menu. Corre nos ticks efetivos do combate normal. Por isso, uma recarga de 20 segundos pode levar mais de 20 segundos de relógio se houver essas interrupções. Só criar uma nova `Match`, inclusive reiniciar a partida pelo menu, zera o histórico.

Durante o efeito:

- O adversário preserva posição, velocidade, estado, frame e animação do Stand. Novas entradas dele são descartadas.
- O cronômetro do round não avança.
- Dio pode andar, pular, comandar normais e executar facas ou Rush após sua recuperação.
- Facas de ambos os donos ficam congeladas.
- Dano pode ser aplicado ao adversário, mas reação, stun e knockback ficam pendentes para a retomada. Sem contato, o estado anterior continua do ponto em que parou.
- Dano temporal usa escala inicial 0,65, queda adicional de 0,07 por contato, piso 0,25, máximo de oito impactos e teto de 220 de dano por ativação. O escalonamento de combo também se aplica.

O teto temporal não conta bloqueios como dano. A postura de defesa existente no congelamento continua válida. Uma hitbox consome seu ID mesmo quando o orçamento temporal já acabou, impedindo acertos repetidos indevidos. Ao terminar, a reação pendente é aplicada e os buffers congelados são limpos. KO encerra o efeito com segurança e preserva a recarga para o próximo round.

Um indicador discreto informa pronto, ativo ou recarregando para cada Dio. Há flash breve, pulso pixelado, tonalidade temporária da arena e efeito de retomada. Não há pausa global nem troca para uma sequência cinematográfica.

## Arte e organização

As novas folhas são aditivas: 17 clipes/113 desenhos de Dio, 16 clipes/127 desenhos do Stand e 33 ligações específicas de cancelamento. Os totais incluem sequências completas por versão e subanimações reutilizadas de propósito; não representam desenhos únicos somados sem reaproveitamento. São PNGs transparentes, células 256×256, pivô (128,224), paleta nativa, sem antialiasing. Facas e pulsos têm atlas próprio em células de 128×128.

- `scripts/build_dio_specials.py`: produção reproduzível. `npm run art:dio:specials` regenera somente a adição.
- `public/sprites/dio/specials.json`: fases, versões completas, durações, hurtboxes e ponto de saída das facas.
- `public/sprites/the-world/specials.json`: fases e versões do Rush, poses temporais e caixas dos punhos.
- `public/sprites/the-world/special-transitions.json`: ligações para o Rush.
- `public/sprites/fx/dio-specials.png`: projéteis e pulsos separados dos personagens.
- `src/data/dio-specials.json`: balanceamento, recargas e limites temporais.
- `src/data/dio-special-moves.json`: movimentos exportados.
- `src/data/the-world-special-actions.json`: ações adicionais do Stand.
- `src/engine/temporal.ts`: relógios, orçamento de dano e reações pendentes.
- `src/engine/projectiles.ts`: projéteis e colisão contínua.
- `art/dio/specials-preservation.json`: hashes dos PNGs e cópias dos metadados aprovados, além de hashes dos dados originais de Dio e Samurai.

[Baixar PNGs, células e JSONs](http://127.0.0.1:3001/downloads/dio-specials.zip). O pacote é uma adição à movimentação e aos normais existentes; não é um personagem independente do motor.

## Ferramentas e verificação

Resultado final: **284 testes TypeScript, 57 verificações de arte, 41 cenários no Chrome e cinco cenários online com dois navegadores passaram**. O build passou. A versão compilada da porta 3001 também passou por 12 combinações de especial/adversário, pelo teclado na tela principal, pausa, recarga, round e reinício. `art/dio/qa/specials/validation.json` registra os resultados e a preservação dos arquivos.

O laboratório envia comandos ao buffer real, permite enfrentar os dois personagens, inverter o lado, defender, caminhar ou pular com o alvo, pausar, avançar um tick, reduzir velocidade, ampliar e inspecionar caixas. Botões distintos executam na mesma partida ou criam uma nova. O botão de recarga simula os ticks necessários, inclusive intervalos reais de round; não altera o contador diretamente. Encerrar round de teste permite verificar a preservação do histórico. O inspetor `/art/dio.html` inclui todas as folhas novas e seus downloads.

```sh
npm test
npm run test:browser
npm run test:online
npm run build
```

Os testes novos verificam versões, orientação, comandos simples e diagonais, ordem das entradas, consumo único, dano, bloqueio, capacidade, interrupções reais, normal cancelado em Rush, congelamento exato de 120 passos, retomada de ataques e projéteis, progressão de cinco usos, rounds, nova partida e restauração determinística durante o congelamento. A arte é verificada quanto a transparência, paleta, poses distintas, punhos, pontos de saída e preservação dos arquivos anteriores. Logs e capturas reais ficam em `art/dio/qa/specials/`.

O teste online de divergência foi corrigido para aceitar recuperação por checkpoint na mesma sessão e para comparar os ticks posteriores à recuperação. O código de recuperação do jogo permaneceu o existente; a verificação anterior exigia uma rotação de sessão e incluía o intervalo propositalmente corrompido na comparação.

Prévia do Rush capturada no motor, um tick por imagem, com vida infinita desativada: [APNG a 60 ticks/s](http://127.0.0.1:3001/previews/dio-muda-rush.png) e [GIF de compatibilidade a 30 fps](http://127.0.0.1:3001/previews/dio-muda-rush.gif). São 132 ticks, do comando ao retorno, com dez acertos e redução real da vida.

## Limitações

Road Roller não foi implementado; a barra de Super permanece reservada. Dio online e seus agarrões/reação completa continuam fora desta etapa. Os especiais são terrestres, sem colisão entre facas ou reflexão de projéteis. O balanceamento é inicial e precisa de sessões humanas de jogo.

A arte usa o pipeline articulado aprovado, com poses novas e retoques de pixels. Rotações extremas, sobreposição de armadura e expressões faciais ainda têm limitações diante de animação desenhada manualmente em todos os ângulos. As reações provisórias anteriores de Dio não foram substituídas.

A carga inicial ainda concentra os atlas e metadados; o build informa um pacote JavaScript acima de 500 kB antes de compressão. Não foi feito benchmark em hardware de baixo desempenho. Ativações de Tempo no mesmo tick são resolvidas em ordem determinística de assento; um sistema próprio de empate não foi criado.
