# Kaneki Ken · Centipede — Frenesi da Kakuja

**R** ativa a Super de uma barra. O disparo inicial usa a trajetória da ponta do Kagune e pode ser evitado por salto, distância e invulnerabilidade. O custo é consumido no início do golpe. A defesa comum segue a regra global de Supers.

Com uma captura válida, **R** também converte nas janelas de escolha do agarrão **U**, do **Kagune Grab** e da captura pela ponta do **Rinkaku Rush**. O escape e o fim do prazo são processados primeiro. O Four Swords conserva sua sequência e suas finalizações próprias. A conversão parte das posições reais dos jogadores.

## Arte e cinematografia

A forma é temporária. Quatro Rinkakus orgânicos e duas centopeias articuladas compõem a forma completa. As origens vêm de três pontos anatômicos marcados por pose, nas escápulas, no centro das costas e na lombar. As centopeias usam placas negras, juntas vermelhas e garras curvas. O rosto assimétrico foi redesenhado em pixels nativos nas folhas do corpo. O lado pálido traz um olho branco sem pupila e dentes expostos. A metade tomada pela Kakuja traz o olho ghoul vermelho e a ponta orgânica sob o queixo.

A sequência confirmada tem 452 ticks de movimento e dura cerca de 8 segundos com os hitstops. Ela começa com o despertar e a primeira investida, alterna ataques terrestres e diagonais em zigue-zague, usa o limite da arena como apoio visual e termina com captura dupla, lançamento, perseguição aérea e Centipede Crash. O alvo toca o chão antes de Kaneki. A pose final usa dois desenhos próprios de ajoelhar e erguer o rosto.

Os dez impactos foram redistribuídos entre as fases. A confirmação mantém os mesmos tempos, alcance e custo. O dano total continua em 343 numa Super iniciada por R sem escala de combo. O alvo fica sob controle da cena confirmada até o encerramento. O apoio na parede é desenhado temporariamente no limite mais próximo, sem alterar as colisões do cenário.

- [Laboratório do combate](http://localhost/2025/Jogo_de_Luta_Sem_Nome/art/kaneki-combat.html) com reprodução, avanço por tick, ambos os lados e opção **Ativar som**.
- [Cinematografia capturada no jogo](public/previews/kaneki/centipede.webp), [comparação](public/previews/kaneki/centipede-comparacao.png) e [prancha das fases](public/previews/kaneki/centipede-fases.png).
- [Prancha aprovada do rosto em 8×, com o sprite a 2× e 1×](public/previews/kaneki/kakuja-rosto-comparacao.png). O quadro de referência preserva exatamente os pixels aprovados. As outras poses usam a mesma amostra com o contorno da bochecha ajustado em direção à orelha e o queixo encurtado conforme a inclinação da cabeça.
- [Prancha estática e recorte do rosto em 4×](public/previews/kaneki/kakuja-v2-preview.png). A [folha dos tentáculos](public/previews/kaneki/kakuja-v2-tentaculos.png) tem as colunas superiores, centrais e inferiores e as linhas de abertura, ataque e captura. Cada célula tem 700 × 390 px, com pivô em (322, 355).
- [Fontes do corpo](art/kaneki-centipede-source/PROMPTS.md) e [pixels da máscara](art/kaneki-centipede-source/KAKUJA-FACES.txt) e [amostra aprovada do rosto](art/kaneki-centipede-source/kakuja-rosto-aprovado.png). O script `scripts/pack_kaneki_centipede.py` grava os cels completos e os pontos das costas. `node scripts/kaneki_kakuja_preview.mjs` exporta a prancha estática e a folha dos três pares. A imagem rejeitada entra somente na montagem comparativa.

## Validação

- Os testes de simulação cobrem a confirmação por R, guarda, esquiva, alcance, interrupção, conversões, KO e restauração determinística. Também verificam as viradas, o apoio espelhado, o contato das duas carapaças e a ordem de aterrissagem.
- Dois testes no Chrome via Apache confirmaram as fases, a câmera, a conversão e o som do Crash. O teste LAN com dois clientes confirmou U → R e a sincronização da parede, ascensão e impacto. O teste em dois computadores físicos permanece pendente.

Para reproduzir as capturas, execute `node scripts/capture_kaneki_combat.mjs --centipede` com a versão compilada servida pelo Apache.

