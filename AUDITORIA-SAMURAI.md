# Auditoria do Samurai — 29/10/2026

O Samurai funciona como personagem de teste, mas **a arte ainda não atinge o acabamento de uma produção de pixel art de luta redesenhada quadro a quadro**. A comparação foi feita com `references/samurai-style-reference.png`, os PNGs realmente exportados e capturas do motor. Passar em testes não certifica qualidade artística nem diversão.

## Evidências e correções

- Foram examinados os 58 clipes e suas 293 células P1. As duas paletas foram verificadas nos testes de arte e no navegador. O Idle aprovado permaneceu byte a byte igual.
- Antes: sete pares exatamente iguais dentro de clipes e oito pares adjacentes com menos de 3% de alteração dos pixels visíveis. Eram ciclos de defesa, espera e caído, não ataques normais falsamente contados. Depois: nenhum par idêntico, nenhuma simples translação e nenhum par abaixo desse limiar **dentro do mesmo clipe**. O limiar é diagnóstico, não uma regra artística: repetir poses pode ser correto em uma animação.
- Ainda existem 12 grupos compartilhados **entre clipes**: 293 células correspondem a 264 imagens distintas. As três versões do Crescente compartilham poses e diferem em duração, movimento e propriedades. Entradas/recuperações também compartilham a postura de retorno. Isso não foi disfarçado como desenho exclusivo.
- Corrigida a passada: antes os apoios deslizavam, em média, 29,5 px para frente e 31 px para trás entre poses consecutivas. Os pés agora alternam apoio/passagem e compensam a velocidade de 5,5 px/tick entre poses. Ciclo de 18 ticks. **Ainda podem deslizar até 11 px durante a retenção de três ticks do mesmo desenho.** Não é uma solução completa de foot locking.
- Limitados os alvos de braços e pernas ao alcance anatômico do rig, em vez de alongar ossos para alcançar a pose. O braço distante mantém encurtamento por perspectiva. As colisões foram reexportadas junto com as poses corrigidas.
- Adicionados pequenos retoques de expressão de dor e olhos fechados em nocaute/caído, preservando o contorno da face e o cabelo. São expressões limitadas, não atuação facial completa.
- Os ciclos de defesa/espera têm variações de quadril e guarda; derrota assenta e segura a pose final, em vez de repetir um ciclo de respiração.
- Corrigido o relógio das reações: lançado → queda → caído começa cada fase no quadro zero. Antes, o tempo total de hitstun podia pular os primeiros desenhos da nova fase. Arte e hurtboxes usam o mesmo relógio, incluído nos snapshots online.
- A proximidade do adversário não troca mais a caminhada para trás por uma guarda estática que desliza. A defesa real continua funcionando.
- Corrigido o download do laboratório: selecionar P2 agora baixa a spritesheet P2. Acrescentado o pacote de todos os PNGs e metadados.

## Avaliação dos dez critérios

