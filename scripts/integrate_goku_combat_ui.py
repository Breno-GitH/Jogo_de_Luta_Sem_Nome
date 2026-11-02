from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'src/ui/screens.ts';s=p.read_text(encoding='utf-8')
replacements=[
 ('<option value="dio">Dio Brando + The World</option></select>','<option value="dio">Dio Brando + The World</option><option value="goku">Goku · Base</option></select>'),
 ('${mode === "training" ? "" : "disabled"} aria-label="Selecionar Goku"','aria-label="Selecionar Goku"'),
 ('${mode === "training" ? "TESTE DE MOVIMENTAÇÃO" : "DISPONÍVEL NO TREINAMENTO"}','NORMAIS + AGARRÃO'),
 ('Samurai e Dio disponíveis nos modos locais. Goku está em teste de movimentação no Treinamento.','Samurai, Dio e Goku disponíveis nos modos locais. Goku tem nove normais, combos, defesas e agarrão; seus especiais e Super ainda não estão disponíveis.'),
 ('<summary>Movimentação de Goku</summary><p>A/D mover · W pular · S agachar · Shift + direção dash ou backdash.<br>Etapa de movimentação: Goku está disponível para controle no Treinamento. Ataques, agarrão, especiais e Super ainda não foram implementados. As reações de apoio ao treino são provisórias.<br>O laboratório de Goku permite inspecionar todas as animações, os pivôs e os pés.</p>','<summary>Controles de Goku</summary><p>A/D mover · W pular · S agachar · Shift + direção dash ou backdash · U agarrar.<br>J/K/L: leve, médio e forte. S+J/K/L: normais baixos. No ar: normais aéreos.<br>J → K → L e S+J → S+K → S+L: combos. S+L → W → J → K → L: launcher e finalização aérea.<br>Segure para trás para defender; baixo + trás protege contra ataques baixos. O agarrão pode ser evitado saindo do alcance ou pulando.<br>Especiais e Super de Goku ainda não estão disponíveis. <a href="art/goku-combat.html">Inspecionar golpes e combos</a>.</p>')]
for old,new in replacements:
 if old not in s:
  assert new in s,('missing UI replacement',old[:80])
 else:s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
