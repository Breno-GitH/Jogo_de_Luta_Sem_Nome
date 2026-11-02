# Goku — revisão visual e de movimento, versão 2

**Atualização atual:** as caminhadas foram refeitas novamente, com poses pintadas, novos intermediários e velocidade recalibrada. Veja [GOKU-CAMINHADA.md](GOKU-CAMINHADA.md). Este documento conserva o registro da revisão 2 e das demais animações preservadas.

A revisão mantém o mesmo personagem e o mesmo motor. A imagem de quatro poses reenviada pelo usuário é a **fonte real de produção**, guardada em `art/goku/revision/approved-source.png`. Sua pose superior esquerda fornece o novo rosto, cabelo, parte superior do gi, faixa e cores das dobras. As outras poses orientam a anatomia; a montagem não é usada como uma falsa spritesheet.

## Executar e comparar

```sh
npm install
npm run build
npm start
```

Abra o [laboratório](http://127.0.0.1:3001/art/goku.html) ou escolha **Treinamento → Goku** no [jogo](http://127.0.0.1:3001/). `npm run dev` oferece as mesmas telas na porta 5173.

Controles: A/D mover; W pular; S agachar; Shift + direção dash/backdash. O laboratório permite selecionar todas as folhas, repetir ou parar ao final, pausar, avançar um tick, avançar/voltar um desenho, reproduzir a ¼×/½×/1×/2×, inverter o lado, ampliar de 1× a 4× com nearest-neighbor, mostrar chão/pivô/caixas e baixar o PNG atual. **Comparar anterior e novo** usa a mesma fase normalizada, pois as versões têm contagens e tempos diferentes. As duas transições novas de agachamento para caminhada são identificadas como sem equivalente anterior.

## Problemas encontrados e correções

A versão anterior girava recortes largos de uma calça já dobrada. O resultado produzia pontas, joelhos quadrados e silhuetas quebradas. O teste antigo de comprimento dos ossos não detectava esses defeitos visuais. Também havia uma queda brusca do quadril ao iniciar a caminhada e uma diferença entre arredondar a raiz e arredondar os pés, capaz de provocar uma oscilação de um pixel.

Os braços, pernas, mãos e botas foram reconstruídos na grade nativa. As silhuetas e as dobras acompanham as articulações; apenas cores internas do tecido da imagem aprovada são transferidas para dentro do novo contorno. Recortes transparentes e contornos antigos não são deformados para formar as pernas. O tronco recebe compensação, as mãos mantêm a guarda e a faixa/cabelo possuem movimento discreto.

A caminhada frontal e o recuo têm ciclos próprios de contato, absorção, passagem e impulso. O pé apoiado percorre a distância inversa do movimento físico. A fase segue a distância realmente percorrida; numa parede o personagem deixa de pedalar. A entrada e as reversões procuram uma fase compatível com o apoio anterior. A renderização de Goku arredonda a partir da sola de apoio, mantendo-a estável em pixels sem alterar a posição física.

O agachamento baixa o quadril e dobra os joelhos com os mesmos comprimentos de membros. Não comprime o personagem. Os canos das botas seguem as canelas, mantendo as solas no chão. Soltar S cedo escolhe uma fase próxima de levantamento. Duas folhas adicionais mostram o primeiro passo ao sair de um agachamento completo e começar a avançar/recuar.

O salto tem antecipação, extensão, recolhimento assimétrico das pernas, ápice, preparação para contato e aterrissagem com compressão e recuperação. Subida/ápice/queda são escolhidos pela velocidade vertical e distância física do chão. Landing só começa após o contato; sua duração passou a oito ticks. Há variantes inclinadas para saltos à frente e para trás.

## Desenhos exportados

As 13 sequências principais somam **94 células**:

- Idle: 6.
- Walk Forward: 24; Walk Back: 24.
- Dash Forward: 7; Backdash: 7.
- Crouch Start: 4; Crouch Idle: 3; Crouch End: 4.
- Jump Start: 3; Jump Rise: 3; Jump Apex: 2; Jump Fall: 3.
- Landing: 4.

Os ciclos de caminhada usam um desenho por tick de deslocamento para manter o apoio compatível com a velocidade do jogo. As quantidades maiores não são cópias da imagem inteira transladada: pés, joelhos, quadril, braços e dobras possuem posições próprias.

Há ainda 16 células de variantes aéreas direcionais, 16 das duas transições de agachamento para caminhada e 13 de reações provisórias de treino. Total: **25 folhas e 139 células**. As quatro folhas provisórias de dano/queda/recuperação continuam identificadas como apoio ao Treinamento, não como um conjunto final de combate.

Cada célula tem 256×256, pivô (128,224), direção direita, alfa binário e paleta de 32 cores. A pose neutra tem aproximadamente 130 px de altura. Os PNGs do jogo têm fundo transparente; prévias com fundo são arquivos separados.

## Arquivos principais

- `scripts/build_goku.py`: exportação reproduzível por `npm run art:goku`.
- `scripts/goku_source.py`: recorte e separação da fonte aprovada.
- `scripts/goku_anatomy.py`: desenho nativo dos membros, contornos, dobras e botas.
- `scripts/goku_poses.py`: poses e tempos individuais.
- `src/data/goku*.json`: registro do personagem, folhas, tempos, física e apoio dos passos.
- `src/render/goku-motion.ts`: apresentação por distância, trajetória e estado físico.
- `src/goku-lab.ts` e `art/goku.html`: controle real e inspeção/comparação.
- `public/sprites/goku/`: folhas transparentes, células individuais, APNGs e metadados.
- `public/sprites/goku-v1/`: versão anterior preservada para comparação.
- `art/goku/revision/`: fonte aprovada, guia, [prompt de geração](art/goku/revision/generation.json), código/dados e evidências anteriores.
- `art/goku/qa/`: registros de teste, captura real e relatório de validação.

[PNGs e JSONs](http://127.0.0.1:3001/downloads/goku-movement.zip) · [13 animações em grade](http://127.0.0.1:3001/previews/goku-movement.png) · [Captura real do jogo](http://127.0.0.1:3001/previews/goku-gameplay.png) · [Comparação de poses](http://127.0.0.1:3001/previews/goku-comparison.png).

## Física, preservação e verificação

A simulação continua em 60 ticks. Posição, velocidades, estado e colisão pertencem ao motor; o quadro e o encaixe inteiro de pixels pertencem à apresentação. Goku mantém velocidade 6,1 px/tick contra 5,5 do Samurai; recuo 5,8, movimento aéreo 6,5, impulso −17,7 e gravidade 0,72. Dash/backdash usam perfis próprios de 14 ticks. O pivô dos atlas permanece fixo, inclusive nos saltos.

Samurai, Dio e The World não recebem alterações de PNGs nem de dados. `art/goku/preservation.json` verifica os arquivos anteriores por hash. O pequeno ponto de integração no renderizador usa o novo arredondamento apenas para Goku; os demais personagens mantêm o mesmo arredondamento anterior.

Os testes específicos cobrem os dois lados, caminhada contínua, apoio físico e apoio rasterizado, paredes, reversões rápidas, agachamento/soltura curta/levantamento, primeiro passo saindo do agachamento, saltos parado/frente/trás, aterrissagem, dash/backdash repetidos, Idle por 6,5 segundos, treino no jogo principal, dano recebido e restauração determinística. O teste de arte verifica também conexão entre panturrilhas e botas, solas desenhadas no chão, rosto sem deformação, membros constantes, quadros distintos, paleta/alfa e a imagem aprovada como fonte.

Os comandos de verificação são `npm test`, `npm run build`, `npm run test:browser` e `npm run test:online`. Os resultados efetivamente executados ficam nos logs e em `art/goku/qa/validation.json`. O teste online cobre as salas existentes de Samurai; não habilita Goku online.

A primeira execução concorrente teve um timeout de cinco segundos no autoteste do BOT; a execução limpa passou os 357 testes do motor. A regressão de navegador passou 59 cenários na sequência completa; o último excedeu a espera de cinco segundos ao carregar o laboratório de Dio. O log da reexecução isolada desse cenário fica em `browser-rerun.log`. Esses timeouts são registrados, não convertidos em alegações de uma execução inteira sem falhas. O teste adicional da versão compilada cobre também a comparação e a saída do agachamento contra a parede.

As prévias utilizam células reais exportadas. A grade mostra os desenhos; a captura do Canvas mostra o salto e a movimentação física. O APNG preserva os pixels e é conferido contra a sequência capturada. O GIF pode reduzir a paleta e a amostragem.

## Limitações reais

Esta é uma animação assistida por um rig com pintura em pixels, a partir de uma base gerada e aprovada; não é um conjunto inteiro desenhado manualmente por um animador. A redução para 130 px perde parte da expressão e das dobras da imagem grande. Certas sobreposições, curvas muito fechadas da roupa e mudanças de direção ainda podem receber refinamento manual. A revisão melhora os defeitos encontrados, mas os testes técnicos não certificam uma qualidade artística equivalente a sprites profissionais desenhados quadro a quadro.

O carregamento inicial dos laboratórios ainda pré-carrega muitos recursos. A compilação passa, mas continua emitindo o aviso de blocos JavaScript maiores que 500 kB. O timeout de carregamento observado está registrado nos testes; otimizar esse carregamento permanece uma melhoria do projeto.

Goku permanece na etapa de movimentação, disponível no Treinamento. Ataques, especiais, Super, apresentações e participação em Contra BOT/Arcade/online não fazem parte desta revisão. As reações de apoio continuam provisórias. Samurai e Dio mantêm seus recursos existentes.
