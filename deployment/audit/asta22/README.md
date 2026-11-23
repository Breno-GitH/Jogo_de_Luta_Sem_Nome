# Asta — evidências do Prompt 2.2

Capturas e gravações reais do Canvas da arena, em Chrome, com comandos do jogador. Não são páginas de laboratório ou imagens conceituais. Fontes e SHA-256 das capturas selecionadas em `captures.json`.

## O que observar

- `causality-tendrils.png`: cinco fluxos curvos e afilados ligados à Demon-Destroyer, com volume escuro e margem vermelha/violeta discreta. A camada atrás do corpo mantém rosto, mãos e arma legíveis.
- `causality-real-recent-damage.webm` e `causality-real-hp.json`: dano recebido de um BOT real, seguido da restauração de 701 para 761 HP, limitada a 60. O cooldown registrado era de 1.175 ticks restantes.
- `astaCausalityBreak-*-preparation/channel/retraction.png`: preparação, canalização e retração, também com efeitos desligados.
- `black-slash-volley.png` e `black-slash-three-guarded.webm`: três lâminas diagonais independentes, todas defendidas sem perda de HP.
- `black-divider-contact.png`: massa larga, face negra e ponta chanfrada, com a lâmina e as mãos acompanhando o movimento.
- `black-slash-long-range.webm`, `black-slash-preparation.png` e `black-slash-flight.png`: preparação vulnerável e sequência de projéteis rápidos de longa distância, sem perseguição automática.
- `grimoire-cover-return.png`, `grimoire-pages-emerge.png` e `grimoire-sword-contact.png`: capa escura envelhecida, páginas em movimento e a arma chegando à mão. O contador de combo foi afastado das escolhas do Relay.
- `nove-especiais.webm`: todos os nove comandos com efeitos ligados e depois desligados.
- `slayer-k-dweller.webm`, `slasher-l-destroyer.webm`, `dweller-k-slasher.webm` e `destroyer-j-slayer.webm`: quatro aberturas e quatro finalizações distintas, com uma única escolha. Os JSONs registram todas as 12 rotas.
- `body-*.webm`: as quatro continuações com FX desligados; movimento corporal, empunhadura e contatos continuam existindo.
- `guard.json` e `timeout.json`: nenhuma escolha/arma automática.
- `comparison-Dio.png`, `comparison-Goku.png`, `ground-combo.png`, `air-combo.png`, `arcade.png` e `versus.png`: escala e integração com o combate/modos.
- `lan-*.json/png`: dois clientes com consumo dos mesmos estados, remoção seletiva de metadados de teste, restauração, cooldown e punição antes do lançamento. Metadados artificiais de status existem apenas nos testes.
- `preserved-assets.json`: os 48 PNGs anteriores de Asta continuam byte a byte iguais ao commit-base; as seis animações corporais aprovadas de espada, base e normais permanecem preservadas; Black Divider recebeu a nova forma e cápsula solicitadas.

## Verificação

- TypeScript aprovado.
- Vitest completo: **57 arquivos / 1.447 testes**, sem falhas. Log em `vitest.txt`.
- Asta: **92 casos** (22 base, 31 especiais, 24 Relay, 15 Causality). A proteção contra projétil residual de uma execução anterior está incluída na suíte final.
- Browser: **14 cenários distintos** (6 base, 3 especiais/modos, 2 Relay, 3 Black Slash/Causality). Os dois cenários de Relay foram repetidos após a última proteção e o ajuste da HUD. Os seis cenários de especiais/modos/↓↓ foram repetidos após a revisão da sequência tripla e de Black Divider.
- LAN: **7 cenários distintos**, incluindo as 12 rotas, quatro armas iniciais nos nove comandos, restauração/remoção/cooldown e punição física. Inclui a defesa independente das três lâminas à distância.
- Auditoria de arte: **60 atlas**, cada um com seis cels distintos, alpha binário, margens e sockets válidos; nenhuma empunhadura pendente. Esta etapa acrescenta 14 atlas / 84 quadros corporais.
- Build de produção de validação concluída. Permanece o aviso anterior de chunks maiores que 500 kB do Vite.
- A coleção inteira de scripts Python legados dos demais personagens não foi reexecutada. Nenhum checksum ou teste legado foi alterado para esconder regressões.

O teste novo de defesa inicialmente esperava idle ao final; o boneco segurando a direção de defesa usa walk com velocidade zero. A expectativa foi corrigida para idle/walk, preservando as três defesas, HP intacto e ausência de blockstun persistente.

## Referências e comparação

O desenho por código do grimório parte da capa gasta e quase preta mostrada nos produtos oficiais do anime e do Studio Pierrot. A função da Demon-Destroyer foi conferida na sinopse e nas imagens oficiais do episódio 103. Links e limites da pesquisa em `../../../docs/asta-22.md`. Nenhum frame/foto dessas fontes foi copiado para os recursos finais.

A versão anterior pode ser comparada em `../asta21/`: Black Slash tinha perseguição, Causality era uma investida física e Relay tinha duas escolhas direcionais. Essas regras foram substituídas; as gravações antigas permanecem históricas.

Os FX são exclusivamente código. Os sprites corporais novos foram produzidos com a ferramenta de imagem integrada em modo built-in e empacotados sem FX; prompts completos em `../../../art/asta-source/v22-sources.json`.

## XAMPP

O resultado de publicação do commit final é verificado depois do commit/push, pelo atualizador existente e por dois clientes reais no backend da instalação. A presença destas capturas de validação, isoladamente, não comprova uma publicação no Apache. O relatório final da entrega informa o commit e a versão efetivamente servidos.

Comandos e ordem dos PRs dependentes em `../../../docs/asta-22.md`.
