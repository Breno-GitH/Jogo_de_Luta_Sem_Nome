# Goku — três especiais comuns

Rajada de Ki, Kamehameha e Teletransporte estão integrados ao combate existente. Nenhum consome Super, congela o combate, captura o adversário ou inicia cinematografia. Não há Super Kamehameha. A transformação em Super Saiyajin 1 permanece para uma etapa futura.

J/K/L escolhem leve/médio/forte. Para frente e para trás seguem o lado do personagem:

- Ki: ↓ → + J/K/L. Aceita também ↓ ↘ →.
- Kamehameha: ↓ ← + J/K/L. Aceita também ↓ ↙ ←.
- Teletransporte: ↓, soltar, ↓ + J/K/L. Exige dois pressionamentos distintos de S, com um tick neutro entre eles; segurar baixo não ativa a técnica.

A janela de movimento é 24 ticks, com 6 ticks de tolerância para o botão final. O duplo baixo deve ocorrer em 20 ticks. O buffer normal de botões é 8 ticks. As direções precisam existir em pelo menos um tick de simulação. Entradas posteriores ao botão não completam retroativamente uma sequência. O especial tem prioridade sobre o normal e a sequência é consumida uma única vez. Os parâmetros ficam em `src/data/goku-specials.json`.

## Rajada de Ki

Leve: uma esfera, startup 7, ativo 1, recuperação 17 ticks, dano base 35 e velocidade 14 px/tick. Médio: duas esferas nos ticks 10 e 19, startup 10, ativo 10, recuperação 21; cada esfera causa 29 antes do escalonamento. Forte: uma esfera maior, startup 16, ativo 1, recuperação 29, dano 76 e velocidade 10.

Há no máximo quatro esferas em voo por jogador. O estado da esfera inclui posição anterior/atual, velocidade, direção, raio, vida, animação e impacto. A colisão varre o percurso para evitar atravessar hurtboxes em alta velocidade. Cada esfera impacta uma vez, perde sua colisão ofensiva e desaparece após oito ticks de impacto. As esferas já lançadas continuam se o dono sofrer dano; a preparação interrompida não lança novas esferas. Podem ser defendidas na direção correta e congelam durante a Parada do Tempo de Dio.

## Kamehameha

O corpo tem preparação lateral com mãos unidas, flexão dos joelhos, impulso, extensão, reação ao disparo e recuperação. A energia usa sete folhas separadas de FX, incluindo origem, corpo repetível do feixe, extremidade, impacto e dissipação. Um feixe não é uma esfera esticada: o renderizador monta segmentos animados e pontas próprias sobre a área de colisão.

- Leve: 13 de startup, 12 ativos, 18 de recuperação; alcance 600, raio 12, dois pulsos de 26 de dano base, separados por 6 ticks.
- Médio: 19 de startup, 25 ativos, 24 de recuperação; alcance 780, raio 18, quatro pulsos de 27, separados por 7 ticks.
- Forte: 25 de startup, 40 ativos, 32 de recuperação; alcance 1000, raio 25, seis pulsos de 29, separados por 7 ticks.

Os pulsos têm identificadores independentes: não há dano por todos os ticks de sobreposição. O alcance visual e a colisão seguem as palmas reais e a direção do golpe, limitados pela arena. Receber dano encerra imediatamente a colisão do feixe; a dissipação restante é apenas visual. Pode ser defendido. As três forças compartilham os desenhos corporais, com tempos e camadas de energia diferentes.

## Teletransporte

Startup, desaparecimento e recuperação, em ticks: leve **10 / 6 / 20**, médio **13 / 7 / 25**, forte **15 / 8 / 25**. A antecipação e a recuperação são vulneráveis; apenas o intervalo invisível não tem hurtboxes. Goku não pode atacar ou cancelar o teletransporte durante a recuperação.

O leve avança até 155 px e para diante da pushbox do alvo. O médio aparece 80 px atrás do oponente se ele estiver a até 520 px de distância horizontal e a posição couber na arena; caso contrário, tenta um avanço de 100 px sem sobreposição. O forte desloca até 95 px horizontalmente e sobe 130 px, limitado à altura mínima configurada. Funciona a partir do solo e do ar, com poses de preparação próprias para cada caso. Depois de reaparecer, a gravidade continua normal e a aterrissagem visual acompanha o contato físico com o chão.

Há bloqueios de nova ativação de 48/65/90 ticks, contados desde o início da técnica. A versão aérea só pode ser usada uma vez por salto e precisa também aguardar seu bloqueio. Nenhum teletransporte cancela normais ou outros especiais. Isso evita encadear reposicionamentos e ataques sem resposta. As posições finais respeitam raízes entre 40 e 1240 e uma separação mínima de 56 px quando as pushboxes compartilham altura.

## Cancelamentos e preservação

