# Samurai — produção do sprite-base e Idle

Esta página documenta a primeira etapa aprovada. O estado atual inclui movimentação, normais, especiais e reações e está em [COMPLETE.md](COMPLETE.md). Os arquivos Idle desta etapa foram preservados.

Referência analisada: `references/samurai-style-reference.png`, fornecida pelo usuário. O cabelo em mechas, o contraste vermelho/preto, o rosto sério e as calças claras orientam o estilo. A referência contém uma apresentação de vários movimentos; não foi usada como atlas e nenhum de seus quadros foi recortado para o jogo.

## Resultado real

- Sprite-base em PNG RGBA, célula de 256×256, voltado à direita.
- Seis quadros de Idle em uma linha: atlas de 1536×256.
- Pivô de todos os quadros: `(128, 224)`, em coordenadas da célula.
- Altura visível: 130, 131, 132, 131, 130 e 129 pixels.
- 35 cores opacas na sequência completa e alfa exclusivamente 0 ou 255.
- Pés plantados e idênticos em todos os quadros.
- Ciclo de 90 ticks a 60 Hz, isto é, 1,5 segundo.
- Variações locais de respiração, peito/ombros, rabo de cabelo, tecido e punhos/katana.
- Paleta P2 troca apenas os tons vermelhos; pele, cabelo e metal mantêm a identidade.

Esta arte é assistida por geração: não foi inteiramente desenhada à mão pixel a pixel. `generated-base.png` é o original produzido com a ferramenta integrada imagegen. O importador reconstrói esse original na grade nativa, limita a paleta, elimina alfa intermediário e aplica correções explícitas de pele, olho, nariz, boca e contorno. `base-native.png` é a fonte nativa usada na animação. O resultado final, e não a imagem grande gerada, é o PNG consumido pelo jogo.

Não há nova geração por quadro: isso evita mudanças de rosto, traje e arma entre imagens. O Idle é uma animação articulada programática do sprite-base, por amostragem inteira de uma malha local. Os movimentos são discretos e pequenos, próprios de um Idle; não equivalem a seis poses de ação redesenhadas à mão. A qualidade artística deve ser julgada pela prévia e pelos arquivos reais, não apenas pelos testes técnicos.

## Arquivos editáveis e pipeline

```text
art/samurai/
  generated-base.png       imagem produzida pelo imagegen, preservada
  base-native.png          fonte em grade nativa, 256×256
  palette.json             paleta de trabalho, 36 cores permitidas
  retouch.json             correções explícitas por coordenada de pixel
  rig.json                 seis poses, durações e pivô
  generation-prompt.txt    prompt usado na geração
scripts/
  prepare_samurai.py       importação/reconstrução na grade nativa
  build_samurai.py         animação, PNGs, paleta P2, prévias e metadados
  run_art.mjs              localiza Python e executa o pipeline
public/sprites/samurai/
  base.png, base-p2.png    sprites-base nas duas paletas
  idle-00.png … idle-05.png seis células individuais
  idle.png                spritesheet transparente de produção
  idle-p2.png             spritesheet alternativa
  idle.json               geometria, durações, paleta, limites e hashes
  preview-4x.png           contato dos seis quadros com nearest-neighbor
  idle-preview.png        PNG animado/APNG ampliado em 4×
art/samurai.html           laboratório de animações (entrada Vite)
```

Python 3, Pillow e numpy são necessários para reconstruir a arte ou executar seus testes. O jogo pronto e o build Vite não precisam de Python. O launcher aceita a variável `PYTHON`, tenta as instalações usuais e também reconhece o runtime Python já presente neste ambiente Codex.

```sh
python -m pip install -r requirements-art.txt
npm run art:build
npm test
npm run build
```

`art:build` parte de `base-native.png`, não faz chamadas de geração e atualiza somente o clip Idle nos metadados visuais. Para refazer a importação da imagem gerada e reaplicar os retoques: `npm run art:import`. Não use esse comando depois de modificar a base manualmente sem salvar uma cópia, pois ele reconstrói `base-native.png`.

Durante `npm run dev`, abra `/art/samurai.html` ou o botão **Animações** no jogo. O inspetor permite pausar, selecionar cada quadro, ampliar de 1× a 4×, alternar fundo, verificar grade/pivô e trocar a paleta. O quadriculado e as guias existem somente nas prévias, nunca nas células do jogo.

## Integração e escopo

O Idle está configurado em `src/data/animations.json`, com escala inteira 1×: 130 pixels de personagem na resolução lógica. O renderer recorta células, espelha pelo pivô e escolhe a paleta P2 sem alterar a lógica de combate. A apresentação continua avançando em ticks fixos separados da seleção de frames dos golpes.

A movimentação atual usa os PNGs descritos em MOVEMENT.md. Os nove ataques normais foram produzidos em uma etapa posterior, documentada em ATTACKS.md, com suas próprias caixas e poses. Reações, agarrão e especial ainda reaproveitam poses e não têm animações finais dedicadas.

Os testes verificam células e atlas, alfa binário, altura, pivô, pés sem deslizar, seis imagens distintas inclusive depois de normalizadas por seus limites, variação em regiões separadas, preservação de identidade na paleta P2, ampliação nearest-neighbor, seis quadros no APNG e correspondência dos metadados com os PNGs.

A conferência visual inicial dos PNGs foi feita em ampliação inteira. Na etapa seguinte, a movimentação completa e o Idle foram verificados por testes no Chrome, incluindo os 45 quadros, ambas as paletas e as transições no motor. Veja MOVEMENT.md.
