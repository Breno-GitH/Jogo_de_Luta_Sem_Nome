# Asta — Prompt 2.1: rushdown e Anti-Magic Relay

## Base preservada

Branch `codex/asta-relay-rushdown`, derivada de `codex/asta-nove-especiais` no commit `231b2848f5edf9fba54fc68cdb55fe8dfbfd6f91`.
Na consulta inicial, PR #11 (base de Asta) e PR #12 (primeiros nove especiais) estavam abertos, ainda sem merge. O PR desta etapa deve ter a branch do PR #12 como base enquanto essa dependência permanecer aberta.

Os 17 atlas de corpo-base/normais e `arsenal.png` permanecem idênticos. Seleção, quatro estilos, 36 normais, salto e air dash permanecem no mesmo personagem. R continua reservado para uma etapa futura.

## Nove comandos

- **↓→J — Black Rush: Impacto Relâmpago:** corrida curta, espada elevada durante a aproximação e corte descendente. Confirmação reduz quatro ticks de recuperação; erro continua punível.
- **↓→K — Meteor Break:** avanço, salto físico curto e golpe descendente. Reação de ricochete permite conversão aérea. A proteção contra repetição do mesmo especial no combo limita o lançamento.
- **↓→L — Black Divider: Queda do Demônio:** avanço e salto curto, grande corte descendente, knockdown e recuperação longa. Extensão ativa de 210 px usa o mesmo alcance da cápsula de combate. A extensão continua legível com os efeitos cosméticos desligados.
- **↓←J — Iai Slash:** dois contatos reais, com duas poses de corte.
- **↓←K — Black Flash Steps:** quatro contatos reais. O último lança e abre perseguição; cancelar em outro especial exige confirmar o último contato.
- **↓←L — Tempestade de Cortes:** seis contatos reais, deslocamento contínuo, finalização que afasta e recuperação longa.
- **↓↓J — Black Slash Pursuit:** projétil finito; **novo J** permite uma única investida com corte físico. Sem esse input, o ataque termina no projétil. Uma nova sequência direcional completa continua pertencendo ao leitor universal de especiais.
- **↓↓K — Causality Rush:** avanço defensivo curto e golpe físico mesmo contra oponentes sem magia. A janela de neutralização é limitada aos ticks 3–8 e a uma entidade elegível por execução. Uma neutralização válida fortalece a resposta; nenhuma invulnerabilidade foi adicionada.
- **↓↓L — Anti-Magic Relay:** abertura com a espada equipada, duas continuações manuais e finalização curta com a última espada.

IDs antigos `astaRisingDemon`, `astaSeveringLine`, `astaCausalityBreak` e `astaDualBreak` foram mantidos como identificadores internos para preservar a integração. Seus nomes, animações e comportamentos são os desta etapa.

## Relay: escolhas e limites

Após acerto válido e durante a janela indicada na HUD:

- **Frente + J:** Demon-Slayer — corte pesado, maior dano e afastamento.
- **Trás + J:** Demon-Slasher — dois cortes rápidos, menor dano individual.
- **Baixo + J:** Demon-Dweller — avanço maior e corte próximo.
- **Baixo + K:** Demon-Destroyer — ruptura física e pequena elevação, com política de neutralização elegível.

As direções são relativas à orientação do lutador. Cada ação tem janela de 12 ticks após o período ativo, usa novos pressionamentos e aceita o buffer normal de oito ticks. A própria tecla L da ativação nunca escolhe uma continuação.

Uma escolha confirma a nova arma no segundo tick da respectiva animação. Até esse ponto a arma anterior continua visível; depois, somente a nova. Interromper antes da confirmação preserva a última arma efetivamente equipada.

Sem escolha, o Relay passa à finalização curta com a arma atual. Defesa ou erro não abrem interação. Cada continuação precisa conectar fisicamente para oferecer uma próxima escolha: não há acerto garantido em qualquer distância. O golpe não modifica a posição do adversário, não usa captura, não pausa a câmera nem o timer.

Máximo de duas escolhas, prazo absoluto de 150 ticks, registro único de cada contato e escalonamento de hitstun por etapa. Os limites globais de combo/juggle e o escalonamento de dano continuam ativos. Repetir o Relay dentro do mesmo combo é bloqueado. O finalizador derruba e não permite cancelamento imediato.

## Antimagia

