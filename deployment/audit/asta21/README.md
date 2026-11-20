# Evidências de Asta — Prompt 2.1

Capturas reais do Canvas da arena em Chrome, por comandos de teclado. Não são páginas de laboratório.

- `nove-especiais.webm`: nove comandos, com efeitos ligados e depois desligados.
- `*-fx-preparation/contact/recovery.png` e `*-body-contact.png`: quadros corporais e contato.
- `relay-*.webm`: quatro aberturas, duas escolhas manuais, quatro espadas diferentes na finalização.
- `relay-*-action0..3.png`: abertura, primeira escolha, segunda escolha e finalizador.
- `black-slash-pursuit.png`: continuação opcional com novo J.
- `asta21-causality-contact-0.png`: neutralização real de Ki durante a janela ativa, em partida de dois clientes.
- `comparison-Dio.png`, `comparison-Goku.png`: escala com o elenco.
- `air-combo.png`, `arcade.png`, `versus.png`: integração com combate e modos.
- JSONs registram quadros, armas, contatos e estados observados durante as capturas.

## Validação antes da publicação

- TypeScript: passou.
- Vitest completo: **56 arquivos, 1.491 testes aprovados**; resultado bruto em `vitest-results.txt`.
- Asta: 22 testes de base + 36 de especiais + 79 de Relay = **137 testes**. O teste adicional do BOT foi executado após a suíte completa e passou separadamente.
- Relay: as 64 rotas são exercitadas nas duas orientações, com replay de snapshots.
- Browser: 6 testes de base + 3 de especiais/modos + 2 de Relay/Pursuit = **11 aprovados**.
- LAN: **4 testes aprovados** — seleção/quatro armas/air dash, nove especiais de quatro armas iniciais, Relay manual e neutralização elegível com captura do contato.
- Arte: **46 atlas**, seis cels distintos cada, transparência binária, margens e sockets válidos. **18 novos atlas corporais / 108 quadros**, sem FX embutido.
- Sprites-base, quatro armas e normais aprovados: nenhum diff.
- Nenhum checksum de combate ou teste legado foi modificado para aprovar a implementação.

As primeiras execuções revelaram expectativas incorretas em três testes novos (comparação de número com matcher, input durante hitstop, ID de ataque após retorno ao idle). As verificações foram corrigidas para observar o comportamento real, mantendo a checagem de altura, do buffer e de ausência de ataques vazados. A suíte completa final passou sem falhas legadas ou regressões.

## Comparação

A versão anterior está documentada em `../asta-specials/`, incluindo `nove-especiais.webm`. A nova versão substitui cortes isolados por corrida/salto descendente na Slayer, sequências de 2/4/6 contatos na katana e escolhas interativas no Relay. A inspeção foi feita também com os efeitos desligados.

## Publicação

Confirmada a publicação real do commit c5ba6f0, motor a204db1ca3461221044881c8: 103 recursos HTTP iguais a dist por SHA-256, backend existente reiniciado, cinco testes repetidos pelo Apache e uma partida adicional de dois clientes executando nove especiais, com escolhas manuais no Relay. Foram observados 810 ticks comuns com hashes iguais. Ver `publicacao.json` e `apache-lan-p1/p2.png`.

Este relatório é versionado depois da captura. Seu commit altera somente teste/documentação; a publicação final do HEAD é verificada novamente pelo mesmo atualizador. O computador remoto não foi presumido atualizado.
