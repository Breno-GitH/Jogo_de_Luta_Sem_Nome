# Dio comanda; The World luta — revisão 3

**Atualização:** os três especiais comuns foram adicionados sem alterar os normais descritos aqui. Facas são arremessadas por Dio; Rush e Tempo usam o Stand. Veja [DIO-ESPECIAIS.md](DIO-ESPECIAIS.md) para comandos, recarga e validação atual. As contagens de testes e a lista de limitações abaixo registram a etapa dos normais.

Os nove ataques normais são executados exclusivamente pelo Stand. Dio permanece em poses de comando, sem socos, chutes, espada ou hitboxes ofensivas corporais. Esta revisão substitui os antigos normais físicos; preserva as bases, todas as animações aprovadas de movimentação e os PNGs do Samurai.

## Executar e experimentar

```sh
npm install
npm run dev
```

Abra [o laboratório de combate](http://127.0.0.1:5173/art/dio-combat.html). Escolha um golpe ou uma das quatro sequências e use **Executar sequência**. No treino livre, A/D movem Dio, W pula, S agacha e J/K/L comandam o Stand. É possível enfrentar Samurai ou outro Dio. No menu principal, selecione Treinamento ou Contra BOT, Dio Brando e o adversário desejado. Arcade continua com sua rota existente de três Samurais.

Para servir a versão compilada com o servidor existente:

```sh
npm run build
npm start
```

Abra [127.0.0.1:3001](http://127.0.0.1:3001/), [o combate](http://127.0.0.1:3001/art/dio-combat.html) ou [o inspetor de desenhos](http://127.0.0.1:3001/art/dio.html). Atualizações de arquivos exigem novo build nesse modo.

## Golpes, tempos e combos

Tempos em ticks fixos de 1/60 s, enumerados a partir de zero. Os intervalos de contato são fechados no início e abertos no final. Hitstop pausa esses relógios. Desenhos têm durações individuais e não equivalem a um tick cada.

- **Stand Light:** 6 desenhos; startup 6, ativo 3, recuperação 12; dano 42. Soco curto e rápido. Avanço máximo relativo: +12 px.
- **Stand Medium:** 7 desenhos; 9/6/13; dano 72. Soco direto com quadril e ombro. Avanço máximo: +42 px.
- **Stand Heavy:** 8 desenhos; 17/6/18; dano 116. Soco pesado, alcance maior e recuperação mais longa. Avanço máximo: +84 px.
- **Crouch Light:** 6 desenhos; 7/3/16; dano 38. Soco baixo, flexão das pernas. Avanço máximo: +14 px.
- **Crouch Medium:** 7 desenhos; 12/6/19; dano 64. Varredura baixa com o braço. Avanço máximo: +45 px.
- **Crouch Heavy:** 8 desenhos; 14/9/19; dano 88. Uppercut; lança somente ao acertar sem defesa. Avanço máximo: +56 px.
- **Air Light:** 6 desenhos; 5/3/12; dano 38. Soco aéreo rápido. Avanço máximo: +18 px.
- **Air Medium:** 7 desenhos; startup 7, duas janelas ativas [7,9) e [13,16), recuperação final 14. Há quatro ticks sem hitbox entre os contatos. Dano base dividido em 32 + 38; a redução de dano de combo produz 32 + 34 = **66** num golpe isolado com ambos acertando. Avanço máximo: +43 px.
- **Air Heavy:** 8 desenhos; 13/6/17; dano 108. Soco descendente com derrubada ao conectar. Avanço máximo: +66 px.

Esses avanços são os offsets da referência do Stand em relação a Dio, não o alcance total dos punhos. O motor ajusta a aproximação à distância do adversário. Cada golpe também configura knockback, hitstun, blockstun, nível de defesa e hitstop próprios em `src/data/dio.json`.

Combos confirmados, dentro das janelas de cancelamento:

- J → K → L em pé: 3 impactos, 200 de dano nas condições do laboratório.
- S + J → K → L mantendo S: 3 impactos, 166 de dano.
- No ar, J → K → L: 4 impactos, 173 de dano; Medium contém os dois contatos.
- S + L conectando → W → J → K → L: 5 impactos, 240 de dano.

Os valores caem com a redução progressiva do combo. Distância, altura e defesa podem fazer um contato falhar. O launcher permite jump cancel apenas após confirmar o acerto. O pequeno avanço automático do jump cancel usa configuração própria; a caminhada aprovada não foi acelerada para facilitar combos.

Não existe repetição ilimitada do mesmo normal: os cancelamentos seguem os destinos e intervalos configurados, exigem contato e respeitam a progressão leve/médio/forte. Limites adicionais são 12 acertos, 8 acertos aéreos e 240 ticks de combo, excluindo hitstop.

## Stand independente

`src/engine/stand-combat.ts` controla posição, orientação, profundidade, relógio, ataque, ligação de combo, reação e retorno. O estado é serializado nos checkpoints. A posição física e os relógios são independentes dos animadores de sprites.

Em neutro, a referência do Stand fica 30 px atrás e aproximadamente 18 px acima da de Dio, com flutuação discreta. Avanço e retorno interpolam posições reais em ticks fixos. O sprite troca de camada quando cruza para a região ofensiva. Facing inverte offsets e caixas; o retorno pode se ajustar a uma mudança de lado sem reposicionar instantaneamente a entidade.

Durante um combo, o novo ataque parte da posição atual do Stand. Uma transição específica conecta o desenho realmente exibido ao próximo golpe. Não há retorno obrigatório ao neutro entre J, K e L. O jump cancel conserva a pose de uppercut por uma janela curta, acompanha a física vertical e liga ao primeiro golpe aéreo. Dio usa quatro desenhos complementares de comando para sair do agachamento nessa ligação, sem alterar seus sprites de salto aprovados.

Ao receber dano, Dio perde as hitboxes ofensivas imediatamente, The World mostra uma reação curta e retorna. Capturas de agarrão também atualizam o Stand. Não há vida separada para ele; não é uma segunda hurtbox que possa receber dano. A defesa e o dano recebido pertencem a Dio. Hurtboxes de Dio seguem suas poses de comando; as caixas ofensivas usam os punhos nas poses e coordenadas reais de The World.

Air Medium registra IDs distintos para os dois contatos. O segundo não reativa o primeiro, nem mesmo após restaurar um checkpoint entre os impactos. Intervalos sem contato não mantêm caixas invisíveis.

## Arte e arquivos exportados

Pixel art produzida pelo pipeline articulado existente, com novas poses, punhos fechados, joelhos e quadril flexionados, braços independentes, rotações do tronco e recuperação específica por golpe. PNGs RGBA com transparência binária, sem antialiasing; paleta de 35 cores por entidade; células 256×256, pivô (128,224), orientação original para a direita. As bases mantêm alturas aproximadas de 130/155 px.

- **The World, 13 sequências solicitadas:** avanço 5; soco rápido 6; direto 7; pesado 8; baixo 6; varredura 7; uppercut 8; soco aéreo 6; soco duplo 7; esmagamento 8; recuperação geral 4; retorno 5; transição geral 5. Total: **82 desenhos**.
- **Complementos do Stand:** reação de interrupção 3; nove recuperações específicas, 44 desenhos. Total com os anteriores: **23 sequências e 129 desenhos**, além de **81 transições específicas** entre poses de combo.
- **Dio:** neutro de comando 4; apontar 5; comando forte 6; agachado 4; aéreo 4; recuperação 4; ligação do jump cancel 4. **7 sequências e 31 desenhos.** Os nove nomes canônicos de ataque de Dio também exportam essas poses de comando; esse reaproveitamento é intencional.

Arquivos úteis:

- `public/sprites/dio/commands.json`: manifestos e poses de comando; PNGs independentes de The World.
- `public/sprites/the-world/stand-actions.json`: ações, poses, durações e caixas do Stand.
- `public/sprites/the-world/combo-transitions.json`: ligações específicas por desenho de origem e ataque de destino.
- `src/data/dio.json`: propriedades e janelas de combate; `*-animations.json`: animações e pivôs.
- `scripts/build_stand_normals.py`: geração reproduzível, validação de preservação e pacote. Execute `npm run art:dio:attacks` para regenerar.
- `public/sprites/previous-body-attacks/`: histórico dos antigos ataques, isolado do conteúdo usado em combate.
- `art/dio/stand-only-preservation.json`: hashes da movimentação aprovada e do Samurai.

[Pacote PNG + JSON](http://127.0.0.1:3001/downloads/dio-normal-attacks.zip). Inclui as folhas, células individuais das ações, folhas das transições, bases, paletas e propriedades. Combina com o pacote de movimentação anterior; não é um personagem completo independente do motor.

[Prévia animada real — APNG](http://127.0.0.1:3001/previews/dio-stand-combo.png), [GIF](http://127.0.0.1:3001/previews/dio-stand-combo.gif). São capturas do Canvas do motor, avançado um tick por vez; câmera ampliada 2× por nearest-neighbor. O GIF reduz a reprodução para 30 fps; o APNG mantém o tempo de 60 ticks. Hitstop produz repetições intencionais. A prancha em `art/dio/qa/stand-only/the-world-contact.png` serve para inspeção estática e não substitui as folhas reais.

## Depuração

O laboratório oferece os nove golpes, quatro combos, golpe no vazio, interrupção, treino livre, inimigo Samurai/Dio, facing invertido, troca de lado do alvo, aproximação máxima ajustável, caixas, pivôs, rastreio do deslocamento e estados dos dois personagens. Mostra janelas e IDs já consumidos, fase de combate, número de comandos encadeados, dano e retorno. Os presets de combo fixam sua distância de teste; golpes individuais permitem ajustá-la.

É possível pausar, avançar um tick, avançar até o próximo desenho de Dio ou do Stand, diminuir velocidade, ampliar 1×/2×/3× e rever os ticks gravados. O inspetor `/art/dio.html` permite examinar cada célula, reproduzir cada sequência, ocultar entidades e baixar o PNG. A comparação antiga continua limitada às animações de movimentação que possuem arquivos anteriores correspondentes.

## Validação desta revisão

Resultado executado: **230 testes TypeScript, 49 de arte, 33 cenários no Chrome e cinco cenários online com dois navegadores passaram**. O build passou. A versão compilada da porta 3001 também passou por 18 golpes isolados e oito combos; a gravação final contém 104 ticks reais. A correção do processo de captura foi retestada separadamente.

```sh
npm test
npm run test:browser
npm run test:online
npm run build
```

Os testes unitários verificam todos os nove golpes × duas orientações × dois adversários; os quatro combos nesses mesmos pares; dano e limite de contatos; caixas na entidade correta; dano, defesa e whiff do launcher; cancelamentos inválidos; interrupção, captura, troca de lado, retorno, limites de combo e restauração determinística entre os dois impactos aéreos. Os testes de arte verificam cada célula, paleta, alfa, contorno sem suavização, rosto preservado, dimensões dos membros, endpoints das transições, caixas dos punhos e os hashes preservados.

Os cenários no Chrome executam os golpes no motor real, combos, quadro a quadro, replays, inspeção de todos os desenhos, seleção Dio contra Dio e captura da prévia. A regressão também cobre os modos e golpes existentes do Samurai. Os logs, capturas e traços ficam em `art/dio/qa/stand-only/`; `validation.json` registra a contagem final e os resultados efetivamente executados.

## Limitações reais

O pipeline usa recortes articulados da base e retoques de pixels. Há poses distintas de pernas, braços e tronco; não é um redesenho manual completo de anatomia e armadura em todas as perspectivas. Rotações extremas, sobreposição de placas e expressões faciais alternativas ainda podem ter rigidez e ficam abaixo de uma produção M.U.G.E.N desenhada integralmente por animador humano. O rosto permanece consistente pela preservação de pixels, com atuação facial limitada.

Reações de dano, entrada, vitória e derrota de Dio continuam provisórias. Os normais usam o feedback de impactos existente, sem efeitos ou vozes novos. Facas, especiais, Ultimate e agarrão próprios de Dio não foram criados; os comandos não fingem executá-los. Contra Amigo permanece Samurai contra Samurai. Os novos estados são serializáveis e determinísticos, mas habilitar Dio no protocolo online requer uma etapa própria de compatibilidade e testes.