A política preserva energia elegível de Ki/Kamehameha básico e Katon compatível. Não apaga aço físico, Haki, antimagia adversária, dragões, Supers ou entidades não classificadas como neutralizáveis. A geometria de neutralização acompanha a lâmina. Sons, rastros, poeira, afterimages e fragmentos são cosméticos e não criam eventos de dano.

## Arte e referências

18 atlas novos de seis poses corporais (108 quadros) em `public/sprites/asta/v21-*.png`; fontes em `art/asta-source/frames/`. Corpos sem antimagia embutida. Cada arma continua sendo o recurso aprovado de `arsenal.png`, com pontos de empunhadura por quadro compartilhados entre renderização e colisão.

Os antigos atlas específicos de especiais ficam arquivados para comparação, sem uma segunda implementação de gameplay. Os metadados ativos apontam para os novos atlas; somente o corpo original de Black Slash permanece utilizado.

Produção visual: ferramenta de imagem integrada, modo built-in, com os sprites aprovados do próprio projeto como referência. Prompts completos e caminhos de saída estão em `art/asta-source/v21-sources.json`; posições de mãos/ângulos em `v21-sockets.json`. Empacotamento por nearest-neighbor e alpha binário, sem FX em spritesheets.

Referências consultadas: [Asta oficial](https://bclover.jp/en/character/asta.php), [sinopse e imagens oficiais do episódio 4](https://bclover.jp/season1/story/detail.php?id=1000321), [episódio licenciado](https://www.crunchyroll.com/pt-br/watch/GEVUZG88Z/the-magic-knights-entrance-exam), [análise de combate de Vergil pela Capcom](https://news.capcomusa.com/lets/browse/devil-may-cry-4-special-edition-combat-overview-vergil), [comparação oficial de Vergil](https://news.capcomusa.com/lets/browse/vergil-vs-vergil-comparison-is-very-cool). A adaptação usa corrida física e cortes descendentes próprios do M.S.F.D.; nenhum sprite ou código dessas obras foi copiado.

## Reprodução dos testes

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=75000 --exclude '**/.npm-cache/**'
node scripts/run_art.mjs scripts/check_asta_art.py
```

Os testes do Relay cobrem 64 combinações em ambas as orientações, snapshots determinísticos durante a sequência, defesa/erro, ausência de input, input tardio/repetido, interrupções antes/depois da troca, KO e cantos contra Ben humano e Goku. Os nove especiais são exercitados com as quatro armas iniciais, hit/guard, alcance, duração e neutralização seletiva.

Testes de navegador: `e2e/asta.pw.mjs`, `e2e/asta-specials.pw.mjs`, `e2e/asta-relay.pw.mjs`. Testes de dois clientes em `e2e/lan/game.pw.ts` com filtro `Asta`. Os testes LAN usam uma instância temporária da mesma fábrica existente, encerrada após a execução; não instalam nem substituem o backend do usuário.

Evidências selecionadas e resultados finais: `deployment/audit/asta21/`. Os arquivos de captura completos podem ser direcionados com ASTA_EVIDENCE_DIR, ASTA_BASE_EVIDENCE_DIR, ASTA_RELAY_EVIDENCE_DIR e MSFD_LAN_EVIDENCE_DIR.

## Publicar no XAMPP

Nesta máquina, instalação em `C:\xampp\htdocs\2025\Jogo_de_Luta_Sem_Nome`, servida também pelo alias `http://localhost/2025/M.S.F.D/`.

Para testar a branch de desenvolvimento sem merge:

```powershell
Set-Location 'C:\xampp\htdocs\2025\Jogo_de_Luta_Sem_Nome'
.\atualizar-msfd.cmd -Branch codex/asta-relay-rushdown
```

Após revisão e integração dos PRs na ordem #11 → #12 → esta etapa, executar `.\atualizar-msfd.cmd -Branch main`.

No outro computador, usar a pasta real `C:\xampp\htdocs\2025\M.S.F.D` e o mesmo comando. Não foi presumido acesso a esse computador.

O atualizador preserva mudanças locais, faz atualização fast-forward, verifica dependências e testes essenciais (agora incluindo Relay), identifica o backend deste projeto, pausa/reinicia pelo mecanismo existente, executa build:lan e compara os hashes efetivamente servidos pelo Apache. Não utiliza reset --hard, não substitui Socket.IO e não altera portas.
