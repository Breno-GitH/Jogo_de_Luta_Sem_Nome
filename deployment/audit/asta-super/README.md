# Evidências — Super R de Asta

Capturas e vídeos reais da arena, produzidos pela build de produção de validação. O `verification.json` identifica a base e a versão do motor. `preserved-assets.json` confirma que os recursos anteriores de Asta permanecem byte a byte iguais à etapa 2.2.

- `complete.webm`: confirmação de Black Meteorite, Liebe, Devil Union, quatro espadas, Equinox e retorno.
- `no-fx.webm`: mesma coreografia com os efeitos opcionais desligados.
- `guarded.webm` e `whiff.webm`: falhas legítimas, sem cinematografia nem transformação completa.
- `complete-opener.png`, `complete-frame-38.png`, `complete-frame-70.png`: forma parcial e transição.
- `complete-frame-100.png`, `complete-frame-126.png`, `complete-frame-154.png`, `complete-frame-184.png`: contatos dos cortes.
- `complete-impact.png`, `complete-frame-236.png`, `restored.png`: finalização e restauração da arena.
- `captures.json`: estado de renderização e simulação de cada captura, sem imagens conceituais.
- `modes/`: Super completa em Arcade e Versus BOT, com barra adquirida pelo combate normal; resultados e erros de navegador registrados.
- `lan/`: mesmos momentos em dois clientes Socket.IO, comparando relógio, espadas, câmera, vida e hash do estado.

`vitest.txt`, `browser.txt`, `lan-regression.txt` e `lan-final.txt` contêm as saídas das verificações. Os nove testes LAN incluem as regras anteriores de Asta; os dois testes de Super foram repetidos na revisão final dos recursos e sockets. Testes visuais incluem os efeitos desligados para conferir a atuação corporal sem cobertura de partículas.

A revisão visual detectou e corrigiu fundos residuais em três atlas. O teste `tests/test_asta_super_art.py` agora verifica também os pontos de transparência que antes formavam a mancha cinza. As asas e a forma parcial seguem as últimas correções do usuário. Todos os efeitos de combate são por código.

Reprodução no site servido pelo Apache:

```powershell
node scripts/verify-asta-super-modes.mjs
node scripts/verify-asta-super-lan.mjs
```

O segundo comando abre dois clientes na instalação existente e cria uma sala de teste; não inicia outro servidor. A barra é preenchida por ataques normais. Os resultados de publicação local posteriores ao commit são conferidos também por `scripts/check-msfd-publication.mjs`, sem presumir acesso ao outro computador.
