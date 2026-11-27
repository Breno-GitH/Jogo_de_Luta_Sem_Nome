# Arenas vivas — estado da implementação (27/11/2026)

As nove artes originais continuam em `public/arenas/`, inclusive as versões escolhidas de Anteiku, Cairo e Undertown. O estado que afeta a partida fica em `Match.arena` e entra no snapshot e no hash da simulação LAN. NPCs, poeira e céu são apenas visuais.

| Arena | Reação visual e evento no Caótico |
| --- | --- |
| Dojo | Alunos, folhas, painéis danificados e piso instável sinalizado. |
| Budokai | Plateia, bandeiras, bordas marcadas e ring-out após queda animada. |
| Cairo | Civis, luzes, poste e detritos urbanos; o tempo de Dio congela o relógio ambiental. |
| Enies Lobby | Mar, marinheiros, ponte com seções persistentes que cedem e Buster Call sinalizado após dano avançado. |
| Esconderijo Uchiha | Poeira, destroços e transição para `uchiha-ruin.png`; Kirin altera a luz. |
| Anteiku | Chuva, transeuntes, vitrine quebrada e queda de pequenos detritos. |
| Undertown | Residentes alienígenas, equipamentos em pane e descarga delimitada. |
| God Valley | Piratas, poeira, fissuras e seções de terreno que permanecem destruídas; Pandemonium tinge o cenário. |
| Clover | Cavaleiros, cristais danificados e descarga mágica delimitada; Devil Union escurece o campo. |

## Regras e câmera

- **Clássico:** ambiente animado, sem dano ou mudança de colisão.
- **Interativo:** dano visual progressivo, sem perigos de gameplay.
- **Caótico:** eventos dependentes de impactos, aviso no chão, área delimitada, contato único por evento, recarga de 420 ticks e dano não letal. Ring-out é exclusivo do Budokai. Buracos de Enies Lobby e God Valley persistem no round; a queda reposiciona o lutador e concede 150 ticks antes de uma nova queda.
- Cinemáticas e capturas pausam os temporizadores dos perigos. A parada de tempo de Dio congela todo o relógio da arena. O próximo round cria um estado novo.
- O fundo usa a inversa da transformação completa do canvas para determinar a região visível. Faixas curtas de arquitetura, céu próprio nas arenas externas e piso contínuo cobrem zoom, deslocamento, tremor e rotação sem transparência. O centro das artes não foi modificado.

## Evidências e limites da validação

- `e2e/arenas-camera.pw.mjs` cobre nove arenas em sete câmeras, incluindo zoom de 0,58, bordas, salto, rotação e tela mais alta; exige alfa 255 em cada pixel. Capturas: `evidencias/camera/`.
- `e2e/arenas.pw.mjs` inicia uma partida real de treino em cada arena e registra imagem e vídeo: `evidencias/renderizado/`.
- `tests/arenas.test.ts` verifica modos, eventos, quedas, ring-out, snapshots, parada de tempo e replay LAN. Build de produção e 1.533 testes Vitest passaram nesta revisão. Os cinco testes online com dois navegadores passaram, incluindo o cliente servido pelo Node de produção.
- O conjunto completo `npm test` ainda falha em `tests/test_attack_art.py`: o hash aprovado de `public/sprites/samurai/movement.json` não corresponde ao arquivo já presente na `main`. Esse arquivo não foi alterado aqui.
- A suíte LAN específica do XAMPP não executa neste PC: o alias Apache `/jogo-luta/` responde 404. A suíte online via Vite e Node de produção cobre a sincronização funcional neste ambiente.
- Ainda faltam uma auditoria visual manual de todos os quadros de cada Super, perfil de 60 FPS em hardware alvo, teste LAN em dois dispositivos físicos e avisos sonoros próprios para cada perigo. As extensões laterais usam módulos da arte existente; em zooms extremos sua repetição pode continuar perceptível.
