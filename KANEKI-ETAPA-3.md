# Kaneki Ken · Etapa 3

Kaneki entra no elenco com o perfil de movimentação aprovado e nove normais. J e K usam taijutsu. L usa um Kagune em pé ou no ar e dois Kagunes no lançador agachado. Cada ataque tem seis desenhos corporais completos. As pontas e as regiões expostas são calculadas a partir da curva desenhada.

## Comandos e regras de captura

- **U** tenta a captura terrestre com o Kagune inferior dianteiro. Agache para usar o inferior traseiro. Ambos seguem o mesmo comando universal do elenco.
- **L aéreo** só se converte em captura nos três primeiros ticks ativos contra um alvo aéreo já em hitstun com pelo menos dois acertos. Usa o Kagune superior traseiro na subida ou o superior dianteiro na descida. Fora dessas condições, resolve como um golpe normal.
- **J** aproxima o adversário e deixa tempo para J → K → L. **K** arremessa para frente e derruba. **L** lança e oferece uma janela de Jump Cancel se Kaneki estiver em solo.
- A escolha tem 24 ticks após o contato. Uma escolha apertada durante a confirmação fica no buffer. Se a janela acabar, sai um arremesso de 78 de dano bruto. J, K e L causam respectivamente 27, 92 e 54 de dano bruto. O escalonamento já usado pelo motor vale para as três saídas.
- Um alvo só pode ser capturado uma vez no mesmo combo. O cancelamento de K em pé para U exige confirmação e o alvo ainda em solo e vulnerável à captura. Guarda comum pode ser agarrada. Alcance, salto e invulnerabilidade continuam valendo.
- A simulação LAN armazena o tentáculo, a posição inicial, a decisão e a fase da captura no estado compartilhado. Só o jogador que iniciou a captura escolhe a saída.

## Arte e inspeção

- [Laboratório de combate](http://localhost/2025/Jogo_de_Luta_Sem_Nome/art/kaneki-combat.html) com pausa, avanço por tick, seleção de adversário e caixas.
- [Atlas de combate de Kaneki](public/sprites/kaneki/combat.png) com 54 poses de ataque, 12 de captura e 12 de reação.
- [Puxar](public/previews/kaneki/puxar.webp), [arremessar](public/previews/kaneki/arremessar.webp) e [lançar](public/previews/kaneki/lancar.webp), capturados no motor.
- [Nova provocação do Sasuke Hebi](public/previews/sasuke-final/provocacao.webp) e [Marca II](public/previews/sasuke-final/provocacao-marca-ii.webp). O gesto usa três desenhos próprios por forma, com o dedo chamando e o queixo erguido.
- [Prompts de Kaneki](art/kaneki-combat-source/PROMPTS.md) e [de Sasuke](art/sasuke-final-source/PROMPTS.md), produzidos com o ImageGen integrado. `node scripts/run_art.mjs scripts/pack_kaneki_combat.py` reproduz os atlas. `node scripts/capture_kaneki_combat.mjs` captura as prévias de um build já publicado.

## Arquivos centrais

- [Golpes e trajetórias](src/engine/kaneki-combat.ts), [simulação de captura](src/engine/combat.ts), [estado de replay](src/engine/state.ts), [curvas dos Kagunes](src/engine/kagune.ts) e [registro LAN](src/net/protocol.ts).
- [Apresentação](src/render/kaneki-presentation.ts), [desenho em luta](src/render/renderer.ts), [catálogo](src/ui/catalog.ts) e [provocação de Sasuke](src/render/sasuke-animations.ts).
- [Testes de combate](tests/kaneki-combat.test.ts), [arte](tests/test_kaneki_art.py), [navegador](e2e/kaneki-combat.pw.mjs) e [LAN](e2e/lan/game.pw.ts).

## Validação

Passaram 971 testes de simulação e cinco de arte. Os nove normais foram exercitados contra Samurai, Dio, Goku, Luffy e Sasuke. Os testes cobriram os dois lados, defesa, alcance, erro, salto, interrupção, quatro tentáculos, expiração da escolha, KO, recuperação e os combos descritos acima.

No build do Apache, os testes de navegador verificaram as três continuações, os nove normais, a captura pelo teclado no Treinamento, a movimentação anterior e a nova provocação de Sasuke nas duas formas. Dois processos independentes do Chrome executaram J, K e L por Socket.IO, com os mesmos resultados no servidor e nos clientes. A versão publicada do frontend e do backend é `2c503406e76781e33f22ed69`. O teste com dois computadores físicos permanece pendente.
