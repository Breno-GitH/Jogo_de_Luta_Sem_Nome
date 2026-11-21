# Asta R — Black Meteorite / Devil Union

> Registro da primeira versão. A timeline, a coreografia e Equinox desta versão foram substituídos pela [reconstrução 4.1](asta-super-41.md). Estes dados e gravações são mantidos para comparação histórica.

Base: `6576cc145f1061f0a959cad56a9d5c11ff853740` (etapa 2.2). Branch: `codex/asta-black-meteorite-union`.

Esta base ainda não possuía Super de Asta: o R estava reservado. A implementação acrescenta uma Super ao sistema cinematográfico existente, preservando os nove especiais e os quatro estilos de normais.

## Uso e regras

- R, 100 de Super, início terrestre em estado livre ou cancelamento confirmado permitido.
- Black Meteorite começa na forma parcial: roupa dos Touros Negros, braço negro, cabelo/rosto parcialmente demonizados, uma asa. A referência principal é a imagem de forma incompleta enviada pelo usuário.
- A lâmina física de Demon-Slayer, ancorada no mesmo socket do desenho, confirma o ataque. O avanço possui hurtboxes e não concede invulnerabilidade.
- Defesa ou erro gastam a barra e encerram em recuperação. Não convocam Liebe nem Devil Union. A preparação é 14 ticks, atividade 12 e recuperação 32.
- Em acerto, Liebe se manifesta antes da união. Seguem cortes de Dweller, lançamento de Destroyer, descida de Slayer e Equinox com Slasher. Uma espada por vez; cada troca passa pelo grimório.
- São seis eventos de dano: 60 + 36 + 36 + 38 + 40 + 130 = 340, antes de escalonamento. O alvo sobrevive aos eventos intermediários quando necessário; o último resolve KO.
- A cinematografia tem 278 ticks mais 28 de hitstop, aproximadamente 5,1 segundos. Asta termina na forma normal com Demon-Slasher equipada. O alvo cai e recupera segundo as regras comuns.

## Timeline

- 0–21: consequência do Black Meteorite, preservando a pose de contato do avanço.
- 22–47: manifestação animada de Liebe e breve resistência do adversário.
- 48–81: forma parcial aprovada, formação progressiva de armadura e abertura das duas asas.
- 82–139: dois cortes com transferência de peso, usando Demon-Dweller.
- 140–167: Demon-Destroyer lança o alvo; a câmera acompanha a subida.
- 168–197: perseguição aérea e corte descendente com Demon-Slayer.
- 198–243: concentração na katana, preparação de Equinox e finalização.
- 244–277: dispersão, passagem pela forma parcial e retorno à base.

As posições têm quantização de 1/16 de pixel e são derivadas do relógio serializado. Os contatos dos cortes usam os sockets e o alcance real das armas. Os intervalos de hitstop não repetem eventos de dano. Snapshots incluem toda a timeline, trocas e consumo de recurso.

## Arte, efeitos e referências

Oito atlas curtos de corpo de Asta e um de Liebe estão em `art/asta-source/frames/r-*.png`. Os recursos de jogo correspondentes ficam em `public/sprites/asta/`. O empacotamento mantém uma escala fixa de 0,30, pixels sem interpolação e pivô de pés comum. Não gera poses por rotação ou deformação de uma imagem.

Os prompts, arquivos de origem e modo **imagegen built-in** estão em `art/asta-source/super-sources.json`. As correções de forma parcial e de transparência também são registradas junto aos recursos. As imagens oficiais servem para referência de design, sem copiar quadros do anime para os atlas finais.

A armadura, as marcas e a silhueta da união foram conferidas nos visuais do [site oficial do anime](https://bclover.jp/) e na apresentação editorial do [volume 29 pela VIZ](https://www.viz.com/manga-books/manga/black-clover-volume-29/product/7083). O desenho de Liebe foi consultado na [ficha oficial](https://bclover.jp/character/liebe.php). A forma parcial segue principalmente a referência enviada pelo usuário.

Antimagia, rastros, pressão, fragmentos, iluminação e grimório são desenhados por código. O rastro consulta o histórico dos sockets e do deslocamento; não fica parado na posição antiga. Os efeitos não aplicam dano e não alteram colisões. Sons novos são sintetizados, sem falas ou músicas extraídas do anime.

## Verificação e publicação

Os testes específicos estão em `tests/asta-super.test.ts`, `e2e/asta-super.pw.mjs` e nos dois casos de Super acrescentados ao teste LAN existente. Capturas, gravações e resultados ficam em `deployment/audit/asta-super/`.

O hash de compatibilidade inclui o novo módulo de Super e os metadados de alcance usados pela simulação. Nenhum checksum de teste foi ajustado para ocultar divergências.

Para reproduzir: TypeScript, Vitest, `node scripts/run_art.mjs scripts/check_asta_art.py`, testes de navegador e testes LAN com o backend existente. `npm run build:lan` continua sendo o build de publicação.

Após integrar os PRs anteriores de Asta e esta branch à main, em cada computador:

```powershell
cd C:\xampp\htdocs\2025\M.S.F.D
git switch main
.\atualizar-msfd.cmd -Branch main
node scripts/check-msfd-publication.mjs http://localhost/2025/M.S.F.D/ (git rev-parse HEAD)
```

Na instalação com nome `Jogo_de_Luta_Sem_Nome`, use esse diretório no primeiro comando. O atualizador existente verifica o processo do projeto, para e reinicia o backend pelo mecanismo configurado, compila e confere os arquivos servidos pelo Apache. A publicação local nesta branch será registrada nas evidências; não implica merge automático na main nem atualização de outro computador.
