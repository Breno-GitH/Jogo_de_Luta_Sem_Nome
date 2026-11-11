# Kaneki Ken · Agarrões encadeados

## Agarrão universal

**U** abre o conjunto clássico. K encerra com um arremesso. J abre Abraço Rinkaku, Pêndulo Vermelho e Queda da Centopeia. L abre Laço Aéreo, Arremesso Giratório e Queda Meteórica. A primeira escolha dura 30 ticks ativos e a segunda dura 36.

## Kagune Grab

**↓ → + J/K/L** define a força do disparo do Kagune. A extensão nominal da ponta é 278, 330 ou 382 px de acordo com a força. A colisão usa apenas a ponta em movimento durante os quadros ativos. L tem a preparação e recuperação mais longas.

Depois da captura, cada primeira escolha abre uma segunda:

- **J** Puxar. As finalizações J/K/L são Rinkaku Combo, Red Spiral e Centipede Drop.
- **K** Pêndulo. As finalizações J/K/L são Quick Swing, Double Swing e Red Catapult.
- **L** Suspensão aérea. As finalizações J/K/L são Aerial Snatch, Rinkaku Cyclone e Centipede Meteor.

O relógio da captura começa no contato e inclui os 300 ticks de simulação, mesmo durante pausas de impacto. Ele continua durante as escolhas e a finalização. Quando uma finalização escolhida já não cabe no tempo restante, a captura muda para a saída simples. No limite, o alvo é solto e a recuperação começa. A HUD mostra o tempo e o próximo botão de resistência. O defensor precisa acertar três comandos distintos, com 12 ticks mínimos entre tentativas. A sequência começa com a força usada no disparo e roda em J, K, L. A resistência pode ser usada nas janelas de escolha e na preparação inicial dos finalizadores de queda.

## Four Swords

**↓ ← + J/K/L** prepara o Four Swords. Após o quarto impacto, aparecem 23 ticks ativos de escolha. J recolhe e prepara pressão terrestre, K arremessa lateralmente e L permite um salto cancelado para perseguir o alvo. Se a janela acabar, sai o arremesso padrão. Um KO ou o limite de combo encerra o golpe pelo caminho padrão. O estalo e seu som permanecem sincronizados no segundo quadro.

## Rinkaku Rush

**↓ ↓ + J/K/L** determina a variante da investida. Depois de uma captura pela ponta, os botões J/K/L oferecem:

- **Rush J** Puxão de Investida, Arremesso Rápido e Lançamento Curto.
- **Rush K** Reposicionamento pelas costas, Arremesso Giratório e Lançamento Aéreo.
- **Rush L** Arrasto Rinkaku, Arremesso Pesado e Arremesso Descendente.

As janelas têm 20, 26 e 30 ticks ativos. O contato corporal funciona como golpe. Se o jogador não escolher após uma captura pela ponta, a variante executa seu arremesso padrão.

## Conversão para Centipede

Com a barra cheia, **R** converte uma captura ainda válida nas janelas de escolha de U, Kagune Grab e Rinkaku Rush pela ponta. O escape bem-sucedido e o fim do prazo têm prioridade. Os detalhes estão em [Centipede — Ghoul’s Awakening](KANEKI-CENTIPEDE.md).

## Entrada, arte e testes

O teclado e o controle enviam os mesmos comandos ao simulador. A HUD usa as teclas configuradas ou os botões do gamepad. Para repetir uma escolha, como J → J, solte o botão antes do novo pressionamento. A seleção, os relógios, a resistência, o dano, as posições e o encerramento são processados pelo motor autoritativo do LAN.

O [laboratório](http://localhost/2025/Jogo_de_Luta_Sem_Nome/art/kaneki-combat.html) tem as 21 novas finalizações, o teste de resistência e o teste do limite de tempo. Os WebPs usam quadros capturados no laboratório e são silenciosos. As sete folhas de produção estão em `public/sprites/kaneki/stage5-*.png`. Os PNGs-fonte e os [prompts do ImageGen integrado](art/kaneki-stage5-source/PROMPTS.md) estão em `art/kaneki-stage5-source`.

Gere as folhas com `node scripts/run_art.mjs scripts/pack_kaneki_stage5.py`. Depois de publicar, gere as prévias com `node scripts/capture_kaneki_combat.mjs --stage5`.

A validação inclui 1.084 testes de simulação, seis testes Chrome e dois clientes LAN no mesmo computador. O teste LAN executou o Red Catapult com um Kagune Grab L à distância e quebrou uma segunda captura por resistência. O teste com dois computadores físicos ficou pendente.

