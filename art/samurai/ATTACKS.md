# Samurai — nove ataques normais jogáveis

Esta etapa acrescenta nove spritesheets de ataques e 45 novos quadros (4/5/6 em cada postura). Somados ao Idle e à movimentação, são 22 sequências e 90 quadros autorais/exportados. As imagens do Idle e da movimentação anterior foram preservadas por hashes SHA-256, registrados em `movement-lock.json`.

## Golpes e utilidade

Todos os tempos são ticks de combate a 60 Hz. A ordem abaixo é startup / ativo / recuperação:

- **Stand Light:** 4 quadros, 5/3/10, dano 45. Corte horizontal curto com uma mão; inicia pressão e combos.
- **Stand Medium:** 5 quadros, 8/4/16, dano 75. Diagonal ascendente com rotação do quadril, cobrindo o tronco e a parte alta do oponente.
- **Stand Heavy:** 6 quadros, 12/5/23, dano 115. Corte horizontal com duas mãos; maior impacto e afastamento. Não é launcher.
- **Crouch Light:** 4 quadros, 5/3/11, dano 40. Corte horizontal baixo e rápido, exige defesa agachada.
- **Crouch Medium:** 5 quadros, 8/4/16, dano 65. Estocada baixa com maior extensão da mão e da lâmina.
- **Crouch Heavy:** 6 quadros, 11/5/24, dano 95. Ascendente com duas mãos, lança com velocidade vertical -13 e permite cancelamento em pulo.
- **Air Light:** 4 quadros, 4/4/9, dano 40. Corte curto para começar a sequência aérea.
- **Air Medium:** 5 quadros, 7/5/13, dano 65. Corte horizontal amplo, continua a suspensão do combo.
- **Air Heavy:** 6 quadros, 10/5/20, dano 105. Corte descendente, sem cancelamentos posteriores; arremessa o alvo para baixo e causa knockdown.

Hitstun, blockstun, knockback e hitstop são individuais e estão em `src/data/samurai.json`. O hitstop varia de 6 a 13 ticks. Em contatos simultâneos, vale o maior hitstop; ambos os ataques podem trocar dano. Em defesa não há dano de chip nos normais.

## Jogar e executar combos

J/K/L escolhem leve/médio/forte conforme a postura no início do ataque. S seleciona os agachados; fora do chão, os mesmos botões selecionam os aéreos.

- **Combo terrestre:** J → K → L, pressionando o próximo botão após contato. Confirmado com três acertos e 205 de dano, incluindo a redução progressiva de dano em combo.
- **Lançamento e combo aéreo:** S+L → W → J → K → L. Confirmado com quatro acertos (launcher + três aéreos), 257 de dano e knockdown final.
- O pulo cancelado do launcher é imediato, para manter a perseguição aérea. O pulo comum preserva sua preparação de quatro ticks.
- Leves cancelam em médios/fortes e especial; médios em fortes/especial. O Stand Heavy cancela apenas em especial; o Crouch Heavy permite pulo/especial. Air Light permite Medium/Heavy; Air Medium permite Heavy; Air Heavy encerra a sequência.
- Cancelamento exige contato, inclusive na defesa. Ataques que erram não podem pular sua recuperação por esses cancelamentos.

O buffer dura oito ticks de combate e não expira enquanto o hitstop congela a simulação. Os golpes Air Light e Air Medium ajustam a velocidade do atacante e do alvo no contato para manter a sequência jogável. Air Heavy força a queda e impede novos contatos durante o knockdown; o alvo fica sem controle por pelo menos 24 ticks no chão antes de recuperar. As animações aéreas podem entrar em Landing ao tocar o chão, conforme a regra de aterrissagem existente.

## Colisão e sincronização

Cada pose tem duração, fase, segmento da lâmina e múltiplas hurtboxes. O motor lê esses dados de combate sem consultar o PNG ou o relógio de renderização. O controlador visual sincroniza o quadro do ataque com `stateFrame`, incluindo pausas de hitstop, cancelamentos e recuperação.

A hitbox é uma cápsula de raio 3 acompanhando a katana visível, não o retângulo amplo que a envolve. O teste geométrico usa a distância entre o segmento e as hurtboxes retangulares: os cantos vazios da caixa delimitadora de uma espada diagonal não causam dano. A forma é espelhada pelo pivô junto com o personagem.

