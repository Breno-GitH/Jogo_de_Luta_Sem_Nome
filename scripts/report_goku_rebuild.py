from pathlib import Path
import json,re
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/rebuild'
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
v=read(ART/'export-validation.json');m=read(ROOT/'public/sprites/goku/movement.json')
trace=read(ART/'qa/full/trace.json');wanted=['idle','walkForward','walkBack','crouchStart','crouchIdle','crouchEnd','jumpRiseForward','jumpApexBackward','jumpFall','landingForward','dashForward','backdash']
board=Image.new('RGB',(1920,4*390),'#1b2c3e');d=ImageDraw.Draw(board)
for n,k in enumerate(wanted):
 matches=[i for i,t in enumerate(trace)if t['animation']==k];assert matches,k;i=matches[len(matches)//2]
 im=Image.open(ART/f'qa/full/recording/{i:03}.png').convert('RGB').resize((640,360),Image.Resampling.NEAREST);x=n%3*640;y=n//3*390;board.paste(im,(x,y+25));d.text((x+8,y+6),f'{k} / real canvas / drawing {int(trace[i]["frame"])+1}',fill='#ffe2b2')
board.save(ROOT/'public/previews/goku-rebuild-captured-contact.png')
lines=['# Goku — reconstrução completa de movimentação (revisão5)','',
'## Diagnóstico e correção','',
'Os defeitos principais já existiam nos PNGs individuais: reconstrução de membros com curvas e texturas do desenho, sobreposição de recortes de tronco/cabeça/faixa e deformação por malha nas caminhadas antigas. O empacotador não era a causa principal. Também havia fontes que cruzavam uma divisão nominal da folha: recortar rigidamente essa grade podia amputar uma ponta de bota. A extração agora registra a figura inteira e rejeita partes destacadas antes de escrever a folha.', '',
'A geração ativa não usa o rig antigo, morphing, compressão de agachamento, recortes de braços/pernas nem cabeças enxertadas. São poses completas, produzidas com geração gráfica assistida, revisadas, importadas com escala uniforme, paleta32cores e transparência binária. Não são desenhos integralmente feitos à mão por um animador. Fontes e prompts permanecem em `art/goku/rebuild/` e a rastreabilidade por célula fica nos arquivos `*-production.json`.', '',
'A referência de calibração em pé mantém uma escala por lote; poses agachadas/aéreas não são ampliadas de volta para130px. A importação das caminhadas completas anteriores tem seu próprio protocolo de fonte inteira, também reconstruído e comparado pixel a pixel nos testes. Quatro poses de passagem foram redesenhadas para conservar guarda e largura do tronco. Os desenhos completos úteis foram mantidos; a experiência com16poses por direção foi rejeitada porque não respeitava o apoio correto.', '',
'## Integração','',
'Física preservada: velocidade4,2; recuo3,8; velocidade aérea6,5; impulso−17,7; gravidade0,72; preparação6ticks; aterrissagem8ticks; mesmos perfis de dash/backdash. O diretor visual de Goku escolhe subida/ápice/queda pela trajetória real, conserva a direção para a aterrissagem, seleciona a profundidade do levantamento ao soltar/reapertar o agachamento e usa transições completas e interrompíveis. O bug que descartava a transição após o primeiro tick foi encontrado no navegador e corrigido.', '',
'Células256×256; pivô128,224; margens mínimas8px; transparênciaRGBA0/255; nearest-neighbor. Hurtboxes conservadoras por faixas de pixels acompanham as poses. Não há hitboxes ofensivas de Goku. A câmera e os estados físicos permanecem separados dos desenhos. Samurai, Dio e The World preservados:1995arquivos de arte/dados verificados por hash, mais a verificação dos fontes compartilhados congelados.', '',
'## Arquivos e quantidades','',f'{len(m["clips"])}animações; {sum(c["count"]for c in m["clips"].values())}referências de célula; {v["uniqueWholeDrawings"]}desenhos distintos. Endpoints compartilhados intencionalmente ligam fases (por exemplo, última queda/primeiro contato e retorno à guarda); não são novos desenhos artificiais para preencher ticks.','']
for k,c in m['clips'].items():lines.append(f'- `{k}`: {c["count"]}desenhos; {sum(c["durations"])}ticks; durações{c["durations"]}; '+('loop.'if c['loop']else'sem loop.'))
lines+=['','## Inspeção e execução','',
'`npm start` serve o build em `http://127.0.0.1:3001/`. Para desenvolvimento: `npm run dev` e, quando necessário, `npm run dev:server`. Para compilar: `npm run build`. Para reproduzir a importação a partir das fontes já arquivadas: `npm run art:goku` (Python/Pillow/NumPy, encontrados pelo lançador). Não é preciso gerar imagens novamente para rodar o jogo.', '',
'Visualizador: `/art/goku.html?rebuild=5`. Permite controlar Goku, escolher todas as33animações, loop de inspeção, pausa, avanço por desenho/tick,¼×/½×/1×/2×, inversão de lado, zoom1–4×, pivô/chão, limites do desenho, hurtboxes e comparação com o pacote anterior. Guias anatômicas2D estimadas estão disponíveis apenas nas poses-chave Idle1/CrouchIdle1; são referências de inspeção, nunca um rig que deforma pixels.', '',
'- PNGs nativos, folhas e APNGs: `public/sprites/goku/`.',
'- Ampliações de todas as142células com chão/pivô/limites: `art/goku/rebuild/enlarged/`.',
'- Contatos por animação: `art/goku/rebuild/*-contact.png`.',
'- Contato geral: `public/previews/goku-rebuild-contact.png`.',
'- Contato capturado no renderizador real: `public/previews/goku-rebuild-captured-contact.png`.',
'- Prévia real: `public/previews/goku-rebuild-gameplay.png` (APNG, pixels exatos) e `.gif` (redução nearest-neighbor1/2).171amostras a30FPS; quadros idênticos podem ser fundidos pelo APNG mantendo a duração.',
'- Loops dos desenhos exportados: `public/previews/goku-<animação>.png`; são inspeções, não substituem a trajetória física do salto.',
'- Download: `public/downloads/goku-movement.zip`, com PNGs, ampliações, contatos, metadados e auditoria.', '',
'## Verificação','',
'`npm test`:361testes de simulação em17arquivos, além da bateria Python de arte. Os22testes específicos de arte de Goku verificam todas as células, fontes completas, alfa/paleta, margens, conectividade, calibração, ordem/recorte, duração, endpoints, ausência de duplicatas só transladadas, caixas e preservação. O log completo fica em `full-test.log`.', '',
'Chrome: controle real nas duas direções; Idle prolongado; avanços/recuos contínuos; reversões rápidas; entrada/saída de caminhada; agachamentos completos e interrompidos; retomada durante levantamento; saltos parado/frente/trás; aterrissagens; dashes e recuperação; treinamento principal e recebimento de ataques; pausa; comparação; velocidades; inspeção individual dos142quadros. Evidências em `qa/`, inclusive rastros de ticks e capturas de cada desenho no navegador. Os testes numéricos não certificam naturalidade artística.', '',
'## Limitações restantes','',
'A caminhada ainda pode mostrar deslizamento residual e batidas na troca de desenhos: oito poses mantidas4–5ticks não equivalem a uma nova pose perfeita por tick. Não foi aplicada uma malha ou deformação para esconder isso. A largura aparente de tecido, pequenos detalhes do rosto/cabelo e algumas mudanças entre poses ainda variam; não considero o conjunto equivalente a uma animação M.U.G.E.N profissional polida manualmente.', '',
'As reações de treino são completas e utilizáveis, mas continuam compartilhadas por vários tipos de dano/defesa. Não representam um repertório completo de combate, expressões, entrada ou vitória de Goku. O personagem permanece restrito ao treinamento, sem ataques/especiais/Super. Os limites retangulares de hurtbox são conservadores; o sprite não tem colisão por pixel.','']
report='\n'.join(lines)
report=re.sub(r'(?<=\d)(?=[A-Za-zÀ-ÿ])',' ',report).replace('nearest-neighbor1/2','nearest-neighbor 1/2').replace('paleta32','paleta 32').replace('em17','em 17').replace('Os22','Os 22').replace('as33','as 33').replace('dos142','dos 142').replace('das142','das 142').replace('por hash,','por hash,')
(ART/'REBUILD.md').write_text(report,encoding='utf-8');print('Report and real-capture contact saved.')
