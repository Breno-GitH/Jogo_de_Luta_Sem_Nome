# Dio + The World — revisão 2 da movimentação

**Atualização de combate:** os antigos normais físicos de Dio foram substituídos. Agora The World executa todos os golpes, enquanto Dio comanda. A movimentação descrita aqui foi preservada. Propriedades, arte nova e validação atual: [DIO-COMBATE.md](DIO-COMBATE.md). As contagens de testes abaixo registram a etapa de movimentação.

Revisão dos desenhos, do apoio dos pés e das transições. As bases aprovadas e os PNGs do Samurai permanecem intactos. O rosto é copiado com os mesmos pixels, sem girar ou deformar os olhos. Os ataques normais existentes permanecem disponíveis e foram incluídos na regressão de combate.

## Abrir e executar

```sh
npm install
npm run dev
```

Abra [o visualizador](http://127.0.0.1:5173/art/dio.html). Para verificar o personagem no combate real, abra o menu principal, escolha **Treinamento**, selecione **Dio Brando** e inicie. O [laboratório de combate](http://127.0.0.1:5173/art/dio-combat.html) também usa o mesmo `Match`, com sequências de combos e depuração do Stand.

```sh
npm test
npm run build
npm start
```

O último comando serve o cliente compilado e Socket.IO em [127.0.0.1:3001](http://127.0.0.1:3001/). Depois de alterar arquivos, gere o build novamente. O modo online continua restrito ao Samurai; Dio está nos modos locais.

## Quantidade real de desenhos

Há **140 desenhos de movimento de Dio**, em 19 clipes: 13 básicos e seis variações direcionais de salto. As quantidades básicas são:

- Idle: 6.
- Walk Forward: 40; Walk Back: 40. Cada ciclo tem **oito poses-chave** e 32 intermediários articulados, exportados como desenhos PNG reais, um por tick.
- Dash Forward: 6; Backdash: 6.
- Crouch Start: 4; Crouch Idle: 3; Crouch End: 4.
- Jump Start: 3; Jump Rise: 3; Jump Apex: 2; Jump Fall: 3; Landing: 4.
- Rise/Apex/Fall têm também versões Forward e Backward: 3/2/3 desenhos por direção, acrescentando 16.

**The World: 38 desenhos, sete clipes:** Stand Idle 6, Floating 6, Follow Forward 6, Follow Backward 6, Dash Follow 5, Jump Follow 4, Return to Position 5. Total desta revisão: **26 sheets e 178 desenhos de movimento**. Esses números não incluem os ataques nem as bases estáticas.

## O que foi corrigido

A caminhada anterior tinha seis amostras retidas por quatro ticks, poucas fases de passagem e pés que não completavam a troca de apoio. O recuo usava a mesma construção em outra ordem. Agora há contato, absorção, passagem, impulso e contato oposto, com desenho próprio de recuo, joelhos voltados para o adversário e balanço diferente dos braços.

O avanço é 1,6 px/tick; o recuo, 1,2 px/tick. Durante cada apoio, a posição local do tornozelo compensa o movimento real da origem. Intermediários a cada tick evitam reter um pé parado na sheet enquanto o corpo avança. A fase visual mede o deslocamento efetivamente percorrido; ao inverter o movimento, procura uma fase com pés próximos da posição anterior. Isso também evita continuar percorrendo o ciclo contra uma parede sem sair do lugar.

O agachamento antigo abria os joelhos para lados opostos. A nova pose abaixa o quadril 31 pixels, dobra os dois joelhos para a frente e distribui o peso de forma assimétrica. As pernas mantêm seus comprimentos. Soltar S antes de terminar a entrada retorna de uma altura próxima, em vez de saltar direto para o desenho em pé. As tiras verdes foram reconectadas ao cinto; recortes soltos não ficam flutuando atrás das pernas.

Jump Start agora tem oito ticks de antecipação e extensão antes de a física sair do chão. Rise, Apex e Fall usam poses próprias, escolhidas pela velocidade vertical e pela distância até o piso. As versões direcionais inclinam tronco e reposicionam braços e pernas, mantendo o rosto rígido. Landing só é escolhido quando a origem física realmente alcança o chão; dura oito ticks e tem absorção seguida de recuperação.

Dash e backdash têm 16 ticks, com antecipação, aceleração e desaceleração calculadas pelo motor. As imagens não acrescentam deslocamento à origem. Ataques e dano continuam podendo interromper a movimentação.

The World mantém origem e animação próprias. O alvo neutro fica 30 pixels atrás e 18 acima de Dio, com flutuação de aproximadamente ±3 px. O acompanhamento vertical usa a posição real do dono no salto. Durante viradas, o Stand passa pela camada de trás com passos limitados e arco vertical. As mãos ficam mais recolhidas na guarda; foi removido um recorte duplicado da mão que criava uma ponta no braço ao flexionar o cotovelo.

## Inspeção e arquivos

O visualizador oferece seleção de clipe, loop opcional, pausa, tick único, quadro anterior/próximo, miniaturas, velocidades 0,25× a 2×, zoom inteiro até 3× com nearest-neighbor, linha do chão, pivôs e coordenadas. **Ocultar Dio** e **Ocultar The World** funcionam separadamente. **Antes/depois** mostra a versão antiga à esquerda e a nova à direita sob a mesma física atual; não é uma reprodução da velocidade antiga.

- PNGs transparentes e metadados atuais: `public/sprites/dio/` e `public/sprites/the-world/`.
- Pacote de movimentação: `public/downloads/dio-the-world-movement.zip`. Inclui 26 sheets, 178 células, bases, paletas, metadados de movimento e tempos. Metadados do ZIP contêm apenas clipes presentes no pacote.
- Previews de cada clipe: `*-animated.png` (APNG) e `*-preview.png` (ampliada com nearest-neighbor).
- Pranchas com as poses-chave: `art/dio/qa/revision/contact-dio-ground.png`, `contact-dio-jump.png`, `contact-world-all.png`.
- Capturas reais do Chrome, sequências gravadas e registros de coordenadas: `art/dio/qa/revision/`.
- Prévia animada da comparação, gravada do Canvas: `public/previews/dio-movement-v2-before-after.png` e `.gif`.
- Versão anterior: `public/sprites/previous-movement/`. `archive.json` guarda os hashes dos arquivos arquivados; os testes verificam sua preservação.

As células continuam 256×256, RGBA binário, pivô (128,224), escala nativa 1, personagem voltado para a direita. A imagem invertida é responsabilidade do renderizador. Nenhuma sheet de Dio contém The World e nenhuma sheet do Stand contém Dio.

## Pipeline e separação da lógica

```sh
npm run art:dio
```

`scripts/revise_dio_movement.py` produz esta revisão a partir das bases pintadas. Usa segmentos de textura nativos, articulação rígida, IK com planos de joelho corrigidos, ajustes locais de roupa e sobreposições. Não redimensiona corpos para agachar, não usa suavização e não muda os arquivos do Samurai. `scripts/build_linked_movement.py` permanece como biblioteca do rig original e registro do método anterior; executar seu entry point diretamente restaura a versão antiga e não faz parte do fluxo atual.

`art/{dio,the-world}/movement-v2-rig.json` registra todas as poses; `movement-v2-timing.json` controla os tempos de cada quadro em ticks fixos. Nas fases aéreas, a trajetória define o progresso da fase e as durações definem o peso relativo de cada desenho; a inspeção isolada usa as durações absolutas. As caminhadas exigem amostras de um tick: mudar apenas o timing delas destrói o apoio dos pés. Para alterar sua velocidade, é preciso ajustar a trajetória dos tornozelos e a configuração física em conjunto.

`src/data/dio-movement.json` contém velocidade, gravidade, antecipação, pouso e curvas do dash. O gerador copia esses parâmetros para o perfil opcional de Dio em `src/data/dio.json`. O Samurai continua com seus parâmetros anteriores.

`src/render/dio-motion.ts` seleciona e sincroniza as poses, compartilhado pelo laboratório e pelo `FighterPresentation` do jogo. Posição, velocidade e estados continuam no motor. `src/engine/linked-entity.ts` controla o Stand no laboratório de movimento; `src/engine/stand-combat.ts` controla a entidade serializável no combate, incluindo golpes e retorno. Os dois usam as mesmas novas sheets e regras de acompanhamento neutro; não compartilham a vida de outra entidade nem leem tempo de renderização para fazer física.

## Validação e limites reais

Verificações executadas e aprovadas nesta revisão: **191 testes TypeScript, 41 testes de arte, 26 cenários no Chrome, cinco cenários online com dois navegadores e build de produção**. Após estabilizar o enquadramento, os sete cenários de Dio foram repetidos e aprovados. Uma verificação adicional abriu o cliente compilado na porta 3001, selecionou Dio, executou caminhada/salto/retorno ao Idle, testou downloads e gravou 80 ticks reais da comparação. O chão permaneceu na mesma linha da tela durante a gravação.

Os testes TypeScript verificam a física real de `Match`, ciclos completos de apoio, saltos parado/para frente/para trás, seleção das poses pela trajetória, agachamento interrompido, curvas de dash, virada do Stand e interrupção por ataques. Também verificam os nove normais, combos terrestre/aéreo, launcher, retorno do Stand e restauração determinística de estado.

Os testes de arte verificam 178 desenhos, ausência de duplicatas e de simples translações dentro dos clipes, identidade do rosto, comprimentos dos membros, paleta, transparência binária, pivôs e contato com o chão. Há uma verificação adicional contra pixels de mão duplicados fora do braço do Stand. Os hashes de todos os PNGs do Samurai são comparados com o registro anterior.

Os cenários do Chrome percorrem todos os quadros e executam os controles tanto no visualizador quanto no jogo: movimento contínuo, reversões rápidas, agachamentos repetidos, três direções de salto, pouso, dashes, acompanhamento, retorno ao Idle, comparação e controles de inspeção. As prévias gravadas são obtidas do Canvas realmente executado.

**Limite artístico:** esta é uma revisão de articulação da base pintada, com correções locais, não 178 redesenhos manuais de volume. Nas dobras profundas e na sobreposição de pernas ainda há rigidez e serrilhado de rotação que uma animação desenhada quadro a quadro poderia resolver melhor. O apoio dos pés tem a quantização inevitável de aproximadamente um pixel; o retorno à guarda fixa e algumas mudanças bruscas ainda não têm transições desenhadas para todos os ângulos possíveis. A comparação permite avaliar essas limitações sem esconder a versão anterior.

Reações de dano, entrada, KO e vitória de Dio ainda reutilizam poses próprias provisórias. Especiais, agarrão, facas e Ultimate de Dio não são oferecidos como funcionalidades concluídas. Esses trabalhos não fizeram parte desta revisão de movimentação.
