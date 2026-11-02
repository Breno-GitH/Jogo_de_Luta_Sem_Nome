# Goku — reconstrução completa de movimentação (revisão5)

## Diagnóstico e correção

Os defeitos principais já existiam nos PNGs individuais: reconstrução de membros com curvas e texturas do desenho, sobreposição de recortes de tronco/cabeça/faixa e deformação por malha nas caminhadas antigas. O empacotador não era a causa principal. Também havia fontes que cruzavam uma divisão nominal da folha: recortar rigidamente essa grade podia amputar uma ponta de bota. A extração agora registra a figura inteira e rejeita partes destacadas antes de escrever a folha.

A geração ativa não usa o rig antigo, morphing, compressão de agachamento, recortes de braços/pernas nem cabeças enxertadas. São poses completas, produzidas com geração gráfica assistida, revisadas, importadas com escala uniforme, paleta 32 cores e transparência binária. Não são desenhos integralmente feitos à mão por um animador. Fontes e prompts permanecem em `art/goku/rebuild/` e a rastreabilidade por célula fica nos arquivos `*-production.json`.

A referência de calibração em pé mantém uma escala por lote; poses agachadas/aéreas não são ampliadas de volta para130 px. A importação das caminhadas completas anteriores tem seu próprio protocolo de fonte inteira, também reconstruído e comparado pixel a pixel nos testes. Quatro poses de passagem foram redesenhadas para conservar guarda e largura do tronco. Os desenhos completos úteis foram mantidos; a experiência com16 poses por direção foi rejeitada porque não respeitava o apoio correto.

## Integração

Física preservada: velocidade4,2; recuo3,8; velocidade aérea6,5; impulso−17,7; gravidade0,72; preparação6 ticks; aterrissagem8 ticks; mesmos perfis de dash/backdash. O diretor visual de Goku escolhe subida/ápice/queda pela trajetória real, conserva a direção para a aterrissagem, seleciona a profundidade do levantamento ao soltar/reapertar o agachamento e usa transições completas e interrompíveis. O bug que descartava a transição após o primeiro tick foi encontrado no navegador e corrigido.

Células256 ×256; pivô128,224; margens mínimas8 px; transparênciaRGBA0/255; nearest-neighbor. Hurtboxes conservadoras por faixas de pixels acompanham as poses. Não há hitboxes ofensivas de Goku. A câmera e os estados físicos permanecem separados dos desenhos. Samurai, Dio e The World preservados:1995 arquivos de arte/dados verificados por hash, mais a verificação dos fontes compartilhados congelados.

## Arquivos e quantidades

33 animações; 142 referências de célula; 98 desenhos distintos. Endpoints compartilhados intencionalmente ligam fases (por exemplo, última queda/primeiro contato e retorno à guarda); não são novos desenhos artificiais para preencher ticks.

- `idle`: 6 desenhos; 60 ticks; durações[9, 9, 10, 11, 10, 11]; loop.
- `walkForward`: 8 desenhos; 36 ticks; durações[4, 5, 4, 5, 4, 5, 4, 5]; loop.
- `walkBack`: 8 desenhos; 36 ticks; durações[4, 5, 4, 5, 4, 5, 4, 5]; loop.
- `crouchStart`: 6 desenhos; 8 ticks; durações[1, 1, 2, 1, 1, 2]; sem loop.
- `crouchIdle`: 3 desenhos; 40 ticks; durações[12, 14, 14]; loop.
- `crouchEnd`: 7 desenhos; 8 ticks; durações[1, 1, 1, 1, 1, 1, 2]; sem loop.
- `jumpStart`: 3 desenhos; 6 ticks; durações[2, 2, 2]; sem loop.
- `jumpRise`: 3 desenhos; 12 ticks; durações[4, 4, 4]; sem loop.
- `jumpApex`: 2 desenhos; 8 ticks; durações[4, 4]; sem loop.
- `jumpFall`: 3 desenhos; 12 ticks; durações[4, 4, 4]; sem loop.
- `jumpRiseForward`: 3 desenhos; 12 ticks; durações[4, 4, 4]; sem loop.
- `jumpApexForward`: 2 desenhos; 8 ticks; durações[4, 4]; sem loop.
- `jumpFallForward`: 3 desenhos; 12 ticks; durações[4, 4, 4]; sem loop.
- `jumpRiseBackward`: 3 desenhos; 12 ticks; durações[4, 4, 4]; sem loop.
- `jumpApexBackward`: 2 desenhos; 8 ticks; durações[4, 4]; sem loop.
- `jumpFallBackward`: 3 desenhos; 12 ticks; durações[4, 4, 4]; sem loop.
- `landing`: 5 desenhos; 8 ticks; durações[1, 1, 2, 2, 2]; sem loop.
- `landingForward`: 5 desenhos; 8 ticks; durações[1, 1, 2, 2, 2]; sem loop.
- `landingBackward`: 5 desenhos; 8 ticks; durações[1, 1, 2, 2, 2]; sem loop.
- `dashForward`: 7 desenhos; 14 ticks; durações[2, 2, 2, 2, 2, 2, 2]; sem loop.
- `dashForwardRecovery`: 3 desenhos; 4 ticks; durações[1, 2, 1]; sem loop.
- `backdash`: 7 desenhos; 14 ticks; durações[2, 2, 2, 2, 2, 2, 2]; sem loop.
- `backdashRecovery`: 3 desenhos; 4 ticks; durações[1, 2, 1]; sem loop.
- `idleToWalkForward`: 4 desenhos; 4 ticks; durações[1, 1, 1, 1]; sem loop.
- `walkToIdleForward`: 3 desenhos; 4 ticks; durações[1, 2, 1]; sem loop.
- `crouchWalkForward`: 7 desenhos; 8 ticks; durações[1, 1, 1, 1, 1, 1, 2]; sem loop.
- `idleToWalkBack`: 4 desenhos; 4 ticks; durações[1, 1, 1, 1]; sem loop.
- `walkToIdleBack`: 3 desenhos; 4 ticks; durações[1, 2, 1]; sem loop.
- `crouchWalkBack`: 7 desenhos; 8 ticks; durações[1, 1, 1, 1, 1, 1, 2]; sem loop.
- `trainingHit`: 3 desenhos; 12 ticks; durações[3, 4, 5]; sem loop.
- `trainingAirHit`: 3 desenhos; 15 ticks; durações[5, 5, 5]; sem loop.
- `trainingDown`: 3 desenhos; 28 ticks; durações[4, 6, 18]; sem loop.
- `trainingGetup`: 5 desenhos; 18 ticks; durações[2, 4, 4, 4, 4]; sem loop.

