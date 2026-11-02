# Samurai — movimentação

Esta página documenta a etapa de movimentação aprovada. A etapa seguinte acrescenta os nove normais sem alterar seus PNGs; veja [ATTACKS.md](ATTACKS.md).

O conjunto contém 45 quadros: seis do Idle aprovado, preservados byte a byte, e 39 novas poses. Todos os PNGs usam células 256×256, o pivô (128,224), escala nativa 1×, alfa binário e a paleta da base. Não foi gerado um novo personagem.

## Sequências

As durações estão em ticks de 1/60 de segundo, na ordem dos quadros:

- Idle: 6 quadros; 16,14,14,16,14,16; loop. Arquivos aprovados preservados.
- Walk Forward: 6; 5,4,5,5,4,5; loop.
- Walk Back: 6; 6,5,6,6,5,6; loop.
- Dash Forward: 5; 2,2,3,3,3; reprodução única.
- Backdash: 5; 2,2,3,3,3; reprodução única.
- Crouch Start: 2; 3,3; reprodução única.
- Crouch Idle: 2; 18,20; loop.
- Crouch End: 2; 3,3; reprodução única.
- Jump Start: 3; 1,1,2; reprodução única.
- Jump Rise: 2; 4,4; reprodução única, mantém a última pose até mudar de fase.
- Jump Apex: 1; 8; mantém a pose durante a passagem pelo ápice.
- Jump Fall: 2; 4,4; reprodução única, mantém a última pose até o contato com o chão.
- Landing: 3; 2,2,2; reprodução única.

Os tempos e a seleção de quadros estão em `src/data/animations.json`. Os PNGs e metadados de inspeção estão em `public/sprites/samurai/`. O manifesto é `movement.json`. Cada sequência tem atlas P1/P2, células individuais, uma prancha ampliada e uma prévia APNG.

## Técnica artística e arquivos-fonte

`scripts/build_movement.py` usa as partes da base nativa aprovada em um rig de recortes articulados, em vez de gerar uma imagem diferente para cada quadro. As partes editáveis são exportadas para `art/samurai/movement-layers/`; os parâmetros de cada pose estão em `movement-rig.json`, exportados pela função `sequences()` do script.

As pernas usam articulações de quadril, joelho e tornozelo; o tronco inclina pelo quadril; os pés giram pelo tornozelo; braços e guarda de duas mãos acompanham o tronco e o punho; cabelo e tecido têm movimento secundário. Não há translação da imagem Idle inteira como substituto da animação. A região do rosto é copiada rigidamente e os testes comparam seus pixels em todas as novas poses.

Esta é animação programática por recortes e ajustes, não 39 quadros integralmente redesenhados à mão. Poses muito diferentes da guarda original continuam limitadas pelas superfícies visíveis na base. As dobras e a perspectiva são herdadas dela; uma produção manual quadro a quadro pode aprimorar essas transições futuramente.

`idle-lock.json` protege os hashes SHA-256 do atlas Idle, do atlas P2 e da base. O construtor de movimentação apenas lê esses arquivos; não os substitui. A comparação inclui todos os quadros individuais, via testes anteriores.

```sh
npm run art:movement
npm test
npm run build
npm run test:browser
```

O pipeline de arte requer Python 3 com as bibliotecas de `requirements-art.txt`. O teste de navegador usa Google Chrome já instalado (`channel: chrome`), sem baixar outro navegador. Para testar o build em vez do servidor de desenvolvimento, defina `SAMURAI_TEST_BUILD=1` antes de `npm run test:browser`.

## Motor e transições

`FighterPresentation` seleciona animações visuais a partir do estado da simulação. Andar/dash para frente e para trás são relativos à direção em que o lutador está olhando; espelhamento ocorre pelo pivô, sem recortar ou recentralizar a imagem.

O salto normal tem quatro ticks de preparação antes do impulso. O cancelamento de um forte conectado para perseguir um combo aéreo permanece imediato. A física governa a coordenada vertical do personagem; as imagens nunca somam uma segunda trajetória de salto nem são recentralizadas pelos limites visíveis. As fases Rise/Apex/Fall vêm da velocidade vertical. No contato com o chão, a simulação entra em Landing por seis ticks.

A defesa e as hitboxes não dependem de qual quadro visual está sendo mostrado. Agachar começa a postura de combate imediatamente; a apresentação executa Start → Idle e End → Idle. Andar ou atacar interrompe a saída do agachamento. Dash, preparação do salto, agachamento e aterrissagem podem ser interrompidos por ataques; dano interrompe a locomoção pelo sistema de colisões e hitstun. Hitstop e pausa congelam também a apresentação.

O renderer sempre desenha a célula pelo mesmo pivô (128,224). Nos quadros apoiados, pelo menos um pé toca a linha de chão; o Backdash tem um pequeno recolhimento dos pés no meio. Ajustes locais da barra de tecido impedem que ela atravesse o chão. Nenhuma dessas correções move o pivô da célula.

## Laboratório e validação

Durante `npm run dev`, abra `/art/samurai.html` ou **Animações** no jogo. É uma segunda entrada Vite, incluída também em `dist/art/samurai.html`.

O laboratório permite selecionar qualquer uma das 13 animações, pausar/reproduzir, avançar/voltar um quadro, escolher uma miniatura, inspecionar cada duração, ampliar de 1× a 4×, reduzir velocidade, mostrar grade/pivô/chão, alternar fundo, espelhar e trocar a paleta P2. Sequências sem loop param na última pose. Os botões de salto completo, agachar/levantar e locomoção executam o mesmo `Match` e o mesmo controlador visual do jogo; não são vídeos de demonstração nem transições simuladas fora do motor.

Verificação:

- Testes TypeScript de física, combate, cancelamentos, interrupções, origem do sprite e seleção dos clips.
- Testes Python de contagens, identidade dos arquivos Idle, alfa, paleta, poses distintas, rosto copiado rigidamente e contato com o chão.
- Testes no Chrome que desenham os 45 quadros e conferem ambas as paletas, pausa, avanço/retrocesso, transições reais de salto/agachamento/locomoção e controles na partida.
- Capturas reais do navegador em `art/samurai/qa/`, além das pranchas de todas as poses revisadas no tamanho ampliado.

## Fora desta etapa

Na etapa seguinte, os nove ataques normais receberam 45 quadros e colisões próprias. Defesa, dano, knockdown/KO, agarrão e especial reutilizam poses do Samurai e ainda não têm animações finais dedicadas. Veja ATTACKS.md para o escopo atual.
