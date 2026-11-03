# Jogo de luta no XAMPP e multiplayer LAN

**Combate atualizado:** R ativa as três Supers; Goku possui teletransporte aéreo J/K/L e perseguição de combos. Regras e verificação da revisão atual: [COMBATE-FRENETICO.md](COMBATE-FRENETICO.md). Os números de testes da seção de migração abaixo são o registro daquela implantação.

O projeto existente foi adaptado. O Apache serve o frontend de produção; o Node.js executa o combate e o Socket.IO por trás do proxy. Vite não é necessário para jogar. Samurai, Dio/The World e Goku usam o mesmo motor e os mesmos recursos dos modos locais.

## Endereços e arquivos

- Projeto editável: `C:\xampp\htdocs\2025\Jogo_de_Luta_Sem_Nome`.
- Frontend publicado: `C:\xampp\htdocs\2025\Jogo_de_Luta_Sem_Nome\dist`.
- Endereço principal: [http://localhost/jogo-luta/](http://localhost/jogo-luta/).
- Endereço completo, também suportado: [http://localhost/2025/Jogo_de_Luta_Sem_Nome/](http://localhost/2025/Jogo_de_Luta_Sem_Nome/).

Os dois endereços são aliases do **mesmo** build. Não há outro jogo nem cópia manual do index. O Apache não publica a raiz de desenvolvimento: `src`, `node_modules`, `.env`, configurações, scripts e backups ficam fora do diretório servido. As URLs de sprites, sons, laboratórios e Socket.IO derivam da origem e do caminho atuais do navegador. Não há IP da LAN fixado no frontend.

```text
src/                     frontend TypeScript, motor e dados editáveis
public/sprites/          personagens, Stand e efeitos originais
public/previews/         prévias reais dos personagens
art/*.html               laboratórios e inspeção de animações
server/                  salas, validação e simulação autoritativa
server-dist/             backend compilado para Node.js
dist/                    único frontend publicado pelo Apache
deployment/
  apache-game.conf.in    modelo de proxy/aliases e restrição de acesso
  backups/               configurações do Apache anteriores à instalação
  previous-dist/         versão anterior do frontend após atualizar
  audit/                 hashes de preservação, capturas e registros de testes
  run/                   metadados locais de execução e fixtures de testes
scripts/                 build, instalação, inicialização e diagnóstico
e2e/lan/                 testes reais com dois processos Chrome
tests/lan.test.ts        seleção, salas e replay determinístico
```

## Iniciar para jogar

Requer Node.js 22 ou superior, npm e o XAMPP instalado em `C:\xampp`.

1. Abra o painel do XAMPP e inicie **Apache**. MySQL não é necessário.
2. Execute `iniciar-multiplayer.bat` na raiz do projeto. Mantenha a janela aberta; ela mostra erros e os endereços disponíveis. Ctrl+C encerra o backend. Uma segunda execução detecta o serviço existente e não inicia uma cópia duplicada.
3. Abra [o jogo no Apache](http://localhost/jogo-luta/).

BOT, Arcade, Treinamento e os laboratórios funcionam com o Apache, mesmo com o backend desligado. Contra Amigo precisa dos dois processos. Não execute `npm run dev` para jogar a versão publicada. O Apache foi iniciado e testado durante esta instalação; posteriormente use o painel do XAMPP para iniciar/parar o serviço normalmente.

Se precisar reinstalar dependências ou configurar outro XAMPP: execute `npm ci`, `atualizar-xampp.bat`, depois `configurar-xampp.bat`. O instalador aceita `-XamppRoot` e pode precisar de uma janela com permissão para escrever em `apache\conf`. Antes de reiniciar o Apache, ele valida uma configuração de preparação, faz backup dos arquivos globais, instala e valida novamente. Em falha de sintaxe, restaura os arquivos anteriores.

Nesta máquina foi encontrado **Apache 2.4.58 (Win64)**. Foram ativados `mod_proxy_http` e `mod_proxy_wstunnel`, além do `mod_proxy` já ativo. A configuração instalada está em `C:\xampp\apache\conf\extra\httpd-jogo-luta.conf`, incluída por `httpd.conf`. O backup inicial está em `deployment\backups\apache-20261102-174837-23fc09\httpd.conf`; o registro completo está em `deployment\audit\apache-install.json`.

## Atualizar o jogo após alterações

1. Encerre o backend com Ctrl+C e termine as partidas em andamento.
2. Execute `atualizar-xampp.bat`, ou `npm run build:lan`.
3. O processo verifica TypeScript, gera o Vite com caminhos relativos, compila o backend e publica **todo** o novo frontend. O build é preparado fora de `dist`; somente após sucesso substitui o diretório completo. A versão anterior fica em `deployment\previous-dist`. Uma falha na troca restaura o frontend anterior.
4. Execute `iniciar-multiplayer.bat` e atualize a página nos dois computadores.

O script recusa atualizar se o serviço na porta interna 3001 estiver ativo. Não edite arquivos em `dist` ou `server-dist` manualmente. Reiniciar o backend encerra salas em memória: crie um novo código. O build contém `build-info.json`; a versão deve coincidir com `api/health`. HTML e JSON recebem instrução de revalidação de cache. Use Ctrl+F5 se um navegador ainda guardar recursos antigos.

Se aparecer uma tela branca após a migração e o log mostrar `/src/main.ts` com 404, o navegador ainda está usando o index de desenvolvimento em cache. Acesse `http://localhost/2025/Jogo_de_Luta_Sem_Nome/?apache=production` ou pressione Ctrl+F5. O index publicado deve carregar `assets/game-*.js`, nunca `/src/main.ts`. A verificação reproduzível está em `node scripts/check-apache-page.mjs`, com captura em `deployment/audit/lan/apache-menu.png`.

`npm run dev` e `npm run dev:server` continuam disponíveis exclusivamente para desenvolvimento. `npm run build` continua sendo o build genérico; para publicar esta instalação com registro e troca completa use **build:lan**.

## Entrar pela rede local

O servidor é o computador que executa XAMPP e Node. No terminal dele, execute:

```powershell
node scripts/verificar-lan.mjs
ipconfig
hostname
```

Use o IPv4 da interface Ethernet/Wi-Fi ativa. Na inspeção de **02/11/2026**, esta máquina informou `192.168.3.15` e nome `DESKTOP-J7NIOKG`. Esses valores podem mudar; são exibidos novamente pelo iniciador, não gravados no frontend.

O amigo abre `http://IP-ATUAL-DO-SERVIDOR/jogo-luta/`, por exemplo `http://192.168.3.15/jogo-luta/` enquanto esse IP continuar válido. O endereço completo `/2025/Jogo_de_Luta_Sem_Nome/` também funciona. Pode usar `http://DESKTOP-J7NIOKG/jogo-luta/` se a rede resolver esse nome. **Localhost no computador do amigo apontaria para o próprio computador dele.**

Ambos devem estar na mesma rede privada, sem isolamento de clientes Wi-Fi. Não há serviço externo obrigatório nem necessidade de abrir portas no roteador. Não foi configurado acesso à internet pública.

## Criar sala, escolher e lutar

1. Abra **Jogar com amigo → Criar sala**. O backend gera e reserva um código aleatório único de seis caracteres.
2. Compartilhe esse código. O amigo abre **Entrar em sala**, informa o código e confirma.
3. Cada jogador escolhe Samurai, Dio ou Goku, clica **Confirmar personagem** e depois **Pronto**. Trocar a escolha remove confirmação e prontidão anteriores. Personagens iguais usam paletas diferentes.
4. Quando os dois estiverem conectados, confirmados e prontos, o anfitrião usa **Iniciar partida**. O convidado não pode iniciar à força.
5. Joguem com os controles normais. Cada navegador controla seu próprio jogador com A/D, W, S, J/K/L, Shift, U, R e os comandos direcionais dos personagens. Goku usa R para Fúria Saiyajin; R mantém a função existente de Samurai/Dio.
6. Ao terminar, ambos podem pedir **Revanche**. **Voltar ao lobby** permite selecionar novamente e reutilizar o código. **Sair** libera a vaga ou encerra a sala vazia.

Código inválido, sala inexistente, sala recentemente encerrada e sala cheia têm erros distintos. Há no máximo dois jogadores, identificação de conexão e token de recuperação por sessão. Salas não compartilham inputs nem eventos de combate.

## Como a sincronização funciona

O Node é a autoridade sobre cada partida: executa o motor compartilhado em ticks fixos de 60 Hz e calcula colisões, dano, recursos, rounds e resultado. Os clientes enviam apenas inputs numerados, limitados e sequenciais. Não existe evento para o cliente definir vida, dano, alvo confirmado ou vitória.

Os navegadores reproduzem somente os inputs aceitos e publicados pelo servidor, na mesma ordem. Cada tick inclui um hash comparável; checkpoints periódicos e recuperação limitada permitem restaurar o estado autoritativo se houver divergência. Não há previsão livre de dano local. As animações, projéteis, Parada do Tempo, histórico de recarga entre rounds e fases/câmera de Road Roller/Fúria Saiyajin fazem parte desse estado compartilhado.

O atraso inicial padrão é **6 ticks (100 ms)**, além do tempo de rede/processamento. `INPUT_DELAY_TICKS` em `.env` aceita inteiro entre 3 e 18; reinicie o backend para aplicar. A rede LAN reduz parte do trajeto, mas não elimina latência. O renderizador continua separado do tick; não foi adicionada interpolação de posições que pudesse deformar pixel art ou deslocar hitboxes.

Quando inputs faltam, a simulação espera e informa conexão lenta. Em desconexão, preserva a vaga por até **15 segundos** no serviço normal. Retorno dentro da janela tenta recuperar a mesma partida por token/checkpoint. Ao expirar, o combate encerra com aviso e permite voltar ao lobby. Atualizar a página e entrar novamente em Contra Amigo recupera a sessão enquanto a janela permitir. Fechar o navegador ou perder os dados da sessão pode impedir a recuperação. Reinício do Node perde salas, e a interface informa que é preciso criar outra.

O servidor limita frequência de RPCs, conexões, criação/entrada, ressincronizações e horizonte de inputs; valida propriedades, personagens e códigos. Um header de IP encaminhado só é considerado quando veio do proxy loopback. A origem Socket.IO precisa corresponder ao Host atual; não há liberação universal de origens no iniciador LAN.

É **delay netcode com servidor autoritativo**, não rollback. A evolução para rollback exigiria prever inputs ausentes, guardar snapshots por tick, restaurar/reexecutar ao chegar uma correção e deduplicar efeitos/áudio; a simulação e serialização existentes são a base. A implementação atual prefere esperar e recuperar com segurança a prever resultados divergentes.

## Apache, proxy e portas

- TCP **80**: Apache, entrada dos jogadores pela LAN.
- TCP **3001**, somente **127.0.0.1**: Node/Socket.IO interno. Não é necessário abrir no navegador nem liberar no firewall.
- Vite **5173**: somente desenvolvimento, dispensável para jogar.
- MySQL/phpMyAdmin não participam do jogo. Não é necessário iniciar MySQL nem liberar 3306.

Os caminhos públicos são `/jogo-luta/socket.io/` e `/2025/Jogo_de_Luta_Sem_Nome/socket.io/`, encaminhados a `/socket.io/` interno. O proxy aceita o polling HTTP inicial e o upgrade WebSocket. Nesta versão do Apache, `mod_proxy_http` atende upgrade WebSocket desde 2.4.47; `ProxyRequests Off`, `ProxyPreserveHost On` e timeout de 60 segundos estão configurados. O timeout supera o heartbeat padrão do Socket.IO. Fontes: [Apache — upgrade por proxy HTTP](https://httpd.apache.org/docs/2.4/mod/mod_proxy_wstunnel.html), [Socket.IO — proxy reverso e timeouts](https://socket.io/docs/v4/reverse-proxy/).

O diretório de produção permite apenas acesso local e endereços privados. Os outros diretórios em `htdocs` e o dashboard ficam restritos ao próprio servidor; phpMyAdmin mantém sua restrição local do XAMPP. Não são publicados diretórios internos nem listagem de pastas. A alteração global de `htdocs` é deliberada para não abrir outros projetos à LAN; o backup permite revisar/restaurar a configuração anterior.

## Diagnóstico de conexão

Execute `node scripts/verificar-lan.mjs`. Ele consulta ambos os aliases, mostra versões do build/backend e informa IPs locais.

```powershell
Invoke-RestMethod http://localhost/jogo-luta/build-info.json
Invoke-RestMethod http://localhost/jogo-luta/api/health
Invoke-RestMethod http://localhost/2025/Jogo_de_Luta_Sem_Nome/api/health
& C:\xampp\apache\bin\httpd.exe -t
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 80,3001 }
```

`api/health` deve responder JSON com `ok: true`, `service: jogo-luta-lan` e a versão atual. Se responder 503, confirme o backend e leia sua janela. Se o jogo retornar 404, confira `dist`, os aliases e o Include do Apache; execute `configurar-xampp.bat` e valide a sintaxe antes de reiniciar. Porta 3001 ocupada resulta em erro explícito, sem encerrar outro processo automaticamente.

No DevTools → Network, a conexão usa o mesmo host do jogo, no caminho `.../socket.io/`, com polling HTTP 200 e depois WebSocket 101. Se o upgrade for bloqueado, Socket.IO pode permanecer em polling; não há garantia de desempenho equivalente. Confira `C:\xampp\apache\logs\error.log` e `access.log`. Se versões diferirem, pare o backend, refaça build:lan, inicie novamente e atualize os dois clientes.

Se funcionar no servidor e não no amigo, confirme IP, rede privada, isolamento de Wi-Fi e firewall. **Não desative o firewall.** Se necessário, em PowerShell como administrador execute:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\permitir-apache-lan.ps1
```

Esse script opcional permite apenas `httpd.exe`, TCP 80, perfil **Private**, origem **LocalSubnet**. Não foi executado nesta instalação porque os testes locais não exigiram alteração do firewall. Não libera Node, MySQL ou toda a máquina. A interface usa HTTP para uma LAN de confiança; não é um serviço público com TLS/autenticação de contas.

## Testes e limites da verificação

Os testes de navegador LAN usam dois **processos Chrome independentes**: um abre localhost com o alias curto; o outro usa o IPv4 real da interface com o alias completo. Ambos continuam no **mesmo computador físico**. Isso testa Apache, proxy, origens/caminhos, transporte e combate real, mas não prova conectividade através de outro PC, Wi-Fi ou firewall da rede.

Testado nesta migração:

- Menus/build e laboratório aninhado pelos dois aliases; hostname local; sem dependência do Vite, erros de recursos ou publicação de fontes/dependências.
- Salas reais, código inválido/inexistente, terceiro jogador recusado, isolamento entre salas, confirmação, prontidão e início exclusivo pelo anfitrião.
- Polling e upgrade WebSocket pelo Apache nas duas rotas.
- Samurai, Dio e Goku: normais, especiais e cinematografias nos dois clientes, comparando hashes de ticks com o servidor. Inclui Mil Cortes, facas, Muda Muda, Parada do Tempo, Road Roller, Ki, Kamehameha, Teletransporte e Fúria Saiyajin, com retorno da câmera.
- Atualização de página/recuperação da mesma partida, dois KOs/rounds, resultado, revanche preservando personagens, desconexão definitiva, reutilização do lobby e reinício do backend.
- Parada e reinício reais do processo Apache durante uma partida, perda detectada pelos dois navegadores e recuperação com hashes iguais ao servidor. Esse teste usou uma janela de recuperação de 30 segundos para permitir a operação manual; o serviço normal mantém 15 segundos. Não foi um clique automatizado no painel XAMPP.
- Todas as nove combinações de personagens com replay determinístico dos inputs autoritativos em testes de unidade.
- `npm test`: **502 testes de lógica + 123 testes de arte** aprovados. O agendamento foi limitado a um worker para evitar que o teste longo de self-play da IA exceda seu timeout por concorrência; as regras e asserções da IA não foram alteradas.

Os testes de cinematografias configuram posição/energia **diretamente no servidor de teste**, para exercitar cada habilidade rapidamente. O cliente usa teclado, conexão e renderizador reais; o dano/colisões continuam no motor. Esse auxílio não existe como endpoint no serviço publicado. Os registros e capturas dos dois clientes estão em `deployment/audit/lan/`. `deployment/audit/preserved-game.json` registra os 3.979 arquivos de combate/dados/sprites preservados.

Para repetir: pare o backend comum, mantenha Apache ligado, execute `npm run build:lan`, `npm test`, `npm run test:lan`. A suíte LAN inicia e encerra seu próprio backend em loopback. Ela não altera configurações do Apache; o teste opcional de interrupção do Apache exige controle explícito do processo pelo operador. Evite executar os testes pesados de arte/IA simultaneamente aos dois navegadores nesta máquina.

**Ainda precisa ser verificado em dois computadores físicos:** abra o IP do servidor no PC do amigo; crie/entre/confirme/inicie uma sala; mova e ataque dos dois lados; teste os três personagens e Supers; complete uma partida, peça revanche e desconecte/reconecte um participante. Confira o proxy/heartbeat no DevTools dos dois. Teste também parar/iniciar Apache pelo painel XAMPP e a conectividade após mudanças de rede. Não foi realizado teste com um segundo computador disponível.

Limitações: salas e progresso online são voláteis, não há migração do servidor para outro PC, autenticação de contas, matchmaking público ou rollback. O limite de retomada é finito. Congelar uma aba ou sobrecarregar o PC pode atrasar os dois jogadores; o serviço não promete ausência de lag. As limitações artísticas já documentadas de cada personagem permanecem; não foram alterados desenhos ou gameplay para esta migração.
