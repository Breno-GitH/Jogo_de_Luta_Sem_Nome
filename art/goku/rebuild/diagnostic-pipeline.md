# Diagnóstico da reconstrução completa de Goku

## Causas confirmadas

A comparação em `comparison-initial.png` mostra uma diferença substancial entre `art/goku/base-native.png` (figura inteira importada da referência aprovada) e o Idle publicado. O problema já existe no PNG individual, antes do empacotamento.

`scripts/goku_anatomy.py` reconstrói silhuetas de membros com curvas arredondadas (`outline`, `paint_limb`), transfere cores ao longo dos ossos (`surface_texture`) e desenha botas/mãos novas. O comprimento numérico dos ossos não garante uma anatomia convincente, nem o volume e as dobras do desenho original. A composição com tronco, cabeça e faixa recortados em `goku_source.py` pode expor recortes e alterar a estrutura da roupa.

A revisão3 das caminhadas substituiu parte da pintura, mas ainda deformava recortes por malhas em `goku_walk_painted.py`. Alguns controles não correspondiam à região pintada; o deslocamento do recorte fazia botas se separarem da calça. A correção de cintura criou também uma ponta de tecido em fases estreitas. Esta abordagem foi retirada da versão ativa das caminhadas e não será expandida para os demais movimentos.

Segurar poucos desenhos durante4–5ticks enquanto a raiz anda a60Hz deixa deslizamento visível. Criar um PNG deformado por tick para preencher a duração não resolve a construção. Desenhos únicos e duração em ticks devem continuar separados.

## Comparação técnica com Samurai e Dio

Samurai usa256×256, pivô128,224 e pixels nativos. Seu Idle em `build_samurai.py` limita muito a amplitude de respiração, mantém botas paradas e conserva a figura pintada. A movimentação em `build_movement.py` também usa partes articuladas; isso não deve ser copiado como garantia de qualidade para uma anatomia diferente.

Dio usa `AnatomicalRig` em `revise_dio_movement.py`: partes pintadas, comprimento baseado na própria referência, sobreposições nos encaixes e posicionamento da sola pelos pixels. Seu gerador rejeita poses abaixo do chão, em vez de escondê-las com um recorte. O diretor `dio-motion.ts` separa a raiz física das fases visuais e escolhe salto pela trajetória. Essas regras de validação e sincronização são úteis; os desenhos e articulações de Dio não serão reutilizados em Goku.

`src/render/animator.ts` já distingue frames, durações, colunas, dimensões e pivôs. O renderizador desativa smoothing e só aplica o espelhamento/escala de apresentação. Não há evidência de que ele seja a causa dos membros deformados observados. Folhas e recortes continuarão sendo comparados pixel a pixel para detectar regressões.

## Pipeline escolhido

Uma figura completa por desenho, obtida de fontes novas e identificadas. Operações permitidas na importação: recorte de uma célula inteira, escala uniforme da figura inteira, paleta32cores, alpha binário e registro inteiro. Sem recortes de membros, cabeça enxertada, malhas ou morphing.

Cada lote incluirá uma pose de calibração em pé. A escala do lote deriva dessa referência, não da altura aparente de cada pose. Assim o agachamento abaixa pelo desenho de joelhos/quadril; não se expande uma pose baixa de volta para130px. Quadros aéreos preservam o referencial corporal e podem recolher os pés acima do pivô, sem forçar o chão em todos os desenhos.

Validação antes de montar folhas: figura completa/conectada, margens, alfa/paleta, escala, chão apenas nos estados apoiados e rastreabilidade da fonte inteira. Validação visual separada: anatomia, identidade, articulações, continuidade e movimento real no jogo. Nenhuma contagem de testes será apresentada como prova de qualidade artística.

## Ordem de execução

1. Diagnóstico e congelamento de física/elenco existente.
2. Base e Idle completos, consistentes e inspecionados.
3. Avanço/recuo, incluindo desenhos completos adicionais quando úteis.
4. Agachamento e levantamento.
5. Todas as fases e direções de salto/aterrissagem.
6. Dash/backdash/recuperação.
7. Transições e movimentos adicionais existentes.
8. Revisão do conjunto, capturas, testes e build.

Samurai, Dio e The World são preservados por hash. Os parâmetros físicos atuais de Goku e o motor de combate serão congelados separadamente. A autorização de reconstrução completa substitui o bloqueio anterior dos139 PNGs de Goku; esse bloqueio não deve impedir as correções agora solicitadas.
