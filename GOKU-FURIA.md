# Fúria Saiyajin — Super cinematográfica

Comando **R**, independente dos direcionais. Custa **100/100**, uma barra completa. R é o comando universal de Super para todos os personagens. Os três especiais comuns do Goku continuam gratuitos. A revisão de ritmo e os cancelamentos confirmados estão em [COMBATE-FRENETICO.md](COMBATE-FRENETICO.md).

Goku começa na forma base, transforma o cabelo e os olhos por desenhos próprios, avança e tenta um soco de alcance finito. A preparação é vulnerável. Somente um acerto sem defesa confirma a cinematografia. Defesa ou erro levam a recuperação e perda gradual da transformação, sem capturar o adversário.

Depois da confirmação, há segundo golpe, uppercut, perseguição aérea, socos/chutes, cinco ataques alternando os lados por teletransporte e um sexto teletransporte para preparar o Kamehameha descendente. Goku aterrissa dourado, observa sua mão, perde a transformação e retorna à forma base. Não há estado SSJ1 jogável, bônus de atributos, temporizador ou novos normais selecionáveis.

## Executar e inspecionar

```sh
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/art/goku-fury.html`. O laboratório usa o `Match` e o `Renderer` reais. Permite controlar Goku pelo teclado, executar cenários de acerto/defesa/erro/sem barra/interrupção/canto/KO, escolher Samurai/Dio/Goku, inverter lado, pausar, avançar ticks ou desenhos, variar velocidade, ampliar sem suavização e visualizar pivô, chão, limites e caixas do golpe inicial. A energia é preenchida ao reiniciar o laboratório; ela não é recarregada automaticamente durante a sequência.

Para a versão compilada no XAMPP, mantenha Apache iniciado. Pare o backend antes de atualizar e execute:

```sh
npm run build:lan
npm run start:lan
```

Abra `http://localhost/jogo-luta/art/goku-fury.html`. O mesmo personagem está no Contra BOT, Arcade e Treinamento. Energia infinita do treinamento é uma opção explícita do treino.

## Arquivos e arquitetura

- `src/data/goku-fury.json`: custo, capacidade, ganho de barra, duração, avanço e impactos. Ganho inicial de energia: **35%** do ganho convencional. Dano sem escalonamento: **368**, incluindo o primeiro soco. Startup **106 ticks**, janela ativa **5**, recuperação de erro/defesa **58**. Sequência confirmada **434 ticks**; preparação + sequência somam aproximadamente **9 segundos**.
- `src/engine/goku-fury.ts`: coreografia pura por tick, trajetórias contínuas do alvo, teletransportes explícitos, pontos de contato, câmera e fases. `goku-fury-move.ts` integra o primeiro soco ao sistema existente de ataques.
- `src/data/goku-fury-poses.json`, `goku-fury-contacts.json` e `goku-fury-release.json`: hurtboxes, punhos/pés e origem de energia baseados nos desenhos nativos. Apenas o primeiro golpe utiliza colisões normais; o filme confirmado aplica dano uma vez em cada tick programado.
- `src/engine/combat.ts` e `state.ts`: confirmação, captura, pausa dos clocks, liberação, KO após o encerramento e snapshot serializável. Nenhum cliente fornece vida ou dano por meio da sequência.
- `src/render/goku-fury-fx.ts`: aura, partículas, flash, impactos, feixe diagonal animado, explosão e fumaça independentes do corpo. Rastros curtos de dash e o núcleo do feixe utilizam também desenho procedural por pixels; tremor é calculado pela câmera.
- `public/sprites/goku/fury/`: **33 clips corporais**, **138 referências de células**, **94 desenhos distintos**, **14 folhas de efeitos**. Células corporais **384×256**, pivô **(192,224)**, transparência binária e paleta limitada. Há PNGs individuais, spritesheets utilizáveis e APNGs reais por clip.
- `art/goku/fury/`: fontes, prompts, relatório de extração, validação, hashes de preservação, contatos ampliados e gravações reais. A ferramenta usada foi **image_gen integrada**, seguida de importação de poses completas com nearest-neighbor. Nenhum membro foi reconstruído por morphing ou montagem de recortes.
- `public/previews/goku-fury-gameplay.png` e `.gif`: gravação real do Canvas. `goku-fury-contact.png`: todos os desenhos, chão, pivô e durações. `public/downloads/goku-fury.zip`: PNG/APNG/JSON e auditoria.

Um arquivo de origem tinha desenhos atravessando a divisão da grade. A importação agora identifica personagens completos e exclui somente pixels pertencentes aos personagens vizinhos. Duas fontes corporais foram rejeitadas e geradas novamente por falta de desenho/margem. As fontes de efeitos com fundo opaco ou células sobrepostas também foram substituídas. Os arquivos antigos aprovados permanecem protegidos por hashes.

## Regras de combate

Durante a preparação, o adversário pode agir, fugir, defender e interromper. O duplo quarto de círculo tem prioridade sobre Rajada de Ki forte; sem barra, o comando é consumido e não vira um especial gratuito. Um comando não pode ativar a Super duas vezes.

Durante o filme confirmado, os controles e colisões comuns não são executados. O cronômetro, projéteis e os clocks da Parada do Tempo ficam preservados. Há 15 impactos programados após o primeiro soco, com escalonamento de combo; Goku não ganha energia com seus próprios impactos cinematográficos. O inimigo recebe a animação de reação do próprio personagem e termina derrubado. Se ficar sem vida, o round só termina depois da perda da transformação.

Os snapshots incluem a fase/tick, participantes, escala de dano e âncoras. A simulação não depende do FPS de renderização nem de números aleatórios. Dados/fontes da simulação entram no hash de versão da rede.

## Verificação

```sh
npm test
npm run build
node node_modules/@playwright/test/cli.js test e2e/goku-fury.pw.mjs
```

Os testes cobrem energia, prioridade e rejeição de comandos inválidos, os dois lados, três adversários, confirmação, defesa, erro, interrupção, cancelamento a partir de normal, KO e sobrevivência, retorno ao combate, snapshots e preservação da recarga temporal. A auditoria de PNG verifica integridade, paleta, transparência, margens, empacotamento, pivôs, duração, contatos e APNGs quadro a quadro. As gravações e resultados ficam em `art/goku/fury/qa/`.

Verificação final em 02/11/2026: **490 testes de lógica, 123 testes distintos de arte e 60 testes distintos de navegador validados**, sendo quatro na versão compilada. Os cenários da Super incluem 42 combinações de adversário, direção e resultado. O registro `art/goku/fury/qa/verification.json` diferencia as execuções completas e os testes repetidos após ajustes de tempo na automação. O build passou; permanece o aviso já existente sobre o tamanho do bundle de dados dos personagens.

## Limitações reais

A arte foi assistida por geração de poses completas e passou por inspeção técnica e visual. Ainda existem pequenas variações de rosto, contorno e tecido que um animador poderia refinar manualmente; não equivale a uma produção profissional inteiramente desenhada pixel a pixel. Algumas poses ofensivas são reutilizadas em clips de teletransporte apropriados. Não são inventados desenhos para preencher ticks.

A câmera utiliza ampliações inteiras 1×/2× e cortes entre enquadramentos, preservando a nitidez. A transformação longa é intencionalmente vulnerável: cancelar um normal para a Super não garante um combo verdadeiro até o primeiro soco. O som utiliza somente os recursos de impacto existentes; a prévia exportada é silenciosa. Goku continua nos modos locais; a seleção online existente continua Samurai contra Samurai. O estado da Super foi preparado e testado para reprodução determinística, mas não foi disponibilizado como Goku online.
