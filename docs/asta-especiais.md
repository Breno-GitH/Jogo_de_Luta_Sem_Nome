# Asta — nove especiais e troca integrada

> Registro da etapa 2. Comandos e mecânicas atuais foram substituídos pelo [Prompt 2.1 — rushdown e Relay](asta-relay.md). Este documento permanece como histórico para comparação.

Etapa 2 sobre a base aprovada do PR #11. Super R e Sword Chain avançado continuam reservados à próxima etapa.

## Comandos
- ↓ → J: Black Rush — avanço e corte horizontal; Demon-Slayer.
- ↓ → K: Rising Demon — corte ascendente e perseguição aérea em acerto; Demon-Slayer.
- ↓ → L: Black Divider — extensão temporária de antimagia, finalizador de alcance 210, recuperação longa; Demon-Slayer.
- ↓ ← J: Iai Slash — saque rápido com avanço curto; Demon-Slasher.
- ↓ ← K: Black Flash Steps — dois contatos independentes, com deslocamento; Demon-Slasher.
- ↓ ← L: Severing Line — corte de pressão de alcance 140, finalizador; Demon-Slasher.
- ↓ ↓ J: Black Slash — corte viajante finito; Demon-Dweller.
- ↓ ↓ K: Causality Break — janela de neutralização e resposta próxima; Demon-Destroyer.
- ↓ ↓ L: Dual Anti-Magic Break — corte Dweller, troca e golpe Destroyer. Uma espada por vez.

Frente e trás são relativos ao adversário. Solte baixo entre os dois toques de ↓↓.

## Trocas e interrupções
A arma anterior permanece até o saque desenhado. O novo equipamento é confirmado nos ticks 3/4/6 para os especiais Slayer, 1/2/4 para Slasher, 4 para Black Slash e 3 para Causality. Dual confirma Dweller no tick 3 e Destroyer no 26. Retém a última espada confirmada ao sofrer interrupção, inclusive após erro. Cancelamentos confirmam a etapa anterior antes do novo ataque. Não há botão de troca em combate; o seletor do Treinamento serve apenas para preparar cenários de teste.

## Combate
Normais J/K podem cancelar em especiais após acerto, dentro de suas janelas. Black Rush, Iai e a segunda conexão de Flash podem ligar a outro especial. Não se repete uma técnica na mesma sequência; máximo de três especiais por combo. Continuam os limites da base: 14 contatos, seis aéreos, 245 ticks. Finalizadores não permitem reiniciar normais gratuitamente. Flash e Dual possuem duas janelas reais: cada contato só acerta uma vez, pode ser defendido ou falhar separadamente.

Black Slash tem vida de 26 ticks, velocidade 12, intervalo mínimo de 48 ticks após liberação e apenas um projétil ativo. Nasce próximo à região da lâmina para atingir também em curta distância.

Causality neutraliza uma manifestação por execução nos ticks 7–11, ao contato com Eclipse. Política explícita: Ki comum e Kamehameha de Goku; Gokakyu e Hosenka pequenos de Sasuke. Não neutraliza aço físico, pedras, Haki, antimagia, dragões de fogo, agarrões ou Supers. Feixes compatíveis são dissipados. A resposta próxima passa de 52 para 76 de dano e lança, sem invulnerabilidade.

## Arte e efeitos
Onze atlas curtos, seis cels corporais exclusivos cada, distribuídos em 3 × 2. Flash e Dual têm dois segmentos, sem um atlas gigante. Mantidos os 17 atlas aprovados da base e as quatro armas. Escala fixa de empacotamento 0,30; pivô 128/224; encaixes por mão e cel compartilhados com as cápsulas de colisão.

Sprites contêm corpo/vestuário e armas. Todos os efeitos novos são código: extensão Divider, corte Severing, projétil Black Slash, partículas, ruptura Causality, contatos e transição pelo grimório. Sem sprites de FX, gradientes HD ou aleatoriedade na simulação. Extensões e projétil continuam visíveis com cosméticos desligados para comunicar sua área de acerto.

Fontes e prompts ImageGen (ferramenta integrada): art/asta-source/sources.json e frames/special-*.png. Empacotamento reproduzível por scripts/pack_asta.py. Nenhum asset conceitual ou de efeito é usado como substituto de movimento corporal.

## Validação e publicação
- tests/asta-specials.test.ts: nove técnicas, quatro equipamentos iniciais, ambas orientações, defesa/erro, estágios e interrupções, dano, projétil, neutralização e replays.
- e2e/asta-specials.pw.mjs: entrada real, nove especiais com FX ligados/desligados, capturas por cel e gravação; Arcade e Versus BOT.
- e2e/lan/game.pw.ts: nove técnicas × quatro equipamentos em dois clientes e neutralização Causality; compara hashes com servidor autoritativo.
- scripts/check_asta_art.py: cels distintos, alfa, margens e sockets.
- Evidências: deployment/audit/asta-specials/ e deployment/audit/lan/asta-special-*.

Para publicar esta branch no XAMPP: atualizar-msfd.cmd -Branch codex/asta-nove-especiais. Após integrar os PRs: atualizar-msfd.cmd -Branch main. Executar dentro da instalação real. O atualizador verifica Git, testes, dependências, backend existente, build:lan, versão HTTP, hashes dos assets e Socket.IO; não declara sucesso com frontend antigo ou backend incompatível.

## Resultados — 20/11/2026
- TypeScript aprovado.
- Vitest: 55 arquivos e 1.426 testes aprovados, incluindo 71 testes de Asta. Log em deployment/audit/asta-specials/vitest.txt.
- Nove cenários de navegador validados: nove especiais com efeitos ligados/desligados, base/36 normais, combos, perseguição aérea, Arcade, Versus BOT e comparação de escala com Dio/Goku. O teste de combo aéreo foi repetido e aprovado após corrigir a prioridade do input no ar.
- Dois testes LAN aprovados: quatro espadas/air dash e nove especiais × quatro equipamentos iniciais, mais neutralização. Estados dos dois clientes comparados ao hash autoritativo.
- Arte: 28 atlas de seis cels, incluindo onze novos; transparência, margens e encaixes aprovados. Os 17 atlas e as quatro armas da etapa 1 permanecem iguais.
- Builds de produção do frontend e backend aprovadas; permanece o aviso de tamanho de chunks do Vite. A publicação real no Apache é verificada pelo atualizador e por build-info.json.
- Não foi executada novamente toda a coleção de scripts Python legados dos demais personagens. Executada a auditoria específica de arte de Asta.

Lista exata de arquivos da etapa: asta-especiais-arquivos.txt. A etapa depende da base do PR #11: integrar primeiro a base à main e depois esta continuação. Nenhum merge automático da main é realizado.

Revisão visual final: ajustado o ângulo da conclusão do Black Divider e limitada sua dissipação ao plano do chão. O alcance ativo permanece 210 e compartilha os encaixes usados pelas colisões. Um teste percorre todos os ticks ativos para impedir que a ponta ultrapasse o chão. Capturas e vídeo foram regenerados e inspecionados após a correção.
