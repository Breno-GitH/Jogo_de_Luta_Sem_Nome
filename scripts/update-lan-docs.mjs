import { readFileSync, writeFileSync } from "node:fs";
const read = p => readFileSync(p, "utf8"), write = (p,s) => writeFileSync(p,s);
const pkg = JSON.parse(read("package.json"));
pkg.scripts.test = pkg.scripts.test.replace("vitest run &&", "vitest run --maxWorkers=1 &&");
write("package.json", JSON.stringify(pkg,null,2)+"\n");
let r = read("README.md").replaceAll("http://127.0.0.1:3001/", "http://localhost/jogo-luta/");
r = r.replace("# Sem Nome — luta 2D", "# Sem Nome — luta 2D\n\n**XAMPP + LAN:** abra [o jogo no Apache](http://localhost/jogo-luta/), ou [o caminho completo](http://localhost/2025/Jogo_de_Luta_Sem_Nome/). Inicie Apache no XAMPP e execute `iniciar-multiplayer.bat`. Atualize com `atualizar-xampp.bat`. [Instalação, rede, proxy, testes e limites](README_LAN.md). Samurai, Dio/The World e Goku estão disponíveis em salas reais com seleção, confirmação, prontidão e início pelo anfitrião. Não é necessário Vite para jogar.");
r = r.replace("agarrão próprio e online para Dio não estão habilitados", "agarrão próprio de Dio permanece limitado; o online LAN agora inclui Dio e The World");
r = r.replace("Samurai e Dio estão disponíveis nos modos locais; o online continua Samurai contra Samurai.", "Samurai, Dio e Goku estão disponíveis nos modos locais e no online LAN.");
r = r.replace("Para subpasta do XAMPP, gere com `npm run build -- --base=./` e sirva o conteúdo de `dist` nessa subpasta.", "Para publicar no XAMPP, use `npm run build:lan`; os dois aliases servem o mesmo `dist`. Consulte [README_LAN.md](README_LAN.md).");
const start = r.indexOf("Em desenvolvimento, execute `npm run dev:server`", r.indexOf("## Contra Amigo online"));
const end = r.indexOf("## Controles", start);
r = r.slice(0,start) + "Na instalação final, execute Apache e `iniciar-multiplayer.bat`, abrindo `http://localhost/jogo-luta/`. O backend escuta apenas em 127.0.0.1:3001 e o Apache encaminha HTTP/WebSocket pela mesma origem dos jogadores. Amigos usam o IP local do servidor. Não há necessidade de abrir a porta interna no navegador.\n\nCrie/entre pelo código, escolha Samurai, Dio ou Goku, confirme o personagem e marque pronto. O anfitrião inicia quando ambos estiverem prontos. O servidor executa o combate a 60 Hz, publica inputs numerados e hashes, controla dano e resultado e permite recuperação por checkpoint e revanche. [Instruções LAN, testes e limitações](README_LAN.md); [arquitetura do netcode](ONLINE.md). `npm run test:lan` testa o build por Apache com dois Chromes independentes.\n\n" + r.slice(end);
write("README.md",r);
let o = read("ONLINE.md");
const sync = o.indexOf("## Sincronização e autoridade");
o = "# Salas privadas e netcode\n\nA execução final agora é **Apache/XAMPP + Node em loopback**, com Samurai, Dio/The World e Goku. Instruções atuais de instalação, aliases, proxy, LAN, firewall, criação de sala, confirmação/prontidão, início pelo anfitrião, atualização e testes: [README_LAN.md](README_LAN.md).\n\n`iniciar-multiplayer.bat` inicia o backend interno; `http://localhost/jogo-luta/` abre o jogo. Amigos usam o IP do servidor com o mesmo caminho. A URL Socket.IO usa a origem atual; não há `VITE_ONLINE_URL` a configurar. O modo LAN não publica o Node diretamente nem usa serviços externos.\n\nPara desenvolvimento, `npm run dev` + `npm run dev:server` mantêm Vite e proxy local. HOST agora tem padrão 127.0.0.1. O iniciador LAN mantém esse bind e porta 3001 independentemente de HOST/PORT. `INPUT_DELAY_TICKS` configura o atraso de 3 a 18 ticks (padrão 6).\n\n" + o.slice(sync);
write("ONLINE.md",o);
for (const name of ["goku-production", "goku-combat-production", "goku-specials-production", "goku-fury-production"]) {
 const p="e2e/"+name+".pw.mjs";
 let s=read(p).replaceAll("http://127.0.0.1:3001", "http://localhost/jogo-luta").replaceAll('goto("/art/', 'goto("art/').replaceAll('request.get("/" + path)', 'request.get(path)').replaceAll('request.get("/health")', 'request.get("api/health")').replaceAll('base+"/health"', 'base+"/api/health"').replaceAll("Requires production server on 3001.", "Requires the Apache production build and LAN backend.");
 write(p,s);
}
write("playwright.goku-production.config.mjs",read("playwright.goku-production.config.mjs").replace("http://127.0.0.1:3001", "http://localhost/jogo-luta/"));
