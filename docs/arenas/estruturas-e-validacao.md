# Arenas vivas com continuação e plataformas — 27/11/2026

**Histórico anterior à mudança de Undertown:** [eventos-ambientais.md](eventos-ambientais.md) substitui os perigos, tempos e consequências abaixo. Undertown agora possui chão contínuo e acesso ao Mr. Smoothy; apenas Clover continua com plataformas e queda fatal. As capturas antigas `undertown-plataforma`, `undertown-borda-aberta` e `undertown-queda-ko` documentam a versão anterior e não são provas da versão atual. Câmera e áreas inferiores de Enies/God Valley permanecem.

Base: `arenas-pr19`, commit `b1131eb`. A pasta local `public/arenas/replacements/` foi preservada e não faz parte desta alteração.

## Regras disponíveis

**Arena viva** reúne a antiga interação e os antigos perigos caóticos. Avisos duram 64–100 ticks, há um contato de dano por lutador/evento e recarga de 420 ticks. Dano de detritos/descargas é não letal; ring-out e queda nas duas arenas de plataforma encerram o round. **Clássico** conserva as animações ambientais, com chão fixo e sem perigos. O identificador antigo `caotico` é normalizado para `interativo` ao carregar uma arena/sala.

| Arena | Estrutura jogável | Interação e vida |
| --- | --- | --- |
| Dojo | Tradicional | Alunos, folhas e painéis; piso enfraquece e causa um desequilíbrio curto após aviso. |
| Tenkaichi | Tradicional com ring-out | Público e bandeiras; borda marcada, queda animada e fim do round após impacto válido. |
| Cairo | Tradicional | Civis recuam, luminárias oscilam; poste/detritos urbanos sinalizados. Tempo de DIO congela a arena. |
| Enies Lobby | Dois andares por colapso | Mar, marinheiros e ponte rachando. Pisá-la após ruptura inicia descida para passarela inferior, sob os arcos da mesma ponte. Buster Call pode ocorrer embaixo, com aviso. |
| Esconderijo Uchiha | Piso principal e destruição progressiva | Sem plateia; poeira, teto/colunas e versão em ruínas. Pedras sinalizadas podem cair. |
| Anteiku | Tradicional | Chuva, pedestres e vidro quebrável; pequenos detritos com aviso. |
| Undertown | Base sobre fosso e três plataformas | Passarelas de manutenção de metal; moradores distintos, maquinário e descarga tecnológica. Laterais abertas. |
| God Valley | Dois andares por colapso | Fissuras e fragmentos; descida para o leito da mesma ravina. Destroços permanecem em cima e pedras ainda podem cair embaixo. |
| Exame dos Cavaleiros Reais | Formação rochosa em ravina e dois patamares | A rocha continua para baixo. Ruínas e saliências utilizáveis, observadores e cristais reagindo; descarga mágica delimitada. Laterais abertas. |

## Plataformas

O motor original continua resolvendo golpes, hurtboxes, pushboxes e inputs. Só o contato dos pés passa a aceitar superfícies adicionais. Atravessar por baixo é permitido; pousar exige cruzamento descendente da superfície. **↓ + salto** desce da plataforma. Caminhar/dash para fora inicia queda. Não há invulnerabilidade adicional. A altura de apoio acompanha o estado do lutador, incluindo a sombra.

As plataformas de Undertown têm alturas de 460 e 355 no espaço de combate; Clover usa 468. O piso permanece em 580. Clássico não cria essas superfícies. As coordenadas são determinísticas e integram o snapshot.

Somente **dois** mapas possuem esse formato. Em Arena viva, o piso de Undertown termina em x=245/1035 e o de Clover em x=150/1130. **O objetivo central é derrubar o adversário antes de ser derrubado. Cair elimina toda a vida e encerra o round**, mesmo com 1000 HP antes da queda. A câmera abre para mostrar as laterais e acompanha a trajetória. Após cruzar y=920, a queda termina em 22 ticks e registra uma única derrota por ring-out; não existe retorno automático, estoque de vidas nem dano parcial de 60 HP. O anúncio é `QUEDA · K.O.` e o ator derrotado permanece abaixo do cenário até o próximo round. O BOT tenta retornar à base e alcançar o nível do adversário. No Clássico, os dois mapas usam a composição original de chão contínuo, sem essa regra.

