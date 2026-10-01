// يجلب البيانات المتغيّرة يومياً ويكتبها في data/live.json (GitHub = الباك اند)
// يُشغَّل تلقائياً من .github/workflows/update-data.yml
import fs from "node:fs";

const CODES = ["EUR", "USD", "GBP", "CAD", "CHF", "TRY", "SAR", "AED", "QAR", "TND", "MAD", "CNY"];
const OZ = 31.1034768;

async function json(url) {
  const r = await fetch(url, { headers: { "User-Agent": "khadamat-dz-updater" } });
  if (!r.ok) throw new Error(url + " → " + r.status);
  return r.json();
}

const path = new URL("../data/live.json", import.meta.url);
const prev = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, "utf8")) : {};
const out = { ...prev, generated: new Date().toISOString() };

try {
  const fx = await json("https://open.er-api.com/v6/latest/DZD");
  if (fx.result !== "success") throw new Error("fx result " + fx.result);
  out.currency = {
    source: "ExchangeRate-API",
    updated: new Date(fx.time_last_update_unix * 1000).toISOString(),
    dzdPer: Object.fromEntries(CODES.filter((c) => fx.rates[c]).map((c) => [c, +(1 / fx.rates[c]).toFixed(4)]))
  };
} catch (e) { console.error("currency:", e.message); }

try {
  const g = await json("https://api.gold-api.com/price/XAU");
  const usd = out.currency && out.currency.dzdPer.USD;
  if (!(g.price > 0) || !usd) throw new Error("gold/usd missing");
  const g24 = (g.price / OZ) * usd;
  out.gold = {
    source: "gold-api.com (السعر العالمي)",
    updated: g.updatedAt || new Date().toISOString(),
    usdPerOz: g.price,
    dzdPerGram: { k24: Math.round(g24), k21: Math.round(g24 * 21 / 24), k18: Math.round(g24 * 18 / 24) }
  };
} catch (e) { console.error("gold:", e.message); }

fs.writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
