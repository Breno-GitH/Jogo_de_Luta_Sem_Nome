**Registro histórico da revisão 3 rejeitada. A versão atual está em [GOKU-CAMINHADA-LIMPA.md](GOKU-CAMINHADA-LIMPA.md). As malhas descritas abaixo não são utilizadas pela versão atual.**

# Goku — caminhada refeita

Esta revisão altera Walk Forward e Walk Back do personagem existente. As duas transições de levantamento para caminhada foram recalibradas e há uma parada de oito ticks que devolve os pés à guarda antes do Idle. Samurai, Dio, The World e os demais desenhos existentes de Goku são preservados por hash.

## Ver e executar

```sh
npm run build
npm start
```

[Abrir comparação antiga/nova](http://127.0.0.1:3001/art/goku.html?walk=3). O endereço começa reproduzindo a nova caminhada em comparação com a versão que o usuário identificou como ruim. Escolha “Controlar Goku” para testar A/D, Shift + direção e W. Goku continua disponível no Treinamento do jogo principal.

O visualizador mantém pausa, avanço/retorno de desenho, velocidade, espelhamento, pivô, chão, caixas e ampliação nearest-neighbor. As folhas agora usam várias linhas; recorte, miniaturas e download respeitam suas colunas. As paradas dependentes da fase são internas e não ocupam a lista de animações principais.

## Desenho e movimento

O primeiro anexo foi usado como diagnóstico do resultado ruim. O segundo orientou anatomia, postura, cabelo, músculos e volume do gi. Os corpos das caminhadas foram gerados como poses pintadas separadas pela ferramenta integrada imagegen e ajustados à grade nativa. O [conjunto de prompts e papéis das referências](art/goku/walk-v3/generation.json) fica junto às fontes.

Cada caminhada usa **oito poses pintadas e 36 quadros exportados**, um por tick. Os intermediários deformam os próprios pixels pintados em pequenas malhas locais com nearest-neighbor. Não passam pelo antigo reconstrutor de membros em forma de tubos. As cores e o alfa não são interpolados. O rosto e o cabelo são os mesmos pixels aprovados do Idle, copiados sem rotação ou deformação.

Há contato, absorção de peso, passagem estreita das pernas, impulso e contato oposto. O recuo tem pintura própria, guarda mais fechada, menor elevação do pé e mais tempo em apoio duplo. As pernas não são a caminhada frontal reproduzida ao contrário.

A posição do pé de apoio acompanha a distância real percorrida. Na inversão, a apresentação procura preservar a mesma perna carregada. Durante apoio duplo, o pé anterior continua sendo a referência até sair do chão. A parada mantém um apoio enquanto o outro pé encontra a guarda, troca o apoio e termina com o próprio PNG de Idle preservado. Dash, salto e dano podem interrompê-la imediatamente.

O teste visual também encontrou e corrigiu a sola pintada dois pixels acima da linha do chão e um recorte da cintura que deixava uma coxa desconectada. A junção usa a pintura real da parte superior da calça, sob o cinto.

A inspeção ampliada encontrou ainda uma referência errada do tornozelo em uma pose-fonte do recuo. A correção reposiciona o recorte real da perna até a bota; não alonga artificialmente o cano para esconder o erro. Foram removidos também pixels de sobreposição da cintura que apareciam como uma ponta laranja nas fases de passagem. Pescoço e botas têm pequenos encaixes ocultos sob o tecido para evitar frestas de transparência.

## Velocidade e alinhamento

A caminhada passou de 6,1 para **4,2 px/tick** à frente e de 5,8 para **3,8** no recuo. O ciclo dura 36 ticks a 60 Hz, com aproximadamente 3,3 contatos de pé por segundo. A redução é deliberada para compatibilizar deslocamento, comprimento da passada e peso. O movimento aéreo de 6,5, impulso vertical de −17,7 e perfis de dash/backdash permanecem iguais. A leitura das entradas e a frequência da simulação continuam em 60 Hz.

Os PNGs principais continuam com células **256×256, pivô (128,224), direção direita, 32 cores e transparência binária**. A altura neutra permanece aproximadamente 130 px. Não há espada ou efeitos dentro dos corpos.

Os dois atlases internos de parada removem apenas margem transparente: células de 160×160 e pivô compensado (72,144), sem mudar um pixel desenhado. As células individuais preservam 256×256. Cada atlas contém as oito etapas para cada uma das 36 fases possíveis de saída, evitando trocar uma pose arbitrária ao soltar a direção. Esses quadros derivados não são apresentados como centenas de desenhos manuais.

## Arquivos

- `public/sprites/goku/walkForward.png` e `walkBack.png`: folhas principais.
- `public/sprites/goku/walk-head.png`: cabeça canônica aprovada.
- `public/sprites/goku/walkStopForward.png`, `walkStopBack.png` e `walk-transitions.json`: paradas por fase.
- `public/sprites/goku-walk-v2/`: cópia da versão anterior para comparação.
- `art/goku/walk-v3/`: referências, fontes pintadas, guias e revisão visual.
- `scripts/import_goku_walk.py`: importação nativa das poses pintadas.
- `scripts/goku_walk_painted.py`: poses e intermediários, sem redesenhar membros como tubos.
- `scripts/goku_walk_mesh.py`: deformação local dos pixels, com testes de identidade/paleta/alfa.
- `scripts/build_goku_walk.py` e `build_goku_walk_transitions.py`: exportação restrita às caminhadas e suas transições.
- `src/render/goku-motion.ts`: fase por distância, apoio, inversão e parada interrompível.
- `tests/test_goku_walk_art.py`, `tests/goku.test.ts`, `e2e/goku-walk.pw.mjs`: verificações específicas.

Para reproduzir apenas esta exportação: `npm run art:goku:walk`. O comando completo `npm run art:goku` também reaplica a revisão das caminhadas ao terminar.

## Verificação e limites

Os registros desta revisão ficam em `art/goku/qa/walk-only/`. Os cenários cobrem andar continuamente para frente/trás, ambos os lados, inversões rápidas, entrada/saída de Idle, interrupção por dash/backdash/salto, apoio físico e rasterizado, alinhamento das solas e preservação das outras animações. As capturas são feitas do mesmo Match e Renderer do jogo.

[Prévia animada real, sem perdas](public/previews/goku-walk-v3-gameplay.png), [alternativa GIF](public/previews/goku-walk-v3-gameplay.gif), [pacote PNG/JSON desta revisão](public/downloads/goku-walk-v3.zip). A gravação inclui avanço e recuo, olhando para a direita e para a esquerda. O APNG é decodificado e comparado byte a byte às 96 capturas reais do Canvas, sem reconstruir uma demonstração externa.

Os testes de desenho verificam folhas/células/pivôs, alfa, paleta, cabeça idêntica, distinção entre contato e passagem, articulações projetadas plausíveis, apoio e os extremos das paradas. Os comprimentos projetados das pinturas não são forçados aos antigos ossos 2D de 34+34 px, que contribuíam para a flexão excessiva dos joelhos.

A pintura é assistida por geração de imagem e os intermediários são calculados. Não é um conjunto inteiro desenhado manualmente. Algumas dobras e sobreposições ainda podem receber retoques; em câmera lenta, as transições entre a pintura nova e o Idle antigo podem revelar diferenças de acabamento. Ataques e os demais recursos de Goku continuam fora desta etapa.