Em Clover, a formação central tem base geológica contínua até o fundo da ravina. Os patamares de pedra apoiam-se na formação, com ruínas, raízes e estratos. A ravina é uma adaptação do campo do Exame dos Cavaleiros Reais para o jogo, não uma ilha flutuante nem um local apresentado como canônico.

Undertown e Clover, em Arena viva, exigem **três rounds ganhos (melhor de cinco)**. Os outros mapas e o modo Clássico mantêm duas vitórias. O mesmo alvo de vitórias controla o fim da partida, os três marcadores do HUD, o resultado no servidor e a progressão do Arcade. O progresso salvo da torre aceita os placares novos e os anteriores.

## Continuação inferior

Enies e God Valley recebem uma transição de 84 ticks, com deslocamento vertical de 720 unidades. A câmera segue a descida e os lutadores mostram sua reação aérea, destroços e chegada. Os dois continuam no andar inferior até terminar o round. O combate e o cronômetro ficam pausados durante a transição; comandos de ataque não são acumulados. Projéteis anteriores são encerrados para não atravessar a troca de andar. A chegada aplica 8 de dano não letal a cada lutador, além do evento inicial quando houve contato. Existe apenas uma descida por round.

O nível inferior usa coordenadas locais de combate após a chegada para manter a compatibilidade das cinematográficas existentes. O estado `level=1` mantém arte, ambiente e eventos do andar inferior. Não existe retorno ao piso superior ou reset imediato à posição do buraco. No próximo round, a arena volta ao estado inicial.

