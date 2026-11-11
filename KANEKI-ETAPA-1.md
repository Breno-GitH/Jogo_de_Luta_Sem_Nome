# Kaneki Ken · Etapa 1

Kaneki usa a aparência de cabelo branco da fase final de Tokyo Ghoul. O sprite tem roupa preta com sombras em cinza, máscara ghoul dentada, um olho vermelho exposto e uma guarda assimétrica. A ficha `kaneki` fica no registro de prévias do projeto. Nesta etapa, acesse o personagem pelo [laboratório no XAMPP](http://localhost/2025/Jogo_de_Luta_Sem_Nome/art/kaneki.html).

## Arte e inspeção

- [Sprite-base](public/sprites/kaneki/base.png) e [atlas do corpo](public/sprites/kaneki/idle.png). Os seis desenhos usam células transparentes de 256×256, escala 1× e pivô (128, 224), com alturas entre 129 e 134 px.
- [Atlas de poses do Kagune](public/sprites/kaneki/kagune-poses.png), [prancha com os seis desenhos de Idle](public/previews/kaneki/prancha.png), [comparação com Sasuke](public/previews/kaneki/escala.png) e [Idle ampliado](public/previews/kaneki/idle-ampliado.png). As poses do Kagune são capturas do desenho em tempo real, separadas do atlas corporal.
- O laboratório alterna ensaios, escolhe cada tentáculo, permite testar a camada dianteira, espelha, reduz a velocidade, avança por tick ou desenho e exibe origem, ponta e pivô.
- [Fonte e prompt exato](art/kaneki-source/PROMPTS.md). O corpo foi gerado com ImageGen integrado e empacotado sem interpolação. O Kagune é desenhado no Canvas a partir de curvas, largura e paletas próprias.

## Integração

[Registro visual](src/engine/character-previews.ts), [metadados do atlas](src/data/kaneki-art.json), [controlador Rinkaku](src/engine/kagune.ts), [renderização](src/render/kagune.ts), [visualizador](src/kaneki-lab.ts) e [entrada HTML](art/kaneki.html).

Cada tentáculo expõe origem, eixo da curva, raios, ponta, fase e camada. `move` configura abertura e duração por tentáculo. `interrupt` recolhe todos a partir do ponto em que estavam e limpa a camada dianteira. A geometria fica disponível para futuras colisões e agarrões. O corpo usa o `Animator` existente, com 72 ticks por ciclo de seis desenhos.

Para reexportar o corpo, execute `node scripts/run_art.mjs scripts/pack_kaneki.py`. Para capturar os atlas compostos e as prévias, use `node scripts/capture_kaneki.mjs URL_BASE` com o laboratório servido. A URL precisa terminar em `/`.

## Validação

[Testes da animação e do controlador](tests/kaneki.test.ts), [testes dos PNGs](tests/test_kaneki_art.py) e [teste de navegador](e2e/kaneki.pw.mjs). A inspeção cobre pivô, contato dos pés, olho ghoul, escala, transparência, espelhamento, independência dos tentáculos, camadas, extensão e recolhimento.

Movimentação de combate, ataques, agarrões, colisões do Kagune e Super ficam para as próximas etapas.

A versão publicada passou no teste Chrome pelo Apache. O teste compara os pixels da camada dianteira com os da camada traseira, percorre o Idle, espelha os quatro eixos, interrompe a extensão e confere os downloads. A captura local de 216 ticks com os quatro Kagunes levou cerca de 5,4 ms por quadro para atualizar e desenhar o Canvas.
