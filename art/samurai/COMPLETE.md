# Samurai: especiais, reações e captura

Preserva os 90 quadros anteriores e adiciona 203 em 36 sequências. Exportações: `public/sprites/samurai/complete.json`, PNGs com nome de clip e versão `-p2`. Metadados em `src/data/animations.json`. Rig em `complete-rig.json`; gerador `scripts/build_complete.py`. `complete-preview.png` usa as células reais ampliadas 2× com nearest-neighbor.

## Tempos e decisões

Ticks de combate a 60 Hz. L/M/H = J/K/L. Dano base antes da redução de combo. A notação de tempos é startup/ativos/recuperação.

- Saque L: **7/4/18**, dano 75; avanço 10 px/tick nos ticks 4–11.
- Saque M: **10/5/24**, dano 100; avanço 13 nos ticks 5–16.
- Saque H: **14/6/32**, dano 125; avanço 16 nos ticks 7–22.
- Crescente L: **5/5/27**, dano 90; lançamento −12, salto próprio −8; proteção superior nos ticks 0–2.
- Crescente M: **7/6/33**, dano 115; lançamento −15, salto −10; proteção completa nos ticks 0–6.
- Crescente H: **10/7/42**, dano 140; lançamento −17, salto −12; proteção completa nos ticks 0–11.
- Contra: entrada 6, janela 18, recuperação sem ativação 24. Resposta **4/4/16**, dano 110, hitstop 11. Verifica posição frontal e tipo do ataque. Baixos, agarrões e Ultimate o vencem.
- Mil Cortes: R, custo 100; starter **10/3/35**, dano 55. Captura de 66 ticks; oito cortes de 18 nos ticks 5,11,17,23,29,35,41,47; final de 100 no tick 54. Recuperação própria de 18 ticks. Sem combo anterior: 299 de dano em dez impactos.
- Agarrão: U, **5/2/28** na tentativa. Captura 22 ticks, dano 120 no tick 12, retorno 12 ticks. Corte simultâneo vence agarrão. Alvos em ar, stun, derrubados ou levantando não podem ser agarrados.

Saque para de avançar ao conectar. Crescentes trocam proteção inicial por risco de recuperação, sem cancelamentos. Normais terrestres cancelam após contato em especiais/Ultimate. DP tem prioridade sobre QCF em entradas sobrepostas. Comandos relativos ao facing expiram. Especiais comuns custam zero; Ultimate usa a barra inteira.

Na captura o cronômetro congela e entradas são descartadas. O par é posicionado dentro dos limites da arena. Ultimate só captura ao acertar; defesa e erro conservam o custo e a recuperação. O alvo não morre antes do finalizador; o round só encerra no fim da sequência. Sobreviventes caem, ficam derrubados e levantam com proteção. Um salto cancelado do launcher possui oito ticks de perseguição, sem aumentar a hitbox da katana.

## Animações novas

Ações: entrada (12), provocação (8), vitória (12), tentativa de agarrão (5), agarrando (6), sendo agarrado (5), retorno (4), saques L/M/H (6 cada), crescentes L/M/H (7 cada), contra entrada (3), espera (4), falha (4), resposta (6), Ultimate ativação (6), cortes (12), finalização (6), retorno (4).

Reações: defesa em pé/agachada (4 cada), impacto em pé/agachado (3 cada), dano leve (4), médio (5), forte (6), agachado (4), aéreo (4), lançado (4), queda (4), derrubado (4), levantando (6), KO (6), derrota (6).

Entrada caminha com a katana embainhada, para, desembainha e assume guarda. Vitória usa pano, recolhe a lâmina e vira parcialmente as costas. Provocação abaixa a arma e gesticula com a mão livre. Queda/levantamento combinam articulação e rotação rígida. O tecido no chão é recomposto a partir dos pixels originais para não sustentar o corpo no ar. A vista de costas e a passagem ao chão mantêm limitações de um rig sobre uma única perspectiva.

Holds individuais, loop/clamp explícito e pivô fixo. `reactionFor` seleciona a mesma pose usada por apresentação e hurtboxes. Ataques usam cápsula de raio 3 ao longo da katana e caixas corporais por pose. Defesa conserva a postura capturada no impacto. A física não depende de carregar PNGs nem lê pixels em runtime.

Efeitos: `public/sprites/fx/samurai-fx.png`, sete linhas de seis células de 64×64, alpha binário. Impacto, defesa, saque, crescente, contra, Ultimate e ativação. Renderizados separadamente; não fazem parte do corpo do Samurai.

## Verificação

Testes de comandos dos dois lados, expiração/prioridade, cancelamentos, alcance/dano por versão, anti-aéreo, invulnerabilidade limitada, contra, baixos/agarrões, confirmação/falha do Ultimate, energia, impactos sincronizados, KO após finalização, agarrão/soltura, levantamento, entrada e provocação. Os testes anteriores preservam os nove normais e combos de 205/257 de dano.

Python verifica hashes da arte aprovada, transparência, células, paletas, chão, poses distintas, durações, hurtboxes e lâminas ativas sobre pixels de metal. Chrome percorre os 293 quadros, paletas, controles do laboratório, cenários reais e teclado na partida. Capturas em `art/samurai/qa/complete/`. Isso não substitui revisão artística nem playtest humano de balanceamento.
