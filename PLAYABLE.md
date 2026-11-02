# Samurai 0.2 — modos, IA e polimento

Continua sobre o mesmo motor e os mesmos 293 quadros. Nenhum PNG aprovado foi substituído. As cores âmbar/violeta usam apenas a rampa vermelha indexada: pele, cabelo, metal, transparência e geometria permanecem intactos. As variantes são preparadas antes da luta, em pequenos trabalhos entre repinturas da tela, e apenas uma paleta extra permanece no cache. Cancelar um carregamento não pode trocar a cor de uma sessão posterior.

## IA

`Bot` produz `InputFrame`, assim como o teclado. Pode controlar qualquer lado para testes e recebe uma semente determinística. A observação coleta posição, velocidade e animação pública; nenhuma decisão consulta a entrada ou o buffer do oponente. Histórico limitado a cem ticks. Pausas, hitstop e capturas não dão reações gratuitas.

- Fácil: percepção atrasada 26 ticks (~433 ms), decisões a cada 16–24 ticks, confirmação própria de 8 ticks; defesa 30%, continuação de combo 48%.
- Normal: percepção de 17 ticks (~283 ms), decisões a cada 10–15 ticks, confirmação de 5 ticks; defesa 62%, combo 80%.
- Difícil: percepção de 10 ticks (~167 ms), decisões a cada 6–9 ticks, confirmação de 3 ticks; defesa 82%, combo 96%.

As porcentagens se aplicam quando a situação permite a ação, não a todo frame. Aproximação e recuo dependem da distância percebida, velocidade observada e vida própria. Punição considera recuperação percebida, tempo que já passou e alcance. Ataques rápidos, mudanças de direção e erros de leitura podem vencer sua defesa. Probabilidades também governam pulo, agarrão, anti-aéreo, especiais e Ultimate.

Combos usam contato confirmado do próprio golpe, com atraso após hitstop. O BOT envia J/K/L, W e comandos direcionais normais; não invoca ataques diretamente. Rotas incluem leve → médio → forte, launcher → salto → leve → médio → forte no ar e cancelamento terrestre em especial/Ultimate. Confirmações podem falhar; a dificuldade muda a consistência. Recursos e regras de cancelamento são os mesmos do jogador.

## Fluxo de jogo

`GameSession` mantém o modo e os confrontos; `Match` mantém cada disputa. Arcade define três adversários em `src/data/arcade.json`: ciano/fácil, âmbar/normal, violeta/difícil. Cada confronto exige dois rounds. Vida e energia recomeçam no próximo adversário; energia continua entre rounds do mesmo confronto, como antes. Um empate repete a disputa sem conceder vitória.

A tela entre confrontos exige avançar explicitamente. Derrota permite tentar o confronto atual novamente. Concluir a terceira disputa oferece um novo Arcade do começo. Reiniciar durante uma luta reinicia sua disputa inteira, preservando modo, dificuldade e adversário. Menu cancela carregamentos pendentes. Pausa e perda de foco congelam simulação e apresentação do combate.

## Treinamento

Opções independentes de vida infinita para ambos e energia infinita; relógio não expira. Vida infinita impede reduzir HP, mas aplica dano nominal, colisão, stun, hitstop, combo e knockdown normalmente. Medidas vêm de eventos semânticos de acerto, incluindo agarrão e cada corte do Ultimate, sem inferir dano pela diferença de vida. Defesa conta zero. Um Ultimate sem combo mede dez impactos e 299 de dano.

Sem vida infinita, é possível tomar KO; o treino reproduz KO e restaura ambos após a pausa de round. Não apresenta resultado final nem trava a sessão. Parceiro pode ficar parado, defender alto/baixo no lugar, pular repetidamente ou usar a IA selecionada. Trocar comportamento restaura sua velocidade normal. Reiniciar conserva as opções, mas restaura posições/vida/energia inicial e limpa medidores. Zerar medidores só limpa os números.

## Apresentação e resposta

O preenchimento da vida converge rapidamente ao HP real; um rastro vermelho segura a perda por 18 ticks e depois desce. Cura e mudança de round restauram a barra. Energia, relógio e pontos de round refletem a simulação. Feedback de combo conserva hits e dano brevemente após a sequência. Reações e efeitos pixelados já existentes permanecem integrados.

Teclado registra a postura no evento do botão para não perder agachamentos curtos entre ticks. Pulo em preparação não pode ser reiniciado a cada novo comando. Menus animam sua entrada; a preferência de movimento reduzido desativa suas animações. Todas as configurações de treino têm função. Contra Amigo foi acrescentado na etapa seguinte; consulte ONLINE.md.

Sons são sintetizados localmente com osciladores e ruído filtrado: corte, impacto, impacto forte, defesa, contra, ativação, início e KO. São originais e não exigem downloads. Contexto de áudio é iniciado por interação, com mute e controle de volume. Fontes externas foram removidas para funcionamento local sem rede. Não há música/voz.

## Verificação

Testes de regras cobrem atraso de percepção, proibição de leitura de inputs, determinismo, três perfis e 27.000 ticks de autojogo. Verificam usos reais de leves/médios/fortes, punição, recuo, defesa, agarrão, combos aéreos, especiais e energia. Sessões testam a rota Arcade inteira, derrota/retry e isolamento das regras de treino. Há verificações de dano com vida infinita, reset após KO, medidores, barras e cores. Os testes anteriores de combate e arte continuam ativos.

Chrome verifica menus, dificuldade, pausa, reinício, teclado, treino, dano, Ultimate, som e tamanho menor de janela. `e2e/flow.html` é uma entrada **somente de teste**, excluída do build: reduz HP para acelerar os KOs, usando o aplicativo, rounds e telas reais. Seus testes percorrem todas as etapas e as paletas e cancelam um carregamento para detectar troca de sessão indevida. Ela não concede atalhos ao jogo distribuído. Capturas ficam em `art/samurai/qa/game/`.

O balanceamento continua inicial. As simulações detectam falhas de integração e travamentos, mas não substituem partidas humanas para medir diversão, variedade e dificuldade percebida. A etapa online está documentada em ONLINE.md. Não há áudio gravado, save, replays ou controles além do teclado.
