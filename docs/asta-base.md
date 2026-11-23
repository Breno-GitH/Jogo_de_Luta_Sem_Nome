# Asta — base jogável e quatro espadas

Relatório da etapa 1. A continuação com os nove especiais está em [asta-especiais.md](asta-especiais.md).

Branch: `codex/asta-quatro-espadas`. Base: `9adf9563f317f32afa3ff43452f8fa4a5492a656` (main / PR 10). Esta etapa não altera Xebec, Ben ou os recursos dos demais lutadores.

## Entregue

- Asta selecionável em Treinamento, Arcade, Versus BOT e no lobby Socket.IO existente.
- Demon-Slayer inicial, quatro armas desenhadas separadamente e 36 normais (9 por espada), com tempos, dano, alcance, impulso e recuperação próprios.
- 17 atlas pequenos de seis desenhos corporais: idle, caminhada frontal e traseira, dash/backdash, salto, agachamento/guarda, reações, entrada/vitória/agarrão e nove normais. Célula 256 × 256, pivô 128/224, escala única. As armas são ancoradas por cel; não há transformação dos membros por código.
- Mão livre à frente do peito e pulsos alinhados nas sequências corrigidas, incluindo corte horizontal, ataque baixo e rasteira.
- Demon-Slayer larga, reta e com manchas orgânicas e aberturas na base; Destroyer com eixo reto, ponta alargada, recortes côncavos e trevo branco. Slasher e Dweller têm silhuetas próprias.
- Dash terrestre veloz, backdash curto, um air dash por salto, perseguição após launcher; sem invulnerabilidade de movimento.
- J → K → L confirmado e ↓L → salto → ar J → ar K → ar L; sem reverse beat de volta para J. Limites de combo existentes preservados.
- Estado de espada/air dash incluído nos snapshots. A API da futura troca integrada ao ataque possui um tick de commit e conserva a nova arma em erro após esse tick.
- HUD identifica a arma. Não há consumo de Super nem Super provisória.
- Verificador de publicação também compara os PNGs do Asta servidos pelo Apache; o atualizador passa a incluir os testes do Asta.

## Limite desta etapa

Os nove especiais, Sword Chain e Super R pertencem aos próximos prompts. Não foi criado um comando neutro de troca de arma. Fora do Treinamento, Asta começa e permanece com Slayer enquanto os especiais de troca não forem implementados. No Treinamento, os seletores Espada Asta P1/P2 permitem exercitar os quatro conjuntos somente em estado livre no chão. Os quatro estados são suportados pelo servidor e foram exercitados em checkpoints LAN.

Destroyer não concede limpeza mágica ou contra-ataques automáticos aos normais. Esses comportamentos dependem dos especiais futuros. As quatro espadas compartilham desenhos corporais quando a ação permite; as armas, as trajetórias ancoradas, os tempos e as propriedades de combate são específicos.

## Validação

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` aprovado.
- Vitest: 54 arquivos, 1.377 testes aprovados; 22 específicos do Asta. Após o último ajuste de air dash, os 106 testes Asta + matriz LAN também passaram.
- Arte: `python scripts/check_asta_art.py` aprovado: 102 cels distintos dentro de suas sequências, transparência binária, margens e sockets sobre as mãos.
- Navegador: seis testes Playwright aprovados: quatro espadas/36 normais, Arcade, Versus BOT, combos reais e comparação com Dio/Goku. Samurai participa dos testes de treino e combo.
- LAN: dois Chromium com Socket.IO real, seleção, quatro estados de espada, dano, air dash, retorno ao solo e igualdade dos hashes com o servidor. Teste aprovado.
- Produção: Vite e compilação do backend aprovados. O aviso preexistente de chunks acima de 500 kB permanece.
- Esta validação não equivale à execução de todos os scripts Python legados do restante do elenco.

Capturas e gravação reais: `deployment/audit/asta/`. Evidência dos dois clientes: `deployment/audit/lan/asta-*`. Arte final e prompts do ImageGen integrado: `art/asta-source/sources.json`; sprites consumidos pelo jogo: `public/sprites/asta/`.

## Atualização local

Na máquina desta tarefa o projeto está em `C:\xampp\htdocs\2025\Jogo_de_Luta_Sem_Nome`. O processo de publicação usa `atualizar-msfd.cmd`, identifica o backend por projeto/PID, pausa somente esse backend, chama `npm.cmd run build:lan`, reinicia pelo iniciador existente e verifica HTTP, build-info, SHA-256 dos recursos e Socket.IO.

Para testar a branch em outra instalação, com Git limpo:

```bat
cd /d C:\xampp\htdocs\2025\Jogo_de_Luta_Sem_Nome
git fetch origin
git switch codex/asta-quatro-espadas
atualizar-msfd.cmd -Branch codex/asta-quatro-espadas
```

Na outra máquina, substitua o diretório por `C:\xampp\htdocs\2025\M.S.F.D`.

Depois de integrar o PR à main:

```bat
git switch main
atualizar-msfd.cmd -Branch main
```

O atualizador interrompe diante de alterações locais, conflitos, falha de build ou Apache indisponível. Não use reset hard para contornar a proteção. URL esperada: `http://localhost/2025/M.S.F.D/`. A comprovação exata da versão fica em `build-info.json` servido pelo Apache e na saída de `scripts/check-msfd-publication.mjs`.