Normais confirmados em acerto ou defesa podem cancelar para Ki/Kamehameha dentro das suas janelas já existentes. Foram exercitados J → K → Ki, K → L → Kamehameha e Crouch Medium → Ki contra Samurai, Dio e Goku nas duas direções. Não há cancelamento de especial para outro especial. Os limites aprovados do Goku continuam em oito contatos, seis aéreos e 180 ticks, com escalonamento de dano e queda forçada no limite.

Os 2.439 arquivos de arte/dados anteriores congelados permanecem idênticos: Samurai, Dio, The World, movimentação MOV5 e normais/reações de Goku. As extensões no motor são condicionadas ao personagem ou usam novos campos explícitos de simulação. Ki, feixes, bloqueios e serial da execução fazem parte dos snapshots determinísticos. O arquivo de versão compartilhada muda junto do protocolo de simulação.

## Arquivos e inspeção

- `src/engine/goku-specials.ts`: validação de estados, teletransporte, geometria e tipos de entidades.
- `src/data/goku-specials.json`: comandos e balanceamento.
- `src/data/goku-special-moves.json`: propriedades e poses dos dez caminhos de animação, incluindo forte iniciado no ar.
- `src/data/goku-special-animations.json`: desenhos e duração individual.
- `src/data/goku-special-fx.json`: sete camadas de efeitos independentes.
- `src/render/goku-special-fx.ts`: energia montada separadamente dos corpos.
- `public/sprites/goku/specials/`: folhas transparentes, quadros e APNGs.
- `art/goku/specials/stage3/`: fontes, prompts, produção, congelamento e auditoria.
- `scripts/build_goku_specials_stage3.py` e `scripts/build_goku_special_fx.py`: exportação reproduzível a partir das fontes reais já produzidas.
- `scripts/package_goku_specials.py`: pacote e prévia das capturas reais do jogo.

O [laboratório](http://127.0.0.1:3001/art/goku-specials.html) permite controlar Goku, executar os nove especiais, testar combos, defesa, interrupção e canto, inverter lados e inspecionar os desenhos. Há pausa, avanço por tick ou desenho, velocidade ¼×–2×, zoom inteiro, chão, pivôs, limites e caixas. A inspeção estática mostra os corpos sólidos; o combate controla a invisibilidade e os efeitos reais.

Execute `npm run dev` para desenvolvimento em 5173. Use `npm run build` e `npm start` para cliente e servidor em 3001. `npm test` roda lógica e arte; os testes de Chrome ficam em `e2e/goku-specials.pw.mjs`. A configuração `playwright.goku-production.config.mjs` verifica o build servido em 3001. `npm run art:goku:specials` reexporta as fontes já geradas; não solicita novas imagens.

Validação final em 2 de novembro de 2026: **467 testes de lógica e 113 de arte passaram**, além de cinco testes novos de navegador, 30 testes/capturas de regressão e três testes na produção compilada. Foram verificados comandos reais no teclado, espelhamento, três oponentes, bloqueio, interrupção, cancelamentos, recuperação, limites, snapshots e igualdade dos PNGs/FX/ZIP servidos. Build aprovado; servidor conferido na versão `1d4ebb9198d3550f005f2c5d`. Logs e capturas ficam em `art/goku/specials/stage3/`. Uma execução de self-play excedeu o tempo limite enquanto o Chrome disputava CPU; a suíte foi repetida sem essa concorrência após evitar alocações de energia em partidas sem essas entidades, e passou. A produção foi repetida após reiniciar a instância antiga do servidor e confirmou a versão correta.

[Pacote de PNGs, APNGs e JSONs](http://127.0.0.1:3001/downloads/goku-specials.zip) · [Contato de todos os quadros](http://127.0.0.1:3001/previews/goku-specials-contact.png) · [Prévia animada real](http://127.0.0.1:3001/previews/goku-specials-gameplay.png). A prévia usa 560 capturas do Canvas; a versão de inspeção é reduzida por nearest-neighbor e reproduzida a 10 FPS, enquanto a simulação permanece em 60 Hz.

## Qualidade e limites

São dez animações corporais com 85 referências de quadros e sete folhas de FX com 28 desenhos. As poses foram produzidas com a ferramenta interna image_gen usando o Goku aprovado como referência, depois importadas inteiras com escala uniforme por folha de calibração, nearest-neighbor, alfa binário, 32 cores e pivô (192,224) em células 384×256. Não houve montagem ou deformação de membros. Uma pose aérea com componente desconectado foi rejeitada em vez de remendada. Fontes, prompts e recortes estão registrados.

Ainda há pequenas variações de cabelo, rosto e dobras entre desenhos que podem receber acabamento manual. As hurtboxes usam retângulos conservadores por pose; os FX usam uma paleta própria de 16 cores. As capturas e testes validam o resultado utilizável e a integração, sem certificar equivalência artística a uma produção profissional feita inteiramente à mão. O balanceamento ainda pede sessões humanas prolongadas.

Goku permanece nos modos locais. O protocolo de seleção online continua restrito ao Samurai. Não foram implementadas transformação SSJ1 ou outras Supers nesta etapa.
