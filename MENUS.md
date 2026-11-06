# Interface e modos de jogo

O menu faz parte do jogo existente em `C:\xampp\htdocs\2025\Jogo_de_Luta_Sem_Nome`.

Acesse `http://localhost/2025/Jogo_de_Luta_Sem_Nome/` ou o alias `http://localhost/jogo-luta/`. Inicie o Apache pelo XAMPP e o backend com `iniciar-multiplayer.bat`. O frontend publicado fica em `dist/`, sem depender do Vite. Para atualizar, encerre o backend e execute `atualizar-xampp.bat`; depois inicie novamente o backend. O publicador preserva o build anterior e usa cópia para um diretório vazio quando o Windows recusa renomear diretórios, publicando `index.html` por último.

## Navegação

W/S e setas verticais navegam, Enter confirma e Esc volta. Mouse e Tab também funcionam. Nas seleções de dificuldade, W/S altera a opção e Enter avança. Campos de código de sala continuam aceitando texto normalmente. O input de combate só está ativo na arena e não recebe teclas usadas nos menus.

O fluxo central está em `src/game/app.ts`. Existe uma única tela sobreposta ativa. As etapas de seleção são jogador, adversário e confirmação; o Arcade não precisa escolher adversário. Os cartões em `src/ui/catalog.ts` são compartilhados pelos modos locais e lobby, usando os PNGs reais do elenco.

## Modos

- **Arcade**: escolha qualquer um dos quatro personagens e enfrente os outros três, sem espelho. A dificuldade cresce Fácil → Normal → Difícil. Cada confronto é melhor de três rounds. Vitória avança, derrota permite repetir a etapa sem apagar a progressão. Após a terceira vitória aparece a conclusão.
- **Versus BOT**: escolha jogador, adversário e dificuldade. Usa os perfis reais da IA existente, com diferentes atrasos de reação, decisões, defesa e confirmações. Resultado oferece revanche, troca de personagem e menu.
- **Treinamento**: selecione ambos os personagens. Configure vida e Super infinitas ou quantidades percentuais individuais. Há parceiro parado, defendendo em pé/agachado, pulando ou controlado pela IA. Pode restaurar vida, encher/zerar Super, reiniciar posições, zerar o combo e seus medidores, consultar golpes e visualizar caixas. O histórico mostra os comandos realmente amostrados; os estados e dano vêm da simulação. Reiniciar combo cria uma prática neutra nas mesmas posições horizontais, limpando ataques, efeitos, stun e medidores.
- **Multiplayer LAN**: utiliza o backend Socket.IO e o proxy Apache existentes, com conexão na origem atual. Criar sala obtém código real; entrar valida código, sala e vagas no servidor. Dois jogadores escolhem, confirmam e ficam prontos. Somente o anfitrião pode iniciar, com confirmação do servidor. Copiar código usa a área de transferência; em origens onde o navegador a bloqueia, seleciona o texto para Ctrl+C. Resultado oferece revanche bilateral, lobby e saída.

## Pausa e resultados

Esc pausa os modos locais, inclusive o treino. O menu oferece continuar, golpes, controles, opções, reiniciar e retornar ao menu. No multiplayer, o menu local mantém a simulação rodando e envia entradas neutras, sem pausar o outro jogador. Sair exige confirmação e o servidor comunica o encerramento ao adversário. Uma revanche exige os dois jogadores.

A HUD preserva vida animada, energia real, cronômetro, rounds, combos e cinematografias. A tecla de Super mostrada acompanha remapeamentos. Com os padrões, R continua acionando as Supers existentes. Os especiais mantêm seus comandos direcionais.

## Opções

As preferências são salvas automaticamente em `localStorage`, por origem do navegador, na chave `sem-nome-preferences-v1`.

