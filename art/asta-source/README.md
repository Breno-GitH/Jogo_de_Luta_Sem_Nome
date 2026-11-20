# Asta — base e quatro espadas

Arte produzida com a ferramenta integrada ImageGen, a partir das referências fornecidas pelo usuário e do design oficial pós-Dante/Nacht. Os sprites de combate não usam o atlas gigante descartado. Cada ação tem seis desenhos corporais em um atlas pequeno 3 × 2. A escala do corpo é única (.30 da arte fonte), células 256 × 256, pivô 128/224. Pulsos neutros e contato não usam deformação dos membros por código.

As quatro armas são desenhos separados: Slayer com lâmina larga, manchas irregulares e duas aberturas na base; Slasher como katana; Dweller pontuda com guarda ornamentada; Destroyer reta com ponta alargada, recortes côncavos e trevo branco. O motor posiciona o sprite da arma nos sockets da mão negra e redesenha a região dos dedos sobre a empunhadura. Os mesmos sockets definem as cápsulas de colisão. Os corpos compartilham animações onde a mecânica permite; alcance, arma, duração, dano e recuperação são específicos de cada espada.

O usuário solicitou corrigir os pulsos e remover a mão livre atrás das costas. stand_medium, crouch_light e crouch_medium foram refeitos com a mão esquerda em frente ao corpo; todos os ataques aéreos seguem a mesma regra.

## Reproduzir

Com Pillow disponível: `python scripts/pack_asta.py`. Não há escala variável por cel, geração de poses ou pintura nesse script. Ele apenas recorta, reduz por vizinho mais próximo uma vez e empacota os desenhos. `python scripts/check_asta_art.py` verifica transparência binária, margens, seis desenhos distintos e sockets sobre a mão.

As fontes finais estão em `frames/`. `sources.json` registra os prompts finais, `sockets-source.json` os anchors na arte e `packing.json` as posições de empacotamento. A arte recebida ou gerada não é tratada como instrução de programação.

## Escopo desta etapa

Asta inicia cada partida com Demon-Slayer. As quatro espadas e 36 normais podem ser exercitados pelo seletor exclusivo do Treinamento. Não foi adicionado comando neutro para trocar de espada. O estado sincronizado já suporta troca integrada ao ataque com commit em tick definido: interrupção anterior conserva a arma anterior; interrupção posterior conserva a nova, inclusive em erro. Os nove especiais, Sword Chain e Super R continuam reservados para os próximos prompts. Não há neutralização mágica ou invulnerabilidade adicionada aos normais de Destroyer.

Fontes de referência: [Asta oficial](https://bclover.jp/character/asta.php), [espada licenciada](https://bclover.jp/season1/goods/item.php?id=1019336) e imagens específicas das armas fornecidas pelo usuário.