As hurtboxes da cabeça, tronco, pernas e braços acompanham a articulação de cada pose. Cabelo, ponta da roupa e lâmina não recebem dano. O personagem neutro também usa caixas separadas, ajustadas à altura da nova arte. A pushbox permanece independente, resolvendo a separação física dos lutadores. Cada normal causa no máximo um acerto por execução.

## Arte, origem e arquivos

As novas poses usam a base nativa aprovada, com recortes articulados de pernas, tronco, cabelo e tecido. Para os ataques, os braços têm articulação independente de ombro/cotovelo/punho, e as mãos e a katana mudam de posição e orientação. A lâmina é uma transformação rígida da katana original; não há arcos de efeito, rastros ou brilhos adicionados. A região do rosto é restaurada rigidamente e comparada pixel a pixel nos testes.

É animação programática por recortes, complementada por ajustes de junção e reconstrução de áreas da roupa antes ocultas pelos braços; não são 45 desenhos inteiramente feitos à mão. Poses muito diferentes da base continuam sujeitas aos limites dessa técnica. Não houve nova geração do personagem em outro estilo.

```text
scripts/build_attacks.py       poses, articulação, exportação e dados dos normais
art/samurai/attack-rig.json     parâmetros das 45 poses (exportados pelo script)
art/samurai/movement-lock.json hashes da arte aprovada
public/sprites/samurai/
  stand_light.png … air_heavy.png       nove atlas transparentes P1
  stand_light-p2.png … air_heavy-p2.png nove atlas P2
  stand_light-00.png …                 45 células individuais
  stand_light-preview.png …           pranchas ampliadas
  attacks.json                         manifesto para o laboratório
  attacks-overview.png                 prancha de todas as poses
src/engine/geometry.ts         cápsulas, retângulos, espelhamento e interseção
src/engine/moves.ts            seleção da pose/fase pelo tick de combate
src/render/debug.ts           caixas sobrepostas, compartilhadas entre jogo/lab
tests/attacks.test.ts          combate dos nove normais, combos e geometria
tests/test_attack_art.py       imagens, transparência, identidade e lâmina
e2e/attacks.pw.mjs             ataques e combos executados no Chrome
```

`npm run art:attacks` reconstrói os novos PNGs, atualiza os dados dos normais e seus clips. Requer Python/Pillow/numpy, conforme `requirements-art.txt`. Não toca os PNGs nem o manifesto da movimentação aprovada. Os parâmetros-fonte das poses ficam em `specs()` no construtor; `attack-rig.json` é sua exportação legível.

## Depurador e validação

Execute `npm run dev` e abra `/art/samurai.html` ou **Animações** no jogo. O laboratório inclui as 22 sequências, seleção por quadro, pausa, avanço/retrocesso, zoom, paletas e duração/fase de cada pose. Ative **Hitboxes / hurtboxes**:

- Vermelho: cápsula ativa da lâmina.
- Verde: hurtboxes do corpo.
- Azul: pushbox da simulação.
- Amarelo tracejado: localização da lâmina em uma pose que não causa contato.

**Testar ataque selecionado** executa o golpe contra um alvo real do motor; os botões de combo executam entradas através do mesmo `Match`, com vida, stun, knockback e hitstop. São simulações de combate, não vídeos ou números de dano pré-calculados. A câmera lenta ajuda a inspecionar a passagem por cada fase. Na partida, **Caixas** mostra o mesmo desenho de depuração sobre ambos os lutadores.

Validação executável:

```sh
npm test
npm run build
npm run test:browser
```

Os testes cobrem os nove ataques e seus quadros, início/fim dos frames ativos, contato único, alcance e erros, espelhamento, defesa alta/baixa, hurtboxes por pose, colisão diagonal sem falso positivo, trocas simultâneas, combos terrestres, launcher, perseguição aérea, finisher, hitstop, retorno ao Idle e preservação da arte anterior. As capturas reais do Chrome ficam em `art/samurai/qa/attacks/`.

## Limites atuais

Defesa, dano, knockdown/KO, agarrão e especial ainda não têm animações finais próprias. Reutilizam poses do Samurai para preservar sua identidade, em vez de voltar ao boneco geométrico. Isso é provisório e não representa novas sequências produzidas nesta etapa. Agarrão e especial mantêm seus dados anteriores e não fazem parte dos nove normais com cápsulas novas. O balanceamento é inicial e não inclui um sistema completo de OTG, burst ou tech.
