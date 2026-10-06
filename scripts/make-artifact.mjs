// Turns the `vite build --mode artifact` output into one claude.ai artifact page:
// <title> and <style> first, then the app root and the inlined module script. No <html>/<head>/
// <body> tags: the Artifact tool wraps the page in its own skeleton when publishing.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "dist-artifact";
const assets = readdirSync(join(dir, "assets"));
const js = assets.filter((f) => f.endsWith(".js"));
const css = assets.filter((f) => f.endsWith(".css"));
if (js.length !== 1 || css.length !== 1) throw new Error(`expected one JS and one CSS file, got ${js} / ${css}`);

let code = readFileSync(join(dir, "assets", js[0]), "utf8");
const styles = readFileSync(join(dir, "assets", css[0]), "utf8");
if (/<\/style/i.test(styles)) throw new Error("CSS contains </style");
// Inside an inline <script>, "</script" would end the element early.
code = code.replace(/<\/script/gi, "<\\/script");
if (/<!--/.test(code)) console.warn("warning: script contains <!-- (check that the page still parses)");
// Libraries carry U+FFFD inside string literals; write it as an escape (same value in JS), since
// the publisher treats a raw U+FFFD as a sign of corrupted text.
code = code.replace(/\uFFFD/g, "\\uFFFD");
if (/\uFFFD/.test(styles)) throw new Error("CSS contains U+FFFD");

// Before first paint: the skeleton's <html> has no lang/dir, so set Persian RTL here, and follow
// the viewer's theme (data-theme, else the system setting).
const themeBoot = `<script>(function(){var r=document.documentElement;r.lang="fa";r.dir="rtl";try{var t=r.getAttribute("data-theme");if(t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches)r.classList.add("dark")}catch(e){}})()</script>`;

const page = [
  "<title>هدف‌نگار</title>",
  '<meta name="description" content="هدف‌گذاری به روش ماتریس ساختار طراحی: از چشم‌انداز تا اقدام">',
  `<style>${styles}</style>`,
  themeBoot,
  '<div id="root"></div>',
  `<script type="module">${code}</script>`,
].join("\n");

const out = join(dir, "hadafnegar.html");
writeFileSync(out, page);
console.log(`${out}: ${(page.length / 1024 / 1024).toFixed(2)} MB`);
