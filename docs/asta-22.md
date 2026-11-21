# Asta — Prompt 2.2: Black Slash, Causality Break e Relay

Base: `codex/asta-relay-rushdown`, commit `42e8592a3029d2bb1fe0bc1a407f69357a8acdf3` (PR #13). Implementação nesta branch: `codex/asta-especiais-2-2`. Enquanto #13 estiver aberto, ele é a base deste PR. Os PRs #11 → #12 → #13 precisam ser integrados antes desta etapa.

## Comandos jogáveis

- **↓↓J — Demon-Dweller: Black Slash:** preparação vulnerável de 29 ticks; emissão única no movimento de corte; três ticks ativos e 18 de recuperação. Projétil cortante a 18 px/tick, dano-base 90, vida máxima de 70 ticks e intervalo de 110 ticks. Sem invulnerabilidade, avanço ou continuação por J. Interromper antes da emissão impede o disparo; saltar e defender continuam válidos.
- **↓↓K — Demon-Destroyer: Causality Break:** preparação corporal, cinco extensões curvas de antimagia da lâmina, expansão e retração. Janela de neutralização nos ticks 12–31, no máximo três entidades elegíveis por execução. Restauração/remoção de status no tick 24; animação total de 48 ticks e recuperação de 16. Não acerta, agarra, lança ou dá invulnerabilidade.
- **↓↓L — Anti-Magic Relay:** abre com a espada equipada. Um acerto legítimo oferece uma única escolha nova J/K/L durante 16 ticks. A ordem fixa é Slayer, Slasher, Dweller, Destroyer, excluindo a espada inicial. Direções não mudam o mapeamento. A HUD mostra as três opções. A tecla L usada na ativação e inputs anteriores ao acerto não escolhem automaticamente.

O Relay sem escolha termina a abertura com a arma inicial. Defesa ou erro não abrem escolha. A continuação confirma a espada no terceiro tick; interrupção anterior preserva a arma antiga. Não existe uma segunda escolha.

Cada continuação tem corpo, ritmo e final próprios: Slayer faz dois golpes e termina com corte descendente/knockdown; Slasher faz quatro cortes rápidos; Dweller combina golpe próximo, avanço e corte projetado curto; Destroyer faz ruptura frontal e três contatos, com neutralização limitada de magia e sem restauração de HP. Todas mantêm recuperação, escalonamento e limites globais de combo/juggle. Não há captura, reposicionamento forçado do adversário, câmera especial ou pausa do timer.

## Restauração e compatibilidade

Parâmetros ajustáveis em `src/engine/asta-causality.ts`:

- Considera apenas HP realmente perdido nos últimos 240 ticks de combate.
- Recupera 30%, arredondado para baixo, limitado a 6% do HP máximo e à vida faltante.
- 150 de dano recente permite recuperar 45 HP; 400 permite recuperar no máximo 60 de 1.000 HP.
- Cooldown de 1.200 ticks de combate (20 s), preservado ao trocar espada, combo, interrupção ou usar outro especial.
- Cada recibo de dano contribuinte é consumido uma única vez; não acumula saldo para usos futuros, não cura dano antigo nem ressuscita após KO.
- Interrupção anterior ao tick de restauração impede a recuperação. Não há cancelamento imediato depois dela.
- Durante o cooldown, neutralização e remoção de status continuam disponíveis. Treinamento com vida infinita não gera dívida fictícia de HP.

`Move.energy` é o contrato explícito para técnicas futuras. A compatibilidade legada preserva Ki/Kamehameha básicos e Katon elegível. Supers, ondas de dragão, técnicas protegidas/não classificadas, Haki, aço e golpes físicos não são apagados. Cortes projetados podem colidir com energia compatível, dissipando ambos.

`CombatStatus` é apenas metadado tipado para futuros produtores: identificador, origem, tipo, expiração e política de remoção. O Causality remove somente condições mágicas temporárias marcadas como removíveis. Não adiciona veneno, queimadura ou lentidão aos personagens atuais. Condições físicas, permanentes e os estados fundamentais do combate permanecem preservados.

## Grimório e antimagia por código

O livro abre durante a troca integrada ao ataque; uma única arma retorna, emerge e alcança a mão antes do primeiro frame ativo. A última confirmação lógica é preservada. Não se simula troca quando a espada já está equipada. A capa quase preta apresenta manchas, desgaste, trevo de cinco folhas, lombada e bloco de páginas. As folhas viram durante o saque. O livro continua visível com efeitos cosméticos desligados porque explica a arma em uso.

As extensões usam cinco trajetórias cúbicas determinísticas, amostradas também pelas cápsulas de neutralização: volume escuro, espessura decrescente, bordas pixeladas, reflexo marrom/violeta discreto e pontas que se desfazem. A origem acompanha o socket da Demon-Destroyer. A camada fica atrás do corpo e da arma, preservando rosto, mãos e silhueta. Não usa eletricidade, membros físicos, Kagune, blur, gradientes ou FX em sprites.

### Referências reais consultadas

- [Episódio 103 — site oficial do anime, sinopse e quatro imagens](https://bclover.jp/season1/story/detail.php?id=1000644): nova espada saindo do grimório e uso para desfazer o efeito mágico no padre Orsi. As imagens foram inspecionadas; não se afirma ter assistido ao episódio inteiro.
- [Causality Break — episódio licenciado pela Crunchyroll](https://www.crunchyroll.com/watch/G0DUN00Z9/release-from-misfortune).
- [Capa de grimório de Asta/Yuno — produto divulgado pelo site oficial](https://bclover.jp/season1/goods/item.php?id=1007778): contraste da capa gasta e escura de Asta com o livro claro de Yuno.
- [Grimório de Asta — Studio Pierrot](https://studio-pierrot-store.jp/view/item/000000000376): capa quase preta, manchas castanhas, trevo escuro e espessura das páginas. O produto é referência da capa, não da iluminação do efeito.

O desenho curvo das correntes é uma adaptação própria de antimagia para a escala do M.S.F.D.; a recuperação limitada de HP é uma regra deste jogo. Nenhuma fotografia, frame do anime ou textura desses sites foi incorporada aos assets finais.

## Animação e arquivos

Doze atlas corporais curtos novos, seis cels por atlas: **72 quadros**. Black Slash e Causality têm preparação e execução/recuperação novas; as quatro continuações do Relay têm dois atlas próprios cada. As quatro aberturas aprovadas do Relay e os seis especiais ↓→/↓← permanecem.

Fontes em `art/asta-source/frames/v22-*.png`; runtime em `public/sprites/asta/v22-*.png`. Produção pela ferramenta de imagem integrada, modo built-in, usando a identidade aprovada do próprio projeto como referência. Prompts e saídas em `art/asta-source/v22-sources.json`, empunhaduras revisadas em `v22-sockets.json`. Empacotamento nearest-neighbor, transparência binária e arma aprovada ancorada por cel. Não há efeitos desenhados nos corpos.

Os 17 atlas-base/normais, `arsenal.png`, os 36 normais e os outros lutadores não foram redesenhados. R permanece reservada. Lista exata desta etapa: `docs/asta-22-arquivos.txt`.

## Verificação e evidências

`deployment/audit/asta22/` reúne capturas e vídeos reais da arena, metadados e resultados. As evidências antigas em `asta21/` são históricas e mostram as regras substituídas; não devem ser usadas como instrução de controle da versão 2.2.

Comandos de verificação:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=75000 --exclude '**/.npm-cache/**'
node scripts/run_art.mjs scripts/check_asta_art.py
node node_modules/@playwright/test/cli.js test e2e/asta.pw.mjs e2e/asta-specials.pw.mjs e2e/asta-relay.pw.mjs e2e/asta-dd.pw.mjs
# Com dist/server-dist já compilados, usar a prévia isolada para o teste LAN:
$env:BEN_LAN_TEST_URL='http://127.0.0.1:5188/'
$env:BEN_LAN_BACKEND_PORT='3188'
$env:BEN_LAN_EXTERNAL_PREVIEW='0'
npm.cmd run test:lan -- --grep Asta
```

A restauração usa ticks e recibos sincronizados em snapshots. As 12 rotas são testadas nas duas orientações, nos cantos contra Ben humano/Goku, com interrupções antes/depois da confirmação, KO, defesa/erro, timeout, input antecipado/tardio/repetido, finalização e replay determinístico. Os testes LAN exercitam a mesma fábrica de servidor existente numa instância temporária encerrada ao final; isso não substitui nem instala outro backend do usuário.

## Publicar no XAMPP

Na instalação real desta máquina:

```powershell
Set-Location 'C:\xampp\htdocs\2025\Jogo_de_Luta_Sem_Nome'
git switch codex/asta-especiais-2-2
.\atualizar-msfd.cmd -Branch codex/asta-especiais-2-2
```

Após a revisão e integração dos PRs dependentes:

```powershell
git switch main
.\atualizar-msfd.cmd -Branch main
```

No outro computador, usar a pasta real `C:\xampp\htdocs\2025\M.S.F.D`. O atualizador verifica alterações locais e conflitos, atualiza somente por fast-forward, executa verificações essenciais, identifica o backend e seu mecanismo automático, pausa somente o processo deste jogo, executa `npm.cmd run build:lan`, reinicia o mecanismo existente e verifica HTTP, bytes publicados, backend e Socket.IO.

O endereço de teste é `http://localhost/2025/M.S.F.D/`. Para comprovar a publicação de um commit específico:

```powershell
node scripts/check-msfd-publication.mjs http://localhost/2025/M.S.F.D/ (git rev-parse HEAD)
```

Uma execução bem-sucedida de Git ou build, isoladamente, não comprova a versão servida. O resultado final da verificação HTTP e dos dois clientes deve acompanhar a entrega.