## Inspeção e execução

`npm start` serve o build em `http://127.0.0.1:3001/`. Para desenvolvimento: `npm run dev` e, quando necessário, `npm run dev:server`. Para compilar: `npm run build`. Para reproduzir a importação a partir das fontes já arquivadas: `npm run art:goku` (Python/Pillow/NumPy, encontrados pelo lançador). Não é preciso gerar imagens novamente para rodar o jogo.

Visualizador: `/art/goku.html?rebuild=5`. Permite controlar Goku, escolher todas as 33 animações, loop de inspeção, pausa, avanço por desenho/tick,¼×/½×/1 ×/2 ×, inversão de lado, zoom1–4 ×, pivô/chão, limites do desenho, hurtboxes e comparação com o pacote anterior. Guias anatômicas2 D estimadas estão disponíveis apenas nas poses-chave Idle1/CrouchIdle1; são referências de inspeção, nunca um rig que deforma pixels.

- PNGs nativos, folhas e APNGs: `public/sprites/goku/`.
- Ampliações de todas as142 células com chão/pivô/limites: `art/goku/rebuild/enlarged/`.
- Contatos por animação: `art/goku/rebuild/*-contact.png`.
- Contato geral: `public/previews/goku-rebuild-contact.png`.
- Contato capturado no renderizador real: `public/previews/goku-rebuild-captured-contact.png`.
- Prévia real: `public/previews/goku-rebuild-gameplay.png` (APNG, pixels exatos) e `.gif` (redução nearest-neighbor 1/2).171 amostras a30 FPS; quadros idênticos podem ser fundidos pelo APNG mantendo a duração.
- Loops dos desenhos exportados: `public/previews/goku-<animação>.png`; são inspeções, não substituem a trajetória física do salto.
- Download: `public/downloads/goku-movement.zip`, com PNGs, ampliações, contatos, metadados e auditoria.

## Verificação

`npm test`:361 testes de simulação em 17 arquivos, além da bateria Python de arte. Os 22 testes específicos de arte de Goku verificam todas as células, fontes completas, alfa/paleta, margens, conectividade, calibração, ordem/recorte, duração, endpoints, ausência de duplicatas só transladadas, caixas e preservação. O log completo fica em `full-test.log`.

Chrome: controle real nas duas direções; Idle prolongado; avanços/recuos contínuos; reversões rápidas; entrada/saída de caminhada; agachamentos completos e interrompidos; retomada durante levantamento; saltos parado/frente/trás; aterrissagens; dashes e recuperação; treinamento principal e recebimento de ataques; pausa; comparação; velocidades; inspeção individual dos 142 quadros. Evidências em `qa/`, inclusive rastros de ticks e capturas de cada desenho no navegador. Os testes numéricos não certificam naturalidade artística.

## Limitações restantes

A caminhada ainda pode mostrar deslizamento residual e batidas na troca de desenhos: oito poses mantidas4–5 ticks não equivalem a uma nova pose perfeita por tick. Não foi aplicada uma malha ou deformação para esconder isso. A largura aparente de tecido, pequenos detalhes do rosto/cabelo e algumas mudanças entre poses ainda variam; não considero o conjunto equivalente a uma animação M.U.G.E.N profissional polida manualmente.

As reações de treino são completas e utilizáveis, mas continuam compartilhadas por vários tipos de dano/defesa. Não representam um repertório completo de combate, expressões, entrada ou vitória de Goku. O personagem permanece restrito ao treinamento, sem ataques/especiais/Super. Os limites retangulares de hurtbox são conservadores; o sprite não tem colisão por pixel.
