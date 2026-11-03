# Luffy pré-timeskip · reconstrução visual

Luffy está disponível no Treinamento, Contra BOT e em salas LAN. O Arcade mantém o elenco anterior.

A nova pose foi gerada do zero com ImageGen, usando Goku como referência de contorno, leitura e acabamento. O arquivo para revisão usa 130 pixels de altura visível em uma célula RGBA de 256 × 256, com transparência binária e pivô (128, 224). A folha de comparação usa o mesmo chão e a mesma escala para todo o elenco.

- public/sprites/luffy/base-review.png contém o sprite transparente.
- public/sprites/luffy/preview-review.png contém a ampliação em 3×.
- public/sprites/luffy/lineup-review.png compara Samurai, Dio, Goku e Luffy.
- art/luffy.html apresenta a pose-base no XAMPP.
- scripts/pack_luffy_review.py empacota a nova imagem e as comparações.
- deployment/archive/luffy-rejected guarda a arte anterior e seu gerador fora da pasta pública para comparação. Nenhum quadro anterior foi utilizado no novo sprite.

O sprite polido em base-polished.png é a referência visual de toda a movimentação.

## Movimentação

O Treinamento usa o Luffy polido com 45 desenhos em 13 clipes. O motor de combate, a física e o protocolo LAN continuam com as regras existentes. Os estados sem arte própria usam a pose-base polida.

As placas novas foram geradas pelo ImageGen a partir de base-polished.png. As placas e as coordenadas de recorte estão em art/luffy-motion-source. Nenhum pixel das versões rejeitadas participa das folhas. Para reproduzir o empacotamento, execute:

```powershell
$d = "art/luffy-motion-source"
node scripts/run_art.mjs scripts/pack_luffy_movement.py "$d/idle.png" "$d/walk.png" "$d/dash.png" "$d/backdash.png" "$d/crouch.png" "$d/jump.png" --crops "$d/crops.json"
```

O script exporta o atlas, a folha de contato e o GIF. O atlas usa células 256 × 256 e pivô (128, 224). Os tempos individuais ficam em src/data/luffy-animations.json. O contato mantém a mesma linha do chão para todos os desenhos, inclusive os que possuem um pequeno deslocamento visual aéreo.


## Nove normais e elasticidade

Luffy está no Treinamento e Contra BOT. J/K/L acionam socos e chutes em pé, agachado com S ou no ar. Segure para trás para defender e para trás + S para a defesa baixa. S+L lança quando acerta e permite cancelar em W para perseguir. R fica reservado para a Super.

- src/data/luffy-normals.json define tempos, níveis, dano, stun, trajetórias e cancelamentos dos nove normais.
- src/engine/luffy-normals.ts resolve ombro ou barra do short, extensão e recolhimento a cada tick. O punho ou a sandália geram uma cápsula ofensiva durante os ticks ativos. Os segmentos vulneráveis são convertidos para as hurtboxes retangulares já usadas pelo motor.
- src/render/elastic.ts rasteriza o membro e a extremidade em pixels inteiros. Nos chutes, a coxa permanece desenhada no corpo desde o quadril até a barra do short.
- scripts/pack_luffy_normals.py prepara o atlas de corpos e os pontos de articulação usando as novas placas de art/luffy-normals-source. Execute node scripts/run_art.mjs scripts/pack_luffy_normals.py para reproduzir os dois arquivos.
- A seção Ataques normais de art/luffy.html reproduz os golpes em câmera lenta, espelha a pose e exibe caixas por tick.
- tests/luffy-normals.test.ts cobre o elenco, os dois lados, defesa, alcance, punição do braço, limites, interrupção e combos.


## Alcance e desenho elástico

O alcance horizontal de referência é medido do pivô ao punho ou pé. Em pé K passou de 122 para 198 px e L de 202 para 344 px. Agachado K passou de 146 para 234 px e L de 106 para 166 px, com pico vertical a 168 px acima do pivô. Aéreo K passou de 133 para 218 px e L de 132 para 208 px, com trajetória até 76 px abaixo do pivô no ar. As bordas e o piso limitam o golpe. O dano foi mantido.

O contorno e as faixas de luz e sombra são rasterizados como superfícies contínuas com espessuras diferentes para braço e perna. A detecção acompanha a extremidade atual e sua trajetória entre ticks ativos. O braço ou a perna pode ser punido durante a volta. Um cancelamento ou uma interrupção troca o estado e encerra a geometria temporária.

A régua do laboratório marca o alcance anterior e o atual. A sequência de demonstração registra o contato com Samurai na simulação. O lobby LAN permite selecionar Luffy. O teste de integração usou dois processos Chrome no mesmo computador, acessando o Apache por localhost e pelo IP da rede. O servidor e os clientes concordaram no acerto de Stand Heavy a 324 px e nos hashes dos ticks observados.


## Especiais terrestres

Pistol usa ↓ →, Gatling usa ↓ ← e Bazooka usa ↓ ↓. Termine com J/K/L para escolher a versão. Frente e trás são relativos à direção de Luffy. Para Bazooka, solte S entre os dois toques. Os três especiais ficam no chão e custam zero de barra. R está reservado.

Pistol tem alcance de 370, 425 ou 480 px até o punho. Gatling alterna os ombros e registra até 3, 5 ou 7 contatos com janelas independentes. Bazooka usa duas palmas e uma única confirmação. A versão forte lança levemente e derruba, usando a reação existente do motor. O projeto ainda não tem wall bounce.

Normais terrestres podem cancelar em especial na janela de confirmação de acerto. Bloqueio e erro mantêm a recuperação normal. Os especiais encerram a cadeia. As extensões e os rastros são derivados do estado atual e somem ao ser interrompido.

- src/data/luffy-specials.json contém alcance, dano, startup, atividade e recuperação por versão.
- src/engine/luffy-specials.ts contém os cronogramas de braços, poses, janelas e comandos.
- public/sprites/luffy/specials.png contém 12 poses-base. Reproduza o atlas e os pontos de encaixe com node scripts/run_art.mjs scripts/pack_luffy_specials.py.
- src/render/luffy-special-fx.ts desenha rastros e recuo. Impactos e tremor usam a resposta já existente do motor.
- art/luffy.html#especiais oferece as nove prévias e permite reproduzir, espelhar ou verificar as caixas por tick.
- tests/luffy-specials.test.ts cobre as nove versões, os três oponentes, os dois lados, defesa, erro, interrupção, cancelamento, alcance, parede e restauração de estado.
