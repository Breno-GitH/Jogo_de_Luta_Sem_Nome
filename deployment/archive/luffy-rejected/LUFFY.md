# Luffy pré-timeskip · sprite-base

O modelo usa células transparentes de 256 × 256, 130 pixels visíveis, pivô (128, 224) e espelhamento pelo renderizador do jogo. A postura tem uma base aberta, joelhos flexionados e guarda assimétrica. A comparação em tamanho idêntico usa as bases do elenco. A guarda e a direção vêm do Goku, o contraste das dobras vem do Samurai e a separação dos volumes de luz e sombra vem do Dio.

O chapéu de palha e a elasticidade orientam a identidade. O recorte da fase segue o arco de Enies Lobby. Colete vermelho aberto, shorts azuis e faixa amarela seguem a direção visual fornecida pelo usuário. [Perfil oficial de Luffy](https://one-piece.com/character/luffy/index.html) · [Enies Lobby](https://one-piece.com/story/enies_lobby/index.html).

Abra [o laboratório](http://localhost/jogo-luta/art/luffy.html) para comparar a escala, inspecionar a pose, ver os testar a geometria elástica. A seleção oferece o protótipo no Treinamento, Contra BOT e lobby LAN. O protótipo pode se deslocar, pular e receber golpes pela simulação existente. Um único desenho representa os estados até que sejam produzidas suas animações. Ataques, especiais e Super estão pendentes. A escolha no Arcade fica indisponível nesta etapa.

- `scripts/luffy_drawing.py` contém contornos e sombreamento da pose. `scripts/build_luffy.py` empacota os desenhos, a paleta e as prévias. Execute `node scripts/run_art.mjs scripts/build_luffy.py` para reproduzir os PNGs.
- `public/sprites/luffy/` contém base, paleta P2, silhueta, corpo sem o braço da frente, punho, prévias e metadados.
- `src/data/luffy*.json` define física, hurtboxes, atlas e parâmetros elásticos. `src/engine/elastic.ts` calcula a curva, espelhamento e cápsulas potenciais. `src/render/elastic.ts` rasteriza o segmento entre o ombro e o punho em pixels inteiros. Na bancada, as caixas ofensivas permanecem inativas.
- `art/luffy.html` e `src/luffy-lab.ts` implementam o laboratório. O registro, a apresentação, a seleção, o lobby, o build e a impressão digital da simulação incluem a nova entrada.
- `tests/luffy.test.ts` e `tests/test_luffy_art.py` verificam integração, geometria, preservação do elenco, transparência e alinhamento.

A revisão 5 substitui a arte por novos contornos e uma guarda de mão aberta. A base anterior fica em art/luffy/base-rev4.png para a comparação. O planejamento mantém Luffy como zoner elástico, com Gomu Gomu no Pistol, Gatling e Bazooka. A Super planejada usa R e vai de Gear 2 a Gear 3.

A revisão 6 parte da prancha de Enies Lobby com o chapéu nas costas. No desenho anterior, a aba e a copa definiam a maior parte da silhueta da cabeça. Os membros e os tecidos também usavam poucas áreas de sombra para explicar as articulações. O novo código desenha o rosto e as mechas de forma independente e compõe o chapéu atrás do ombro. Os recortes de luz nos joelhos, antebraços, punhos e sandálias acompanham seus contornos. As coordenadas das articulações são metadados para uso futuro e não deformam os pixels.

A base da revisão 5 e seus fontes estão em `art/luffy/archive-rev5/`. A comparação em `art/luffy/reference-comparison.png` usa a ilustração apenas para avaliação. Para regenerá-la, execute o gerador com `--reference` e o caminho da prancha original. A pose-base tem 130 px visíveis em uma célula de 256 × 256 e mantém o pivô (128, 224).
