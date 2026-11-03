# Goku — normais, defesa, dano e agarrão

Registro da etapa 2. A etapa 3 acrescenta os [três especiais comuns](GOKU-ESPECIAIS.md), preservando os normais, suas animações e seus dados documentados aqui.

Implementado no motor existente. A movimentação MOV5 e todos os PNGs/dados de Samurai, Dio e The World permanecem preservados por hashes. Goku está disponível no Contra BOT, Arcade e Treinamento locais. Seus especiais e Super não foram implementados.

Abra [o jogo](http://localhost/jogo-luta/) ou [o laboratório de combate](http://localhost/jogo-luta/art/goku-combat.html). Com `npm run dev`, use a porta 5173. Para servir a versão compilada: `npm run build`, depois `npm start`.

J/K/L executam leve/médio/forte. S altera para normais agachados; durante o salto são usados normais aéreos. U tenta agarrar. Segure a direção oposta ao adversário para defender; acrescente S contra baixos. W cancela o uppercut **após contato confirmado**. O buffer e o hitstop pertencem ao combate em ticks fixos de 60 Hz.

## Golpes e combos

Os nove normais têm 63 desenhos exportados, preparação, impacto e recuperação. Nas listas abaixo, os números são **startup / ativo / recuperação em ticks**, seguidos do dano base:

- Stand Light: soco dianteiro, 4 / 4 / 8, 42 de dano, 6 desenhos.
- Stand Medium: chute lateral, 8 / 5 / 11, 66 de dano, 7 desenhos.
- Stand Heavy: soco com transferência de peso, 9 / 5 / 14, 100 de dano, 8 desenhos.
- Crouch Light: soco baixo, 4 / 3 / 10, 38 de dano, 6 desenhos.
- Crouch Medium: rasteira, 8 / 5 / 11, 62 de dano, 7 desenhos.
- Crouch Heavy: uppercut launcher, 9 / 5 / 14, 88 de dano, 8 desenhos. Avança 21 px durante a preparação; não lança ao errar ou na defesa.
- Air Light: soco aéreo, 3 / 4 / 6, 36 de dano, 6 desenhos.
- Air Medium: chute aéreo, 6 / 4 / 8, 59 de dano, 7 desenhos. Sustenta brevemente o atacante após contato para viabilizar a continuação.
- Air Heavy: chute descendente, 6 / 4 / 12, 92 de dano, 8 desenhos. Derruba e finaliza o combo.

Há sequências J → K → L em pé e no ar, S+J → S+K → S+L e S+L → W → J → K → L. Os cancelamentos respeitam contexto, contato e janela de cada golpe; não passam pelo Idle entre ataques. Cada janela ativa registra um único contato por alvo. O dano cai 10 pontos percentuais por contato anterior, com piso de 35%. Os limites de Goku são 8 contatos totais, 6 aéreos e 180 ticks de combo; alcançar um limite força a queda.

Os testes aéreos do laboratório usam comandos comuns. Dio recebe uma pequena antecipação no salto de teste porque possui outra física; o cenário de chute descendente contra Goku posiciona o alvo um pouco abaixo por meio de um salto atrasado. Nenhuma hitbox é ampliada para forçar esses acertos. Em jogo, alcance e diferença de altura continuam decidindo se o ataque conecta.

## Defesa, dano e agarrão

São 31 animações de combate, com 126 referências de quadros no total. Além dos normais, há guarda alta/baixa, impactos e recuperação da defesa, dano leve/médio/forte/agachado/aéreo, lançado, queda, derrubado, levantar, KO, tentativa de agarrão, execução, vítima e recuperação.

O pacote contém 114 desenhos distintos ao desconsiderar translações; alguns são compartilhados entre clipes de reação relacionados. Não há duplicação disfarçada de movimento dentro de um mesmo clipe.

A recuperação visual de dano/defesa pode ser interrompida imediatamente por movimento ou novo ataque; não acrescenta atraso aos comandos. O KO conserva seu último desenho até o encerramento. O chão e os pivôs permanecem coerentes ao derrubar e levantar.

O agarrão usa a captura compartilhada do motor, configurada por dados. Tem alcance e recuperação de erro, captura de 22 ticks, arremesso em trajetória definida, um único evento de 125 de dano no tick 12 e knockdown. O atacante permanece ancorado; a vítima é limitada à arena. Pular ou sair do alcance evita a captura. A reprodução de snapshots durante ataques e agarrões é determinística.

## Arquivos e produção

- `src/data/goku-normals.json`: balanceamento, janelas e caixas de cada pose.
- `src/data/goku-combat.json`: reações, aliases, limites e trajetória do agarrão.
- `src/data/goku-combat-animations.json`: desenhos e duração individual em ticks.
- `src/engine/goku-data.ts`: composição com os dados de movimentação preservados.
- `src/render/goku-combat.ts`: seleção de reações e recuperação visual.
- `public/sprites/goku/combat/`: folhas PNG, quadros individuais e APNGs transparentes.
- `scripts/goku_combat_art.py`: importação validada de poses completas.
- `art/goku/combat/`: fontes, instruções de produção, coordenadas de importação e auditoria.
- `art/goku/combat/shared-engine-revisions.json`: hashes e justificativas das extensões compartilhadas; o congelamento original continua intacto.

As células de combate usam **384×256**, pivô **(192,224)**, para acomodar chutes sem cortes. As células de movimentação mantêm 256×256 e seu pivô original. O Animator lê a geometria de cada animação; trocar de pacote não desloca a raiz física.

As poses completas foram produzidas com image_gen usando o Goku MOV5 como referência. O importador aplica uma única escala uniforme por folha de calibração, nearest-neighbor, 32 cores, alfa binário e alinhamento inteiro. Não há morphing, montagem ou deformação de membros. Oito pixels escuros isolados do soco forte foram removidos por coordenadas revisadas; a validação impede apagar pixels conectados ao corpo e registra as cores originais. Uma pose de queda com a bota tocando a borda da fonte foi rejeitada.

Corrigidos durante a integração: recorte de células largas, registro horizontal da rasteira e dos chutes, ponto de impacto do uppercut que inicialmente seguia o rosto, alinhamento após golpes agachados, sustentação do combo aéreo contra os três adversários, câmera de inspeção durante agarrões e inicialização do visualizador.

## Inspeção e testes

O laboratório permite cenários reais contra Samurai, Dio e Goku, inversão de lado, controle livre, combos, seleção dos 31 clipes, pausa, avanço por tick ou desenho, ¼× a 2×, zoom inteiro, pivô/chão, limites, hitboxes e hurtboxes. Os medidores acumulam os eventos reais do Match. A opção vida infinita mantém colisões e stun.

`npm test` executa a lógica e a validação de arte. `npm run test:browser` usa o Chrome instalado. `npm run art:goku:combat` reexporta as poses já produzidas; não chama geração de imagens. `node scripts/run_art.mjs scripts/package_goku_combat.py` empacota os PNGs, dados e capturas reais após os testes de navegador. A configuração `playwright.goku-production.config.mjs` testa o servidor compilado em 3001.

Relatórios detalhados ficam em `art/goku/combat/qa/`: confrontos em ambos os lados, combos, reações, sequência do launcher, imagens de todos os quadros, gravação do Canvas, log completo e validação de produção.

Verificação final de 2 de novembro de 2026: **408 testes de lógica, 105 testes de arte, 51 cenários de regressão no Chrome e 2 testes do servidor compilado passaram**. Os cinco testes de combate do Goku foram repetidos após a limpeza final e passaram novamente. `npm run build` passou. A produção foi conferida em `127.0.0.1:3001`, com a versão `eab6e61d1eeacc2543022544` e igualdade dos PNGs, pacote e prévias servidos. A prévia contém 555 capturas reais do Canvas; APNG/GIF de inspeção usam redução nearest-neighbor e 10 FPS, enquanto o combate permanece em 60 ticks por segundo.

## Limitações

A arte foi assistida por geração de imagens e revista por folhas e capturas. Ainda existem pequenas diferenças de cabelo, rosto e dobras entre desenhos, e algumas preparações/recuperações poderiam receber refinamento manual. Os testes numéricos comprovam integridade e integração, não equivalência artística a uma produção profissional de M.U.G.E.N.

As hurtboxes são faixas retangulares conservadoras derivadas das poses; não são colisões por pixel. As hitboxes ofensivas são cápsulas locais no punho/canela/bota. Balanceamento e tolerância dos combos ainda precisam de sessões humanas mais longas.

Goku continua fora do protocolo de seleção online. Não há especiais, Super, provocação ou poses exclusivas de entrada/vitória nesta etapa; o encerramento usa o comportamento existente. O rascunho inacabado de especiais encontrado antes do trabalho foi arquivado sem ativar suas habilidades.
