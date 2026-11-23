# Entradas individuais do elenco

Branch: `codex/elenco-entradas-cinematograficas`. Base preservada: `7ea24a79f255294a6ad9bd33231d1cd21480baab`, da Super de Asta (#15). Esta mudança deve ser integrada depois dessa cadeia, sem substituir os especiais ou as Supers existentes.

## Apresentação

O primeiro round usa um relógio de introdução a 60 Hz. P1 começa primeiro; P2 entra 42 ticks depois. As apresentações duram de 150 a 186 ticks por lutador (2,5–3,1 segundos). Depois que ambos terminam, há 48 ticks de anúncio de round/FIGHT. O conjunto dura no máximo 4,6 segundos. Rounds seguintes usam apenas os 48 ticks; uma revanche reinicia as entradas completas e os votos.

- Samurai aproxima a mão da bainha, mostra a lâmina e assume a guarda.
- Dio caminha e executa sua sequência corporal exclusiva existente de 46 desenhos; The World se manifesta atrás dele e permanece presente.
- Goku ajusta o uniforme, prepara os braços e fecha a guarda; Ki discreto acompanha a preparação.
- Luffy segura a aba, ergue o chapéu e o acomoda nas costas pelo cordão antes da guarda.
- Sasuke observa o rival, ajeita a gola e mostra discretamente o olho vermelho; não ativa o selo amaldiçoado.
- Kaneki ajusta a máscara; uma manifestação cosmética breve de Kagune acompanha a mudança de postura.
- Ben consulta e manipula o Omnitrix, com brilho curto no pulso; continua humano.
- Xebec avalia o adversário e posiciona Eclipse, com Haki breve e sem alterar Dominação.
- Asta estende a mão ao grimório, recebe a Demon-Slayer existente, executa um floreio e mantém a espada equipada. Não entra em Black Asta ou Devil Union.

São oito atlas novos pequenos (oito desenhos por personagem, 64 cels inéditos), além da sequência já existente de Dio. Cada atlas runtime mede 1024×512, em células de 256×256 com pivô de pés 128/224. A escala é fixa por personagem em todos os quadros. Os sprites anteriores não foram substituídos.

`scripts/pack-entrances.py` conserva os originais em `art/entrances/source`, aplica amostragem nearest, alpha binário e uma paleta única por atlas, sem dithering. Samurai e Goku usam a paleta de referência nativa; os demais usam até 64 cores compartilhadas. As referências, prompts de geração original, caixas e parâmetros estão em `art/entrances/`. Asta utiliza a arma aprovada de `asta/arsenal.png`, com pegadas próprias por desenho; não há uma segunda espada desenhada no corpo. Grimório e efeitos de Ki, Haki, Kagune e luz são produzidos por código. The World continua usando os sprites originais do companion. Os sons novos são sintetizados pelo sistema do jogo.

## Combate, treino e rede

`src/engine/entrances.ts` define perfis, duração, deslocamento seguro, anúncio e votos. `Match.stepIntro` é o único caminho lógico: zera velocidades, mantém os pés na plataforma, neutraliza comandos e limpa buffers. Não atualiza o relógio de combate, ataques, projéteis ou recursos. Ambos recebem controle no mesmo tick, depois do FIGHT. O posicionamento usa a plataforma de 1280 px do motor atual e limita raízes a 120–1160 px. A apresentação não cria entidades de ataque ou perigos.

Em Treinamento, a entrada aparece ao iniciar. **Reiniciar posições** continua imediato; **Rever entradas** permite reproduzir a apresentação inteira. O painel de treino fica inativo durante a apresentação para não modificar as formas ou recursos no meio da coreografia.

**Enter** ou **Start** solicita pular. Offline, um comando encerra as apresentações e mantém o anúncio antes de liberar o combate. No LAN, cada assento tem um voto próprio; um jogador sozinho não consegue pular. A mensagem informa a regra e o aceite 0/2 ou 1/2. O segundo voto avança o mesmo relógio para ambos. Os votos percorrem o InputFrame existente, a validação e sanitização da sala, os pacotes autoritativos e os snapshots; não existe um transporte paralelo. O fingerprint do motor inclui o módulo novo. Inputs amostrados durante a introdução são neutralizados no cliente antes do envio, evitando que ataques enfileirados vazem para o primeiro instante da luta.

## Validação reproduzível

```powershell
node scripts/net_version.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=75000 --exclude '**/.npm-cache/**'
node scripts/run_art.mjs tests/test_entrance_art.py
```

A suíte completa passou com **61 arquivos e 1.503 testes**. Os testes novos verificam todos os lutadores, quadros próprios, recursos preservados, buffers, margens, liberação simultânea, rounds curtos, revanche, sons, snapshot/replay, protocolo e votos pela sanitização real de `Rooms`. Os testes de arte verificam 64 cels diferentes, alpha, paleta, margens, escala e anchors nas mãos. Testes antigos de combate agora iniciam explicitamente depois da apresentação; testes de intervalo usam sua duração real, em vez de presumir 100 ticks.

Para capturar todos no jogo servido:

```powershell
$env:MSFD_TEST_URL='http://localhost/2025/M.S.F.D/'
$env:MSFD_ENTRANCE_EVIDENCE='deployment/audit/entrances/apache'
node scripts/verify-entrances.mjs
$env:MSFD_ENTRANCE_EVIDENCE='deployment/audit/entrances/apache-lan'
node scripts/verify-entrances-lan.mjs
```

O primeiro script usa a seleção real e grava nove vídeos do Canvas, quadros de ambas as orientações, transição para idle, tentativa de ataques durante a introdução, reset rápido, reprodução e skip. O segundo abre dois clientes reais no backend existente e compara hashes durante o início natural e o skip por dois votos. Não modifica o combate publicado. Para testar rounds/revanche com lutas abreviadas em ambiente isolado, `MSFD_ENTRANCE_SERVER` pode apontar para `server-core.mjs` compilado do projeto: a factory existente abre somente durante o teste e os fixtures autoritativos encurtam as lutas entre apresentações. Essa opção não deve ser usada junto do backend publicado na mesma porta.

Capturas, vídeos e resultados ficam em `deployment/audit/entrances/`. A inspeção visual é necessária: os testes de geometria e hashes não avaliam sozinhos a personalidade da atuação.

## Publicação XAMPP

O atualizador existente continua responsável pelo build de produção e pelo reinício verificado do backend Node/Socket.IO. A checagem HTTP também confere os oito atlas novos, a apresentação de Dio e a aparição de The World por SHA-256.

```powershell
# Na pasta real do projeto, com a branch publicada e a árvore limpa:
git switch codex/elenco-entradas-cinematograficas
.\atualizar-msfd.cmd -Branch codex/elenco-entradas-cinematograficas
node scripts/check-msfd-publication.mjs http://localhost/2025/M.S.F.D/ (git rev-parse HEAD)
```

Depois da integração da cadeia de PRs, utilizar `git switch main` e `.\atualizar-msfd.cmd -Branch main`. Cada computador XAMPP precisa executar a atualização localmente; publicar a branch no GitHub não atualiza outra instalação. Nenhum merge ou force push na main faz parte desta entrega.
