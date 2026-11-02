# Atualização dos controles: R ativa Road Roller.

# Road Roller — Super de duas barras

Road Roller é a Super cinematográfica de Dio. Ela usa um comando próprio, consome 200 de energia e só inicia a sequência após o primeiro soco do Stand acertar. As animações, PNGs, dados dos normais, especiais e movimentação aprovados permanecem preservados; os novos recursos são aditivos.

## Executar e testar

```sh
npm install
npm run dev
```

Abra [o laboratório](http://127.0.0.1:5173/art/road-roller.html), ou entre no jogo principal, selecione Dio e use o Treinamento. A opção de energia infinita do treino preenche as duas barras; desative-a para observar o gasto e a recuperação de energia normais.

```sh
npm run build
npm start
```

A versão compilada fica em [127.0.0.1:3001](http://127.0.0.1:3001/), com o laboratório em [/art/road-roller.html](http://127.0.0.1:3001/art/road-roller.html).

## Comando, custo e risco

**R**, nos dois lados da arena. O antigo comando ↓ → ↓ → + L foi removido. A tecla usa o mesmo buffer de oito ticks das ações e uma borda de pressionamento; manter R pressionado não produz ativações repetidas. O custo, o startup e a confirmação permanecem iguais. Sem duas barras, R não dispara outro golpe por engano.

Dio tem **duas barras de 100 unidades**, máximo 200; Samurai preserva seu limite anterior de 100. Ganhos de energia respeitam o limite de cada personagem. O custo de 200 é pago ao iniciar, inclusive em erro, defesa ou interrupção. R é o controle de Road Roller para Dio; Samurai preserva Mil Cortes nessa tecla.

O primeiro ataque usa uma pose de comando de Dio e um soco próprio de The World: startup 26, quatro ticks ativos e recuperação 36. Não há invulnerabilidade no startup. Errar ou ser defendido não faz aparecer o objeto e não inicia a captura. A recuperação não pode ser evitada cancelando novamente o próprio início da Super.

Normais terrestres confirmados podem cancelar em Road Roller durante a parte ativa. O último contato do Muda Rush também permite esse cancelamento. Os arquivos dos movimentos aprovados não foram alterados; a nova regra é separada. Foram desenhadas 14 ligações entre os punhos anteriores e a preparação da Super.

## Sequência confirmada

Após confirmar, a sequência dura 300 ticks de combate, aproximadamente cinco segundos:

1. **Ativação, 0–21:** Dio comanda, The World se recoloca atrás dele e a câmera aproxima. O recolhimento parte da posição real do primeiro soco.
2. **Impulso e subida, 22–65:** joelhos, quadril, braços e roupas têm desenhos próprios. A trajetória acelera para cima e a câmera acompanha brevemente. As duas entidades saem completamente pelo topo.
3. **Preparação fora da tela, 66–77:** o alvo permanece capturado. Não há ataques externos ou entradas acumuladas.
4. **Descida, 78–107:** Dio e The World retornam com o veículo. Seus pontos de apoio acompanham o objeto. O centro do tambor é alinhado ao alvo, com limitação da largura do veículo nos cantos.
5. **Impacto, 108–123:** o rolo atinge o chão, a suspensão comprime e há poeira, clarão e tremor. A pose absorve o impacto; The World se desloca para a frente antes de golpear.
6. **Muda Muda, 124–221:** doze contatos, alternando os braços, com intervalos que diminuem de oito para seis ticks. Cada evento coincide com um punho desenhado sobre o tambor. Dio permanece na cabine em uma postura dominante.
7. **Soco pesado, 222–231:** preparação e descida próprias, com contato forte no tick 226.
8. **Explosão, 232–251:** fragmentação do veículo, fogo pixelado, clarão curto, partículas e tremor. O dano final é aplicado no tick 232.
9. **Fumaça e retorno, 252–299:** os fragmentos e a fumaça desaparecem, Dio volta ao chão, The World retorna atrás dele e a câmera normal é restaurada antes de liberar os controles.

O controlador e as transformações físicas são independentes da quantidade de desenhos. Os animadores buscam o tempo de cada fase em ticks, permitindo renderização em taxas diferentes. O objeto, os dois personagens e os efeitos usam atlas separados. Os zooms são inteiros, 1× e 2×, com nearest-neighbor e sem suavização.

Não há colisões normais durante a captura confirmada. O adversário não a interrompe, e projéteis externos não avançam durante a sequência. Depois dela, o jogo retoma o fluxo normal. Entradas recebidas durante a captura são descartadas. A posição do alvo confirmado é guardada; um alvo aéreo é conduzido ao chão progressivamente, sem salto instantâneo de posição.

## Dano, K.O. e Tempo

Contra 1000 de vida, fora de combo, a Super causa **350 de dano em 15 contatos**: 35 no início, 60 no impacto, 12 × 9 durante a sequência e 147 na explosão. O soco pesado final atinge o veículo e antecipa a explosão, sem somar um dano separado indevido.

Confirmar depois de outros golpes aplica redução de dano. A vida mínima de um durante os impactos intermediários reserva o K.O. à explosão; não existe morte seguida de ressurreição. Mesmo após a explosão zerar a vida, o round só termina ao concluir o retorno dos personagens e da câmera. Os medidores registram o dano efetivamente aplicado.

Road Roller **não zera, reinicia ou incrementa** os usos e a recarga da Parada do Tempo. A recarga pode diminuir durante o startup normal, mas fica suspensa durante a cinematografia. Se a Super confirmar enquanto o Tempo estiver ativo, seu tempo restante é preservado durante a captura e retomado depois, sem gastar outro uso. A Super usa seu custo e sua escala de dano próprios. Um K.O. encerra o efeito temporal conforme a regra já existente e preserva o histórico para o round seguinte.

Nova partida e revanche criam uma nova `Match`; troca de round conserva o histórico do Tempo. Samurai mantém Mil Cortes e suas regras anteriores.

## Arquivos e pipeline

- `src/data/road-roller.json`: custo, relógios, danos, contatos e tremor.
- `src/engine/road-roller.ts`: estado serializável, posições, fases e câmera derivada de ticks.
- `src/data/dio-super-moves.json`: golpe inicial e caixas.
- `src/data/the-world-super-actions.json`: ações e ligações adicionais do Stand.
- `src/render/road-roller.ts`: objeto, efeitos e pontos de impacto dos punhos.
- `public/sprites/dio/road-roller.json`: nove sequências, 54 células exportadas.
- `public/sprites/the-world/road-roller.json`: doze sequências, 96 células, além das 14 ligações de cancelamento.
- `public/sprites/road-roller/`: cinco sequências do veículo, 25 células, em 384×256; pivô (192,224).
- `public/sprites/road-fx/`: seis sequências independentes, 47 células de 256×256, com pivôs específicos para chão e impactos. O tremor é movimento de câmera, não uma falsa folha de sprites.
- `scripts/build_road_roller.py`: produção reproduzível. Execute `npm run art:dio:super`.
- `art/dio/road-preservation.json`: hashes dos PNGs e dados anteriores e cópia das entradas de animação aprovadas.

As células de Dio/The World continuam 256×256 com pivô (128,224), paleta nativa e alfa binário. As sequências completas reutilizam fases próprias quando apropriado; a quantidade de células exportadas não é apresentada como número de desenhos únicos sem reaproveitamento.

[Baixar PNGs, células e JSONs](http://127.0.0.1:3001/downloads/road-roller.zip). É um pacote aditivo ao motor existente. O visualizador `/art/dio.html` permite selecionar e inspecionar cada desenho dos personagens. O laboratório da Super permite pausar a sequência, avançar ticks, desacelerar, testar os dois lados, cantos, defesa, erro, K.O., energia e revanche.

## Verificação e prévia real

```sh
npm test
npm run test:browser
npm run test:online
```

Os testes específicos incluem duas barras, energia insuficiente, comandos e prioridade, confirmação, defesa, erro, vulnerabilidade, combo, cantos, K.O. adiado, câmera, retorno, uso por ambos os jogadores, histórico temporal, restauração determinística durante a sequência e contatos dos punhos sobre o tambor. A verificação de arte cobre alfa, paleta, poses distintas, comprimento dos membros, arquivos preservados, limites das folhas e ligações de cancelamento.

Capturas e logs ficam em `art/dio/qa/road-roller/`. `validation.json` registra os resultados finais efetivamente executados. A regressão inclui os modos, movimentos, especiais e Super anteriores do Samurai, além dos normais e especiais comuns de Dio e das salas online existentes.

Resultado desta entrega: **307 testes de simulação, 66 verificações de arte, 48 cenários de navegador e cinco testes online passaram**. A compilação TypeScript/Vite/Node e uma verificação adicional na versão compilada da porta 3001 também passaram. Essa verificação usou o teclado no treinamento principal, confirmou a Super, pausou e retomou a captura e conferiu os arquivos servidos. Os 23 testes específicos da Super foram repetidos após corrigir um campo ausente no próprio teste que impedia a compilação.

A gravação contém 360 ticks reais, amostrados em 180 capturas. O APNG mantém os pixels originais; os quadros consecutivos idênticos são agrupados com sua duração preservada. O GIF usa uma paleta compartilhada e seis segundos de duração, com quantização de cores. A exportação APNG foi corrigida para fornecer ao Pillow uma lista reutilizável de quadros, evitando a geração acidental de um PNG estático.

[Prévia completa em APNG](http://127.0.0.1:3001/previews/road-roller-complete.png) · [GIF](http://127.0.0.1:3001/previews/road-roller-complete.gif). As imagens vêm do Canvas real, amostrado a 30 fps sobre a simulação de 60 ticks, incluindo o retorno da câmera e um breve trecho de combate após a sequência. Não é uma montagem de sprites simulando uma luta.

## Limitações que permanecem

A arte dos personagens continua usando o rig pixelado aprovado e retoques, com limitação de rotação de volumes e atuação facial. O veículo foi desenhado em pixel art; o acabamento mecânico e os efeitos ainda podem ganhar detalhamento manual. A câmera usa cortes de zoom inteiros para preservar os pixels; não há zoom fracionário suave.

O dano e a duração são parâmetros iniciais, sem alegação de balanceamento competitivo ou teste humano de longa duração. Os sons do jogo principal são sintetizados, com impactos e explosão; não há voz de personagem. A prévia em GIF/APNG é silenciosa.

Dio continua disponível nos modos locais. O online permanece Samurai contra Samurai; a persistência e restauração da Super foram testadas localmente, sem prometer sua sincronização em salas ainda não habilitadas para Dio. As reações secundárias de Dio foram concluídas na revisão seguinte; veja DIO-SECUNDARIAS.md. O carregamento inicial de atlas e metadados ainda merece otimização em máquinas com poucos recursos.
