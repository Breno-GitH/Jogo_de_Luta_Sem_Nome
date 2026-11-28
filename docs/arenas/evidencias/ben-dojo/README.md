# Cidade de Baixo, Mr. Smoothy e dojo — evidências reais

Capturas do `Match` e `Renderer` reais, por `art/arenas.html`, em 28/11/2026. Os botões do inspetor apenas facilitam repetir estados; os eventos, a subida e as passagens também funcionam nas partidas normais. As regras e referências estão em [eventos-ambientais.md](../../eventos-ambientais.md).

## Comparação e áreas

- Antes da revisão: as capturas históricas de Undertown em [estruturas/](../estruturas/) com nomes `undertown-plataforma`, `undertown-borda-aberta` e `undertown-queda-ko` mostram a estrutura de plataformas que foi substituída.
- Depois: [Undertown intacta](undertown-intacta.png) mostra o piso contínuo e o acesso integrado à arquitetura. [Mr. Smoothy intacto](smoothy-intacto.png) mostra a nova praça diurna.
- Elevador: [acesso exposto](elevador-exposto.png), [embarque](elevador-embarque.png), [subida](elevador-subida.png), [chegada](elevador-chegada.png) e [vídeo da transição](elevador-transicao.webm).
- Retorno: [descida](elevador-retorno-descida.png), [Cidade de Baixo restaurada](elevador-retorno-cidade.png) e [vídeo do retorno](elevador-retorno.webm).
- Dojo: [salão](dojo-hall.png), [sala de treino](dojo-west.png), [varanda](dojo-veranda.png), [jardim](dojo-garden.png), seus arquivos `-evento.png` e [vídeo das passagens](dojo-varanda-jardim.webm).
- Passagem por impacto: [voo do atingido](dojo-golpe-voo.png), [aterrissagem](dojo-golpe-aterrissagem.png) e [vídeo de golpe real e perseguição](dojo-impacto-entre-salas.webm). Caminhar até a porta não troca de sala.

## Perigos e consequências

Cada nome abaixo possui cinco PNGs (`-origem`, `-aviso`, `-acao`, `-impacto`, `-consequencia`) e um WebM. Os vídeos registram a progressão real de preparação, aviso, movimento, contato e destroços:

- Mercado: `alien-sign`, `pressure-pipe`, `cargo-cart`, `alien-overload`.
- Praça: `smoothie-spill`, `smoothy-sign`, `patio-collapse`, `delivery-cart`.

[eventos.json](eventos.json) registra HP, terreno resultante, alfa dos atlas e tempos de desenho. [supers.json](supers.json) registra 54 combinações: nove lutadores nas duas áreas de Ben e nos quatro ambientes do dojo. Os 18 arquivos `super-market-*.png` / `super-smoothy-*.png` mostram um quadro real de cada Super nas duas áreas, e não simulações desenhadas para a documentação.

Os atlas finais estão em `public/sprites/arenas/events/`; os prompts e a origem dos recursos selecionados estão em [connected-areas-art.json](../../connected-areas-art.json). Versões intermediárias rejeitadas não são carregadas pelo jogo.

Dois clientes Socket.IO foram testados no mesmo computador. Uma sessão com dois computadores físicos continua sendo uma validação externa pendente. A arquitetura usa coleções de atores na subida; BRAWL de quatro jogadores não foi implementado nesta etapa.
