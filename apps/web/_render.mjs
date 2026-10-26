import { readFileSync, writeFileSync } from "node:fs";
import { getDocumentProxy, renderPageAsImage } from "unpdf";
const buf = new Uint8Array(readFileSync(process.argv[2]));
const t = Date.now();
const png = await renderPageAsImage(buf, Number(process.argv[3] ?? 1), { canvasImport: () => import("@napi-rs/canvas"), scale: 2 });
writeFileSync(process.argv[4], Buffer.from(png)); console.log("ok", Date.now() - t, "ms", png.byteLength);
