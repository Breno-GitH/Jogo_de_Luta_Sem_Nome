# Goku — caminhada com desenhos inteiros, revisão 4

Esta revisão substitui completamente as duas caminhadas rejeitadas. Há oito desenhos novos para avanço e oito para recuo. Cada pose é um personagem completo; nenhuma parte do corpo é recortada, interpolada, deformada ou colada em outra pose.

As fontes foram produzidas com a ferramenta integrada imagegen. Dois desenhos de impulso do avanço foram refeitos inteiros para reduzir a elevação dos joelhos. O recuo teve uma segunda geração para mudar o apoio e o peso. Não é animação desenhada manualmente quadro a quadro; a origem e os prompts estão em [art/goku/walk-v4/prompts.json](art/goku/walk-v4/prompts.json).

## Ver no jogo

Execute `npm run build` e depois `npm start`. Abra [o visualizador](http://127.0.0.1:3001/art/goku.html?walk=4) ou escolha Goku no Treinamento. A/D movem. O visualizador oferece loop, pausa, quadro anterior/próximo, velocidade, espelhamento, nearest-neighbor, pivô/chão e comparação com a caminhada rejeitada.

## O que mudou

- Saíram as malhas de deformação e as centenas de paradas derivadas. Voltar ao Idle usa o Idle preservado, sem morphing.
- Cada PNG é uma pose inteira com cabeça, cabelo, mãos, cintura, faixa, pernas e botas. A escala é uniforme, com a mesma proporção em cada direção, sem esticar membros.
- Células 256×256, pivô (128,224), 32 cores, alpha0/255, fundo transparente. As figuras de aproximadamente130px cabem com ampla margem; não foi necessário aumentar a célula.
- Folhas simples de oito colunas e uma linha; índices0–7. Não há offsets variáveis de recortes nem mistura com quadros antigos.
- Timings individuais em ticks de60Hz. Física separada dos desenhos. Samurai, Dio e os demais139 PNGs protegidos de Goku permanecem preservados.
- Pés de apoio medidos nos pixels reais. Pés ocultos são anotados como ocultos; não são inventados como pontos de contato.

## Pipeline e validação

`npm run art:goku:walk` prepara os PNGs individuais, valida cada pose e só então monta a folha. A publicação é interrompida se encontrar figura desconectada, clipping, margens insuficientes, alfa/paleta inválidos ou ausência de contato com o chão.

O contrato [production.json](art/goku/walk-v4/production.json) permite reconstruir cada fonte completa a partir da geração bruta e cada PNG do jogo usando somente recorte de célula inteira, escala uniforme nearest-neighbor, quantização e translação inteira. Os testes exigem igualdade exata. Isso impede esconder uma deformação atrás de um nome de arquivo novo.

As medidas de componentes não certificam anatomia ou naturalidade. A inspeção visual individual e as capturas no jogo complementam os testes. Registros desta revisão em `art/goku/qa/walk-clean/`; registrosv3 são históricos e não são apresentados como validação desta versão.

## PNGs e prévias

- [Walk Forward](public/sprites/goku/walkForward.png) e [Walk Back](public/sprites/goku/walkBack.png).
- [Todos os quadros do avanço ampliados](public/previews/goku-walkForward-v4.png) e [todos do recuo](public/previews/goku-walkBack-v4.png).
- [Loop com chão e pivô](public/previews/goku-walk-v4-loop.png).
- [Captura animada real do jogo](public/previews/goku-walk-v4-gameplay.png).
- [Pacote PNG/JSON e fontes](public/downloads/goku-walk-v4.zip).

## Limitações

São oito desenhos por ciclo, sustentados por vários ticks. Sem deformar os desenhos ou congelar artificialmente o corpo contra a física, pode restar patinação curta dentro de um cel sustentado. A compensação que deslocaria a figura inteira está desligada; isso é preferível a mascarar o problema. O contato é revisto nas poses, mas não há promessa de imobilidade perfeita a cada tick.

Há pequenas diferenças de dobras e de acabamento entre fontes geradas, e a mudança para o Idle antigo pode ser percebida em câmera lenta. A inspeção frame a frame permite avaliar essas limitações. Ataques e especiais de Goku continuam fora desta etapa.
