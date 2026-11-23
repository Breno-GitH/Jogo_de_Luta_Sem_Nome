# Combate: repetição de leves e lançadores

A regra compartilhada de J agora cobre os nove lutadores e as variantes em pé,
agachada e aérea, mesmo após troca de espada, forma ou postura. Três acertos de
J na mesma sequência afastam e derrubam sem gerar outro lançamento; J adicional
não acerta até o defensor recuperar oito ticks de controle real. O terceiro J
mantém a possibilidade de continuá-lo com escolhas diferentes quando a distância
e as demais regras de combo permitirem.

Um lançador de `launch <= -8` pode abrir o combo. Um novo uso do mesmo lançador
em outra execução encerra a sequência em queda. Duas técnicas distintas podem
levantar o alvo antes de um terceiro lançador virar finalizador. Os limites
existentes de hits, hits aéreos e tempo também consideram a sequência contínua
até haver oito ticks de controle, impedindo o reinício artificial por um único
frame neutro. As Supers cinematográficas mantêm sua própria timeline.

Três J defendidos na mesma pressão reduzem o blockstun a até sete ticks e
separam também o atacante no canto. O defensor pode então responder ou sair da
posição. Nenhuma regra adiciona um cooldown universal aos ataques.

O relatório reproduzível `deployment/audit/anti-spam/recovery.json` mede a
primeira oportunidade de controle após J pressionado a cada tick perto da borda.
Execute `node node_modules/esbuild/bin/esbuild scripts/audit-anti-spam.ts
--bundle --platform=node --format=esm --outfile=deployment/msfd-work/anti-spam/audit.mjs`
e depois `node deployment/msfd-work/anti-spam/audit.mjs` para regenerá-lo.

Todos os contadores que influenciam combate estão no snapshot e hash LAN. As
partículas, sprites e Supers dos lutadores não foram alterados nesta parte.