- Volume geral, efeitos, música e silenciar controlam os ganhos reais do Web Audio. Os efeitos existentes e uma trilha original de arpejos sintetizados usam canais separados. A reprodução começa após interação, conforme as regras do navegador.
- Tela cheia, escala máxima ajustada/1×/2×, escala inteira quando couber, tremor de câmera e FPS. A resolução lógica e o combate continuam 1280×720 e 60 Hz. Suavização do Canvas permanece desligada. Em janelas menores, a imagem reduz proporcionalmente para caber.
- Remapeamento de cada ação com rejeição de conflitos; Esc cancela uma captura, Enter e Esc são reservados aos menus. Restaurar padrões aplica os controles originais e salva imediatamente. A mesma tradução para ações de combate é usada offline e online.

## Disponibilidade real

Samurai, Dio, Goku, Luffy e Sasuke Hebi estão selecionáveis nos quatro modos. Sasuke tem movimentação, nove normais e reações de combate próprias. Luffy tem nove normais, três especiais, agarrão e provocação próprios. A Super de Luffy é Gomu Gomu no Jet Gigant, acionada com uma barra completa. Dio continua sem agarrão próprio.

## Arquivos principais

- `src/game/app.ts`: estado das telas e integração dos modos.
- `src/game/session.ts`: progressão Arcade com o elenco atual.
- `src/game/preferences.ts`: preferências, padrões e validação de teclas.
- `src/ui/screens.ts`: telas locais, opções, resultados e treinamento.
- `src/ui/catalog.ts`: seleção reutilizável, descrições e golpes por personagem.
- `src/ui/navigation.ts`: navegação isolada do combate.
- `src/ui/online.ts` e `src/ui/online-lobby.ts`: entrada, lobby e resultado reais.
- `src/engine/input.ts`: tradução das teclas configuradas para ações existentes; buffer direcional preservado.
- `src/audio/sound.ts`: efeitos e música com volumes separados.
- `src/render/renderer.ts`: preferências de tremor e tecla exibida na HUD.
- `src/style.css`: identidade arcade, retratos e adaptação de layout.
- `scripts/build-lan.mjs`: publicação no Apache com recuperação do erro de renomeação do Windows.
- `tests/preferences.test.ts`, `tests/game.test.ts`, `e2e/menu/`: validação automatizada.

## Validação realizada

`npm test` passou com 641 testes TypeScript e as 16 suítes de arte existentes. Os testes verificam combate, personagens, animações, colisões, estados e rede. O processo TypeScript/build de produção foi executado.

Os testes de navegador estão em `e2e/menu/`, com registros em `deployment/audit/menu-*.log` e capturas reais em `deployment/audit/menus/`.

- Navegação por teclado e mouse, retorno de todas as telas, seleção dos quatro lutadores, janelas 1440×1000, 1280×720 e 900×700, sem estouro horizontal ou corte do menu principal.
- Opções de áudio/vídeo, tela cheia, persistência após recarregar, captura de tecla, conflito, remapeamento aplicado a um ataque real e restauração.
- Treino dos quatro lutadores, vida e energia, comportamentos do parceiro, configurações de IA, lista de golpes, comandos, reinício de combo e posições, pausa e retomada.
- Progressão real dos rounds do Arcade até a conclusão, derrota, repetição, vitória/derrota Versus, revanche e troca de personagem. Este teste usa uma entrada exclusiva de desenvolvimento que reduz a vida para acelerar o KO; o helper não é publicado no Apache.
- Pelo Apache, duas sessões independentes criaram e entraram em sala, escolheram e confirmaram personagens, ficaram prontas, iniciaram e lutaram. Movimento e dano foram registrados, e os hashes de ticks comuns coincidiram. Testados KO, resultados, confirmação bilateral de revanche, lobby, saída, código inválido, sala inexistente, sala cheia e recuperação após servidor indisponível.
- Não houve acesso a dois computadores físicos. O teste de rede foi feito com sessões independentes no mesmo computador; a conectividade com outro dispositivo permanece uma verificação manual descrita em `README_LAN.md`.

Para repetir a interface local, inicie `npm run dev -- --port 5191` e execute `node node_modules/@playwright/test/cli.js test --config=playwright.menu.config.mjs e2e/menu/local.pw.mjs`. Para a versão Apache, defina `MENU_URL=http://localhost/2025/Jogo_de_Luta_Sem_Nome/`. Os testes LAN precisam da porta 3001 livre e iniciam seu próprio backend real de teste, encerrando-o no final.