1. **Pixel art e autenticidade:** os arquivos finais têm pixels definidos, 35 cores opacas por clipe P1, alpha binário e RGB zerado nas áreas transparentes. Não há suavização no Canvas nem nas ampliações exportadas. Porém, a origem é uma base gerada, reduzida à grade/paleta e retocada; a animação usa recortes articulados. Isso não equivale a contornos e agrupamentos de pixels trabalhados manualmente em cada pose. Existem contornos ásperos em juntas e textura que fica estática durante a rotação.
2. **Rosto:** reconhecível e estável, com olho, boca e cabelo preservados. Os novos retoques distinguem impacto e nocaute. Faltam ângulos de cabeça, variação de sobrancelhas e atuação compatível com cada esforço. Não considero a expressividade finalizada.
3. **Roupas:** preto, vermelho e claro continuam legíveis, com dobras e sombreado da base. Cabelo e abas têm movimento secundário. A roupa não muda de identidade, mas dobra/torção volumétrica real e visão traseira convincente não foram alcançadas.
4. **Consistência:** pivô e células estáveis; mesmas paletas e arma rígida. Os limites do rig corrigem alongamentos que chegavam a cerca de 60% no alvo de braço e 13% no de perna. Isso não garante anatomia desenhada perfeitamente: há sobreposição de juntas, mãos pouco convincentes e torso de pouca rotação.
5. **Fluidez:** os quadros têm durações individuais e mudanças reais nos membros; transições, interrupções e retorno ao neutro funcionam. Ainda há sensação de marionete, caminhada rápida, poses no chão rígidas e salto com pouca mudança de silhueta. A rotação de partes com nearest-neighbor conserva a nitidez, mas não produz os desenhos intermediários ideais.
6. **Silhueta:** a base, cabelo, abas e katana identificam bem o Samurai. Normais altos, baixos e aéreos distinguem-se, mas muitas ações mantêm quadril/peito muito semelhantes. A referência transmite mais giro corporal e extensão das poses.
7. **Ataques:** nove normais, 45 poses distintas dentro de cada sequência; preparação, contato e recuperação são separados. Há diferenças reais de alcance, dano, duração, launcher e finalização aérea. Visualmente ainda falta redesenho de mãos, rotação dos ombros e follow-through mais forte. A sequência Ultimate é funcional, mas não tem a variedade de desenhos de uma animação cinematográfica de alto nível.
8. **Animação e colisões:** os ataques usam cápsulas alinhadas à katana e hurtboxes por pose. O comprimento das cápsulas ativas fica entre 58,592 e 58,606 px: a diferença é arredondamento dos endpoints, não mudança de tamanho da arma. A auditoria amostrou 100 pontos de cada segmento ativo; no pior caso, 93% ficaram a até 2 px de metal visível. Cápsula de raio 3 px e retângulos são aproximações de jogabilidade, não colisão por pixel. Hurtboxes neutras são generalizadas; não modelam cada dobra da caminhada.
9. **Comandos:** amostragem a 60 Hz, buffer de oito ticks e reconhecimento direcional funcionam nos testes, inclusive espelhados, durante hitstop e em cancelamentos. Não foi medida latência física de teclado/monitor. O online conserva atraso de entrada e pode adicionar latência.
10. **Combate geral:** confirmação de acerto, hitstop, bloqueio, punição, agarrão, launcher e combo aéreo funcionam. Os testes comprovam comportamento, não que o balanceamento seja competitivo ou divertido para todas as pessoas. O tamanho dos personagens na arena, pausas de impacto e equilíbrio de especiais ainda merecem sessões humanas de jogo. Não houve playtest competitivo amplo nem medição de latência em uma conexão real distante.

## O que foi testado

- `npm test`: **148 testes TypeScript + 30 testes de arte**, incluindo regressões para apoios, alcance dos membros, transparência, cápsulas, relógio de reações e restauração determinística.
- `npm run test:browser`: **19 testes no Chrome**; todos os 293 quadros, P1/P2, pausar/avançar, nove normais, especiais, defesa, agarrão, Ultimate, combo de três golpes/205 de dano, launcher, combo aéreo, recuperação, BOT, Arcade e treinamento. Os testes simulam entradas reais; não apenas carregam imagens.
- Build de produção executado. Cinco cenários online passaram com dois processos de Chrome: sala/seleção/inputs, resultado/revanche, correção de divergência, desconexão/retomada e cliente servido pelo Node. Registro de arquitetura em `ONLINE.md` e testes em `e2e/online`.
- Capturas reais: `art/samurai/qa/audit/browser-inspector.png`, `browser-attack-boxes.png`, `art/samurai/qa/game/training.png` e `art/samurai/qa/complete/`. As capturas não substituem inspeção humana de cada instante de combate.

## Arquivos verificáveis

- Antes/depois e métricas: `art/samurai/qa/audit/before.json`, `after.json`, `before-contact.png`, `after-contact.png`.
- Comparação facial real ampliada: `art/samurai/qa/audit/faces-8x.png`.
- Backup anterior às correções, com fontes e exportações: `art/samurai/qa/audit/before-source-and-exports.zip`. Os arquivos `movement-revision.json` e `normal-revision.json` registram hashes anteriores e atuais. Os locks foram migrados explicitamente; não alegamos preservar os PNGs corrigidos. O lock original do Idle não foi alterado.
- PNGs transparentes: `public/sprites/samurai/`. Pacote: `public/downloads/samurai-audited-pngs.zip` — 116 sheets P1/P2, 293 células P1, metadados e FX separados.
- Inspeção interativa: `/art/samurai.html`, zoom inteiro, avanço por quadro e caixas. A prévia quadriculada inclui fundo apenas para inspeção; as spritesheets baixadas continuam transparentes.
- Reproduzir medições: `npm run art:audit`. Reexportação: `art:movement`, `art:attacks`, `art:complete`, nessa ordem, com migração de locks somente para uma correção artística intencional e arquivada.

## Limite da entrega

Foi corrigido o que consegui demonstrar e verificar tecnicamente sem trocar a identidade aprovada. **Não consegui obter costas, quedas, mãos, giro corporal e atuação facial com a qualidade de sprites desenhados manualmente por um artista especializado.** Esses pontos continuam provisórios. Não considero correto declarar que o Samurai já tem a mesma qualidade artística da referência ou que os testes encerram o trabalho de animação.