As áreas inferiores foram criadas como **adaptações originais para o jogo**. A ponte e seu bombardeio foram estudados no [episódio 308 oficial de One Piece](https://one-piece.com/anime/308/index.html). A passarela inferior não é apresentada como local confirmado do anime. A ravina inferior de God Valley também é uma adaptação de gameplay. As plataformas não pretendem reproduzir layouts canônicos de episódios.

## Câmera e cobertura

O renderizador calcula o retângulo visível pela inversa da transformação final, incluindo zoom, rotação e shake. Céu, teto, módulos laterais e continuação do piso são pintados até cobrir esse retângulo. Há cobertura opaca também antes de terminar a decodificação. A descida desenha os dois andares em coordenadas conectadas e fecha a faixa entre eles. A câmera normal abre para acompanhar elevações; Supers mantêm suas próprias câmeras.

O overscan continua sendo extensão modular da arte; uma abertura extrema pode tornar a repetição lateral perceptível. A ausência de transparência é verificada pixel a pixel nos enquadramentos testados e não equivale a uma avaliação artística de todos os frames possíveis.

Nas duas arenas abertas, a **parte superior mantém `clover-open.png` e `undertown-open.png` nas proporções originais**. As pinturas maiores `clover-world.png` e `undertown-world.png` aparecem somente abaixo de y=720, prolongando a falésia/caverna durante a queda. A pintura inferior usa escala uniforme; não há divisão em colunas esticadas nem sobreposição das duas rodas/plataformas. A imagem superior inteira, 1280×720, é comparada pixel a pixel com a arte antiga no teste de navegador.

## Áudio, rede e desempenho

Os avisos, a descida e o impacto têm sons sintetizados originais. O protocolo é 5; ambos os clientes e o backend precisam da mesma build. Estado de perigo, apoios, andar e transição participam dos snapshots/hashes. Partículas e NPCs são calculados na renderização, sem escrever no combate. A parada de tempo congela os eventos; cinematográficas e capturas pausam perigos/descidas. Hitstop registra o evento e pausa a contagem do aviso.

As seis artes adicionais são pré-carregadas uma vez. Contagens de partículas e superfícies são limitadas. A validação automatizada de renderização não substitui medição de FPS em duas máquinas físicas de LAN.

## Validação e reprodução

- `node node_modules/vitest/vitest.mjs run --dir tests --maxWorkers=1 --testTimeout=15000`: **1.569 testes aprovados em 65 arquivos**, incluindo combate, inputs, personagens, torre e rede. O limite maior acomoda a simulação de 27 mil frames do teste de BOT durante a validação do navegador na mesma máquina.
- `tests/arenas.test.ts`: colisão das plataformas com os nove personagens, descida, dano único/não letal, ausência de ressurreição, hitstop, pausa cinematográfica, ring-out e hashes de duas cópias durante a descida.
- `tests/arena-sockets.test.ts`: duas conexões Socket.IO reais reproduzem a descida e a queda fatal com hashes iguais; usa o backend existente em uma instância isolada de teste.
- `tests/arena-specials.test.ts`: execução dos especiais existentes sobre os nove layouts, com posições finitas.
- `e2e/arena-structures.pw.mjs`: usa Match e Renderer reais na build de produção, registra os dois andares e verifica câmera em nove arenas. A matriz de Supers executa os nove personagens sobre os nove fundos e verifica restauração e posições finitas.
- `e2e/arenas.pw.mjs`: inicia partidas reais de Treinamento nas nove arenas e grava seus ambientes.

Capturas, vídeos WebM e resultados estão em `evidencias/estruturas/`. Os nomes `queda-meio`, `inferior` e `plataforma` identificam as provas das novas mecânicas. O inspetor local está em `art/arenas.html`; ele permite mover, atacar, provocar um aviso e observar a descida sem precisar acumular impactos.

Os arquivos `*-continuidade-antes.png` registram os defeitos anteriores de repetição; `*-continuidade-depois.png` e `*-queda-ko.png` mostram a composição corrigida. `*-dois-rounds.png` demonstra que duas vitórias ainda não encerram a partida. Treinamento mantém a derrota por queda mesmo com vida infinita; a vida só retorna no próximo round.

Validação final: TypeScript e build de produção aprovados; quatro verificações Playwright aprovadas (três no conjunto e a captura estrutural repetida após um bloqueio temporário de arquivo no Windows). Inclui 81 combinações de Super/arena, nove partidas reais de Treinamento, cobertura opaca nos enquadramentos registrados, descidas jogáveis, comparação integral da imagem superior e término da partida somente após três vitórias nos mapas abertos. Não foi realizado teste entre duas máquinas físicas; as duas conexões Socket.IO são locais.

## Arquivos principais

- `src/engine/arena-layouts.ts`: superfícies, altura de apoio, queda através de plataforma e parâmetros de descida.
- `src/engine/arenas.ts`: eventos, dano ambiental, ring-out, nível inferior e transição.
- `src/engine/combat.ts`: contato com superfícies e pausa de combate durante descida.
- `src/render/arena.ts`, `arena-life.ts`, `arena-structure.ts`, `renderer.ts`: cobertura, pisos, plataformas, partículas e câmera.
- `src/audio/sound.ts`: aviso, descida e chegada.
- `src/ui/arena-picker.ts`, `src/game/app.ts`, `src/game/session.ts`, `server/rooms.ts`: regras unificadas em seleção local e LAN.
- `src/net/protocol.ts`, `scripts/net_version.mjs`: compatibilidade da simulação.
- `public/arenas/enies-lower.png`, `godvalley-lower.png`: artes inferiores, geradas pelo modo integrado de imagegen e revisadas antes da integração.
- `public/arenas/clover-open.png`, `undertown-open.png`: parte superior; `clover-world.png`, `undertown-world.png`: extensão inferior. Assets originais produzidos com o modo integrado de imagegen. Direção dos prompts: preservar composição e estilo pixel art da referência; ampliar ravina/caverna com geologia contínua, raízes e profundidade; não repetir plataformas, rodas, prédios ou faixas; sem interface ou lutadores. A integração final conserva as imagens antigas em cima e utiliza as novas somente embaixo.

## Testar no XAMPP

Abra `http://localhost/2025/Jogo_de_Luta_Sem_Nome/` (ou o alias `/2025/M.S.F.D/`, quando configurado), entre em Treinamento, selecione a arena e mantenha **Arena viva**. Undertown e Clover permitem subir nas plataformas e descer com ↓ + salto. Golpes fortes enfraquecem Enies/God Valley; o aviso antecede a ruptura. Evite a região ou atravesse a seção rompida para iniciar a descida.

Para inspeção rápida: `http://localhost/2025/Jogo_de_Luta_Sem_Nome/art/arenas.html`. A prévia usa o mesmo motor e não abre servidor multiplayer. A publicação utiliza `npm run build:lan`; o backend existente deve ser reiniciado quando mudar a versão do motor.
