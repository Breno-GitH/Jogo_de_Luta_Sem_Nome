import{readFileSync,writeFileSync}from"node:fs";
for(const p of["src/game/app.ts","src/ui/screens.ts","src/ui/online.ts","src/render/renderer.ts"]){let s=readFileSync(p,"utf8");if(!s.includes("import.meta.env.BASE_URL"))continue;s=s.replaceAll("import.meta.env.BASE_URL","assetBase");s=`import { assetBase } from "../asset-base";\n`+s;writeFileSync(p,s);}
