# Kaneki Ken · Especiais Rinkaku

| Comando | Técnica | Resultado |
| --- | --- | --- |
| ↓ → + J/K/L | Kagune Grab | Tentativa de captura com três alcances. Após prender o alvo, J puxa, K arremessa e L lança. U preserva a captura universal. |
| ↓ ← + J/K/L | Kagune: Four Swords | Ataque ascendente com defesa normal. Se conectar em um alvo elegível, Kaneki estala o dedo e usa os Kagunes restantes para finalizar. |
| ↓ ↓ + J/K/L | Rinkaku Rush | Avanço no chão. A ponta tem prioridade quando pode capturar. O contato corporal funciona como golpe bloqueável. |

Frente e trás acompanham o lado de Kaneki. Solte ↓ entre os dois toques do Rush. **R** ativa [Centipede — Ghoul’s Awakening](KANEKI-CENTIPEDE.md) com a barra cheia.

O estalo usa os três cels do anexo final. O importador converte o fundo preto em transparência e alinha os cels ao pivô padrão. O quadro do estalo mantém a câmera normal e dispara um único som original sintetizado por Web Audio ao entrar no segundo cel. No laboratório, clique em **Ativar som** e reproduza Four Swords. As animações WebP são silenciosas.

## Arquivos

- `src/engine/kaneki-specials.ts` contém os tempos, alcances, comandos e eventos de cada variante. `src/engine/combat.ts` aplica colisões e captura no motor compartilhado.
- `src/engine/kaneki-combat.ts`, `src/engine/kagune.ts`, `src/render/kagune.ts` e `src/render/kaneki-presentation.ts` montam as trajetórias dos quatro Kagunes e usam as âncoras do atlas.
- `art/kaneki-special-source/snap.png` é o anexo final. As outras três folhas nessa pasta são as poses novas. `scripts/pack_kaneki_specials.py` produz `public/sprites/kaneki/specials.png` e `src/data/kaneki-special-art.json`.
- `art/kaneki-combat.html` permite alternar os ensaios, espelhar a direção, inspecionar as caixas e avançar por tick. `scripts/capture_kaneki_combat.mjs --especiais` gera os seis WebPs em `public/previews/kaneki`.
- `src/audio/sound.ts` sintetiza o estalo. `src/engine/state.ts`, `scripts/net_version.mjs` e `src/game/app.ts` preservam o estado e evitam reproduzir o mesmo estalo novamente após uma ressincronização.
- `src/engine/bot.ts` e `src/ui/catalog.ts` registram as novas decisões do BOT e os comandos de treinamento.

Kagune Grab tem nove finalizações, Four Swords tem três e cada força do Rinkaku Rush tem três próprias. Consulte [o guia de chain grabs](KANEKI-CHAIN-GRABS.md) para alcance, escolhas, resistência e limite de tempo.

## Validação

Os testes de simulação cobrem as nove variantes contra Samurai, Dio, Goku, Luffy e Sasuke, os dois sentidos, comando de dois toques, cancelamentos confirmados, interrupção, arena, KO, colisões e a restauração da captura com o mesmo hash. No Chrome através do Apache, o teste verificou uma fonte de áudio Web Audio ativa exatamente no segundo cel e a câmera em 1×. Dois clientes Chrome independentes no mesmo computador receberam o mesmo dano e o mesmo quadro do estalo pelo servidor LAN. A partida entre dois computadores físicos ficou pendente.

