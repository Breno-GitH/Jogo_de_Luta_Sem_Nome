# Sasuke Uchiha · Hebi

A etapa adiciona Sasuke Hebi ao treinamento, ao versus, à seleção do Arcade e ao LAN. O Arcade conserva os três confrontos. Sasuke combina taijutsu curto, chutes de alcance médio e a Kusanagi nos ataques fortes. A altura visível da pose neutra é de 128 px.

## Controles

- **J / K / L** usam os três normais em pé. Segure **S** para os normais baixos e use os mesmos botões durante o salto.
- **J → K → L** encadeia em pé. **S + J → S + K → S + L** encadeia agachado.
- Acerte **S + L** para lançar e pressione **W** durante a janela de cancelamento. No ar, **J → K → L** termina com o corte descendente e derruba o alvo.
- Segure a direção oposta ao adversário para defender. Segure **S** junto dela para a guarda baixa.

A transformação da Marca da Maldição e o Kirin ficam para as próximas etapas.

## Arte e integração

- [Base](public/sprites/sasuke/base.png), [movimentação](public/sprites/sasuke/movement.png), [normais](public/sprites/sasuke/normals.png) e [reações](public/sprites/sasuke/reactions.png) usam células transparentes de 256 px, pivô comum e espelhamento do renderizador.
- Os 45 desenhos de movimento seguem as contagens pedidas. Os nove normais têm quatro cels cada, com duração definida em ticks.
- [Configuração do lutador](src/data/sasuke.json), [tempos e atributos dos normais](src/data/sasuke-normals.json), [tempos de locomoção](src/data/sasuke-clips.json) e [caixas e contatos por cel](src/data/sasuke-frames.json).
- [Integração de combate](src/engine/sasuke-data.ts), [apresentação](src/render/sasuke-presentation.ts) e [brilho da lâmina](src/render/sasuke-fx.ts). A Kusanagi é desenhada nas poses e o brilho é uma camada separada.
- [Pranchas e prompts](art/sasuke-hebi-source/PROMPTS.md) foram produzidos com o ImageGen integrado. Regere a exportação com `node scripts/run_art.mjs scripts/pack_sasuke_hebi.py`.

[Abra o laboratório](http://localhost/2025/Jogo_de_Luta_Sem_Nome/art/sasuke.html) para tocar os movimentos e combos, espelhar a luta, pausar por tick ou mostrar as caixas.

## Arquivos de integração e validação

O registro usa [characters.ts](src/engine/characters.ts) e [protocol.ts](src/net/protocol.ts). A seleção, as telas e o Arcade usam [catalog.ts](src/ui/catalog.ts), [screens.ts](src/ui/screens.ts), [app.ts](src/game/app.ts), [session.ts](src/game/session.ts) e [style.css](src/style.css). [presentation.ts](src/render/presentation.ts) e [renderer.ts](src/render/renderer.ts) escolhem o atlas e desenham a lâmina. [vite.config.mjs](vite.config.mjs) registra a página do laboratório e [net_version.mjs](scripts/net_version.mjs) inclui os dados na versão da simulação.

A cobertura nova está em [combate e movimento](tests/sasuke.test.ts), [atlas e pontos de contato](tests/test_sasuke_hebi_art.py), [navegador](e2e/sasuke.pw.mjs) e [LAN](e2e/lan/game.pw.ts).

## Etapa 2 — Especiais

Os comandos são terrestres e usam direções relativas à orientação de Sasuke. A segunda pressionada de baixo exige uma soltura entre os toques. A lista de golpes do jogo acompanha o remapeamento de teclas.

- **↓ → + J/K/L** executa Chidori Senbon (três agulhas), Chidori Eisō (lança de alcance crescente) ou Chidori (avanço com descarga na mão).
- **↓ ← + J/K/L** executa Katon: Gōkakyū (bola de fogo), Hōsenka (três trajetórias) ou Gōryūka (dragão de fogo ascendente).
- **↓ ↓ + J/K** executa Serpentes ou Chidori Nagashi. As serpentes prendem brevemente por hitstun com baixo empurrão. Nagashi é vulnerável e deixa tempo para encaixar um normal no acerto próximo.
- **↓ ↓ + L** está reservado à Marca da Maldição nível 2.
- Normais terrestres cancelam em especial na janela configurada após confirmação de acerto. Projéteis já lançados seguem sua trajetória. A interrupção da preparação impede novas emissões e elimina o contato corpo a corpo.

Gōryūka forma nuvens temporárias na arena quando o dragão é lançado. O efeito usa o relógio da simulação e é sincronizado no multiplayer. A mecânica climática do Kirin fica para outra etapa.

### Arte e código

- [Pranchas de origem](art/sasuke-special-source/PROMPTS.md), [atlas corporal](public/sprites/sasuke/specials.png), [atlas de efeitos](public/sprites/sasuke/special-effects.png) e [folha de poses](public/sprites/sasuke/specials-contact.png). São 32 desenhos corporais e 12 cels de efeitos em atlas. Os arcos elétricos são desenhados em pixels pelo renderizador.
- [Balanceamento](src/data/sasuke-specials.json), [âncoras e caixas](src/data/sasuke-special-frames.json), [definições de combate](src/engine/sasuke-specials.ts) e [efeitos](src/render/sasuke-special-fx.ts).
- Execute `node scripts/run_art.mjs scripts/pack_sasuke_specials.py` para exportar os atlas. Use `node scripts/capture_sasuke_specials.mjs` e `node scripts/run_art.mjs scripts/compose_sasuke_specials.py` com o Apache atualizado para recriar a [prévia animada](deployment/audit/sasuke-specials/especiais-em-combate.webp).
- Abra o [laboratório do jogo](http://localhost/2025/Jogo_de_Luta_Sem_Nome/art/sasuke.html) e escolha a técnica. Os controles permitem espelhar, pausar, avançar um tick e mostrar as caixas.

### Validação

- [Testes de combate](tests/sasuke-specials.test.ts) cobrem os oito especiais contra Samurai, Dio, Goku e Luffy dos dois lados. Também cobrem guarda, interrupção, emissão única de cada projétil, reserva do comando, cancelamento, pressão de curta distância e determinismo do dragão e das nuvens.
- [Validação dos atlas](tests/test_sasuke_special_art.py) confere desenho único, alfa binário, margens, pivô e âncoras.
- [Testes de navegador](e2e/sasuke.pw.mjs) conferem animação e dano no laboratório e o acesso ao Sasuke pelo treinamento. [Testes LAN](e2e/lan/game.pw.ts) usam dois clientes no mesmo computador atrás do Apache.
