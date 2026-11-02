# Salas privadas e netcode

A execução final agora é **Apache/XAMPP + Node em loopback**, com Samurai, Dio/The World e Goku. Instruções atuais de instalação, aliases, proxy, LAN, firewall, criação de sala, confirmação/prontidão, início pelo anfitrião, atualização e testes: [README_LAN.md](README_LAN.md).

`iniciar-multiplayer.bat` inicia o backend interno; `http://localhost/jogo-luta/` abre o jogo. Amigos usam o IP do servidor com o mesmo caminho. A URL Socket.IO usa a origem atual; não há `VITE_ONLINE_URL` a configurar. O modo LAN não publica o Node diretamente nem usa serviços externos.

Para desenvolvimento, `npm run dev` + `npm run dev:server` mantêm Vite e proxy local. HOST agora tem padrão 127.0.0.1. O iniciador LAN mantém esse bind e porta 3001 independentemente de HOST/PORT. `INPUT_DELAY_TICKS` configura o atraso de 3 a 18 ticks (padrão 6).

## Sincronização e autoridade

O servidor executa `Match.step` a 60 Hz. A mensagem de entrada contém somente identificação da partida, tick e `{direction, down, pressed}`. A vaga vem da conexão associada à sala, nunca de um `playerId` escolhido pelo cliente.

Cada época começa com ticks neutros conforme o delay configurado. Os navegadores enviam comandos futuros sequenciais. O servidor aguarda os dois para executar o tick, sem adivinhar comandos faltantes. Repetições, lacunas, outra partida, não participantes, campos/botões inválidos e entradas além de 90 ticks são recusados. O cliente limita seu avanço a 24 ticks sobre o último tick recebido. Há limites de payload, frequência de inputs, solicitações, conexões e quantidade de salas.

Depois de simular, o servidor transmite a dupla de inputs realmente usada e um hash. Cada cliente reproduz essa dupla, sem prever o adversário. Vida, dano, colisões, recursos e resultados são calculados pelo servidor; não há endpoint que aceite esses valores, posições ou snapshots enviados pelos navegadores.

O snapshot inclui física, estados, stun, buffer de comandos com seus relógios, rounds, captura cinematográfica e contadores internos. A restauração usa uma lista explícita de campos e reconstrói os protótipos; não importa dados de personagem do snapshot. O bobbing da captura usa pixels inteiros, evitando diferenças de `Math.sin` no estado sincronizado.

Um fingerprint SHA-256 das fontes/dados compartilhados bloqueia versões incompatíveis. Ele é gerado antes de desenvolvimento, build e testes. O hash curto de cada tick detecta divergências; não é assinatura de segurança. A proteção vem da autoridade central e dos campos que o servidor aceita.

Socket.IO preserva a ordem dos eventos entregues, mas não repõe automaticamente todos os eventos perdidos após uma desconexão. A recuperação é da aplicação, conforme as [garantias de entrega](https://socket.io/docs/v4/delivery-guarantees/) e a [documentação de desconexões](https://socket.io/docs/v4/tutorial/handling-disconnections) oficiais.

## Recuperação

Sem o próximo comando necessário, o combate aguarda. Após 250 ms, a interface informa conexão lenta. Após cinco segundos, a disputa termina por ausência de inputs, ou sem vencedor se faltarem os dois lados. Uma aba em segundo plano pode ser limitada pelo navegador e provocar essa espera.

Uma desconexão detectada congela a luta e reserva a vaga por **15 segundos**. O token fica no `sessionStorage` daquela aba. Recarregar e abrir Contra Amigo recupera a vaga dentro do prazo; uma nova aba/navegador sem token não pode assumi-la. Após o prazo, uma luta em andamento é encerrada; uma vaga de lobby pode ser liberada.

Ao retomar, o servidor cria nova época com seu estado atual. Vida, posições e recursos são preservados, mas teclas e comandos pendentes são limpos para evitar controles presos ou golpes acumulados. Retome os controles após a recuperação.

Há checkpoints a cada 60 ticks. Um hash divergente causa restauração pelo checkpoint ou nova época global. Três recuperações são permitidas numa janela de 30 segundos; divergência repetida encerra a luta sem inventar um vencedor. A revanche começa uma disputa nova.

Salas ociosas expiram após cinco minutos. Salas e tokens existem só em memória e desaparecem se o Node reiniciar. O limite padrão de cem salas contém uso de memória; não é um benchmark de cem lutas simultâneas.

## Evolução para rollback

Esta versão usa lockstep com atraso e autoridade central, sem rollback. O caminho previsto é:

1. Guardar snapshots e inputs num ring buffer por tick; o codec já captura o estado escondido dos comandos.
2. Aplicar imediatamente o input local e prever o remoto.
3. Quando o input real diferir, restaurar o snapshot anterior e ressimular.
4. Confirmar ou deduplicar áudio/efeitos para que ressimulação não repita impactos.
5. Manter resultados confirmados no servidor e limitar a janela de rollback; fora dela, restaurar checkpoint ou encerrar com aviso.
6. Expandir testes entre runtimes e avaliar ponto fixo/quantização para reduzir diferenças numéricas.

Não há previsão, servidor distribuído/Redis, persistência, contas, ranking, espectadores ou matchmaking público. O projeto não promete ausência de latência nem proteção anti-cheat/DDoS completa. É uma implementação privada inicial com validação autoritativa, não uma infraestrutura competitiva pronta.

## Testes e arquivos

```sh
npm test
npm run build
npm run test:browser
npm run test:online
```

`test:online` compila e abre **dois processos Chrome separados**. Um servidor real em 3101 e um Vite isolado em 5175 verificam salas inválidas/cheias, seleção, pronto, movimento e dano nos dois sentidos, hashes, resultados, revanche, recarga e desconexão. Um cenário usa o cliente compilado servido pelo Node, sem proxy Vite.

A fixture altera apenas o espelho de um navegador para provar que o HP do servidor não muda e a recuperação corrige o cliente. Reduções de HP para acelerar os resultados são feitas pelo teste dentro do processo servidor, não por uma API de cliente. Fixtures não entram no build. As capturas ficam em `art/samurai/qa/online/`. A verificação foi local, não geográfica em WAN nem de carga.

```text
server/index.ts           entrada Node e configuração
server/server.ts          HTTP, Socket.IO, origens, limites e rotas
server/rooms.ts           salas, vagas, ticks e recuperação
src/net/protocol.ts       contratos e validação
src/net/client.ts         inputs numerados, reprodução e retomada
src/net/version.ts        fingerprint gerado
src/engine/state.ts       snapshots, restauração e hash
src/ui/online.ts          entrada, lobby e resultado
scripts/net_version.mjs   versão das fontes e dados
scripts/build_server.mjs  compilação para Node
tests/network.test.ts     regras e fronteira Socket.IO
e2e/online/               testes com dois Chromes
```
