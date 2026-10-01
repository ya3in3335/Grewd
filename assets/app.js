/* خدمات DZ — كل الحسابات تتم في المتصفح. البيانات في مجلد data/ على GitHub. */
(function () {
  "use strict";

  /* ================= helpers ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const num = (v) => { const n = parseFloat(String(v ?? "").replace(/[\s  ]/g, "").replace(",", ".")); return isFinite(n) ? n : NaN; };
  const fmt = (n, d = 2) => Number(n).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const dzd = (n, d = 2) => fmt(n, d) + " دج";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem("dz:" + key));
      localStorage.setItem("dz:" + key, JSON.stringify(val));
    } catch (e) { return null; }
  }
  async function getJSON(path) {
    const r = await fetch(path, { cache: "no-cache" });
    if (!r.ok) throw new Error(path + " " + r.status);
    return r.json();
  }
  function copyText(txt) {
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast("تم النسخ ✓"), () => toast(txt));
    else toast(txt);
  }
  // جسر تطبيق أندرويد (WebView) — موجود فقط داخل التطبيق
  const NATIVE = window.DZApp || null;
  function printHTML(html) {
    $("#printArea").innerHTML = '<div dir="rtl" style="font-family:Tajawal,sans-serif;padding:20px">' + html + "</div>";
    if (NATIVE && NATIVE.print) setTimeout(() => NATIVE.print(), 60);
    else window.print();
  }
  function saveFile(name, text, mime) {
    if (NATIVE && NATIVE.saveFile) { NATIVE.saveFile(name, text, mime); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function shareText(txt) {
    if (NATIVE && NATIVE.share) NATIVE.share(txt);
    else if (navigator.share) navigator.share({ text: txt }).catch(() => {});
    else copyText(txt);
  }
  const fdate = (d) => { d = new Date(d); return isNaN(d) ? "—" : d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };
  const ago = (d) => {
    const m = Math.round((Date.now() - new Date(d)) / 60000);
    if (!isFinite(m)) return "";
    if (m < 2) return "دركا";
    if (m < 60) return "قبل " + m + " دقيقة";
    if (m < 1440) return "قبل " + Math.round(m / 60) + " ساعة";
    return "قبل " + Math.round(m / 1440) + " يوم";
  };
  // سطر "آخر تحديث" تحت كل أداة
  function setUpd(view, html) {
    const v = $('.view[data-view="' + view + '"] .wrap');
    if (!v) return;
    let el = $(".updated", v);
    if (!el) { el = document.createElement("div"); el.className = "updated"; v.appendChild(el); }
    el.innerHTML = html;
  }
  function persist(ids) { // يحفظ قيم الحقول في الجهاز
    ids.forEach((id) => {
      const el = document.getElementById(id);
      const v = store("f:" + id);
      if (v != null && v !== "") el.value = v;
      el.addEventListener("input", () => store("f:" + id, el.value));
    });
  }

  /* ================= theme ================= */
  const mq = window.matchMedia ? matchMedia("(prefers-color-scheme: light)") : null;
  function applyTheme() {
    const mode = store("theme") || "dark";
    const t = mode === "auto" ? (mq && mq.matches ? "light" : "dark") : mode;
    document.documentElement.dataset.theme = t;
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = t === "dark" ? "#06120d" : "#f5f1e6";
    if (NATIVE && NATIVE.setDark) NATIVE.setDark(t === "dark");
  }
  function applySize() { document.documentElement.dataset.size = store("size") || "md"; }
  applyTheme(); applySize();
  if (mq && mq.addEventListener) mq.addEventListener("change", applyTheme);
  $("#themeBtn").addEventListener("click", () => {
    store("theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    applyTheme(); syncSettings();
  });

  /* ================= history ================= */
  function addHistory(label, value) {
    const h = store("history") || [];
    if (h[0] && h[0].label === label && Date.now() - new Date(h[0].at) < 60000) h.shift();
    h.unshift({ label, value, at: new Date().toISOString() });
    store("history", h.slice(0, 60));
  }
  function renderHistory() {
    const h = store("history") || [];
    const ul = $("#history");
    ul.innerHTML = h.length ? "" : '<li class="muted">ما كاين حتى حساب بعد.</li>';
    h.forEach((it) => {
      const d = new Date(it.at);
      const li = document.createElement("li");
      li.innerHTML = "<span>" + esc(it.label) + " ← <b>" + esc(it.value) + "</b></span><small>" +
        d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + "</small>";
      ul.appendChild(li);
    });
  }
  $("#clearHist").addEventListener("click", () => { store("history", []); renderHistory(); });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]");
    if (b) copyText(document.getElementById(b.dataset.copy).textContent.trim());
  });

  // tabs داخل كل أداة
  $$(".tabs").forEach((tabs) => {
    const view = tabs.closest(".view");
    tabs.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      $$("button", tabs).forEach((x) => x.classList.toggle("on", x === b));
      $$("[data-pane]", view).forEach((p) => p.classList.toggle("hidden", p.dataset.pane !== b.dataset.tab));
    });
  });

  /* ================= tools registry + router ================= */
  const TOOLS = [
    { id: "ccp", ic: "🏦", t: "CCP ← RIP", d: "حوّل رقم الحساب البريدي إلى RIP مع المفتاح", k: "ccp rip rib بريد poste baridimob بريدي موب حساب مفتاح cle clé تحويل", tag: "PRO" },
    { id: "bac", ic: "🎓", t: "معدل البكالوريا", d: "كل الشعب بالمعاملات الرسمية", k: "bac باك بكالوريا معدل moyenne علامات نقاط شعبة امتحان" },
    { id: "salary", ic: "💼", t: "الراتب الصافي و IRG", d: "من الخام إلى الصافي + كشف راتب", k: "salaire راتب اجر أجرة شهرية irg ضريبة cnas صافي خام net brut fiche paie", tag: "PRO" },
    { id: "money", ic: "💶", t: "العملات", d: "السعر الرسمي مباشر + سعر السكوار", k: "euro اورو أورو يورو دولار dollar devise square سكوار صرف عملة change", tag: "LIVE" },
    { id: "prayer", ic: "🕌", t: "مواقيت الصلاة", d: "58 ولاية + العد التنازلي للصلاة", k: "صلاة salat أذان adhan فجر مغرب عشاء ظهر عصر رمضان إمساك مواقيت" },
    { id: "zakat", ic: "🌙", t: "حاسبة الزكاة", d: "النصاب والمبلغ الواجب", k: "زكاة zakat نصاب ذهب مال" },
    { id: "loan", ic: "📆", t: "حاسبة التقسيط", d: "القسط الشهري والثمن الحقيقي", k: "تقسيط قرض credit crédit مرابحة سيارة فائدة بنك قسط" },
    { id: "percent", ic: "🏷️", t: "التخفيضات والنسب", d: "الصولد، الزيادة، النسبة المئوية", k: "solde صولد تخفيض promo نسبة pourcentage زيادة" },
    { id: "age", ic: "🎂", t: "العمر والتواريخ", d: "عمرك بالضبط + التاريخ الهجري", k: "عمر age سن ميلاد تاريخ هجري date ايام" },
    { id: "wilayas", ic: "🗺️", t: "أرقام الولايات", d: "رقم الترقيم والرمز البريدي", k: "ولاية wilaya ولايات matricule ترقيم code postal بريدي رقم" },
    { id: "sos", ic: "🚨", t: "أرقام الطوارئ", d: "الحماية المدنية، الشرطة، الدرك", k: "طوارئ urgence شرطة police درك حماية مدنية اسعاف إسعاف نجدة" },
    { id: "suggest", ic: "💬", t: "اقترح أداة", d: "مشكل ما لقيتلوش حل؟ قولّنا", k: "اقتراح suggestion مشكل فكرة" },
    { id: "settings", ic: "⚙️", t: "الإعدادات", d: "المظهر، الخط، الولاية، والمطوّر", k: "اعدادات إعدادات settings مظهر خط تيليجرام telegram مطور تواصل تطبيق" }
  ];
  const norm = (s) => s.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[éèê]/g, "e");

  function renderGrid(q) {
    const nq = norm(q.trim());
    const list = TOOLS.filter((t) => !nq || norm(t.t + " " + t.d + " " + t.k).includes(nq));
    $("#toolGrid").innerHTML = list.map((t) =>
      '<a class="tile" href="#/' + t.id + '">' + (t.tag ? '<span class="tag' + (t.tag === "LIVE" ? " live" : "") + '">' + t.tag + "</span>" : "") +
      '<span class="ic">' + t.ic + "</span><b>" + t.t + "</b><small>" + t.d + "</small></a>").join("");
    $("#noResult").classList.toggle("hidden", list.length > 0);
    return list;
  }
  $("#search").addEventListener("input", (e) => renderGrid(e.target.value));
  $("#search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const l = renderGrid(e.target.value); if (l.length) location.hash = "#/" + l[0].id; }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      e.preventDefault(); location.hash = "#/"; setTimeout(() => $("#search").focus(), 30);
    }
  });

  const onEnter = {};
  function route() {
    const id = (location.hash.replace(/^#\/?/, "") || "home").split("?")[0];
    const view = $('.view[data-view="' + id + '"]') ? id : "home";
    $$(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === view));
    $$(".dock a").forEach((a) => a.classList.toggle("on", a.dataset.dock === view));
    const tool = TOOLS.find((t) => t.id === view);
    document.title = (tool ? tool.t + " — " : "") + "خدمات DZ";
    window.scrollTo(0, 0);
    if (onEnter[view]) onEnter[view]();
  }
  window.addEventListener("hashchange", route);

  /* ================= CCP / RIP ================= */
  // مفتاح CCP: الأرقام من اليمين مضروبة في 4..13، المجموع mod 100
  function ccpKey(ccp10) {
    let s = 0;
    for (let i = 0; i < 10; i++) s += Number(ccp10[9 - i]) * (i + 4);
    return String(s % 100).padStart(2, "0");
  }
  // مفتاح RIP لبريد الجزائر: 97 - ((CCP×100 mod 97 + 85) mod 97)
  // مُتحقَّق منه على RIP حقيقي: 00799999 0023115007 97
  function ripKey(ccp10) {
    const r = Number((BigInt(ccp10) * 100n) % 97n);
    return String(97 - ((r + 85) % 97)).padStart(2, "0");
  }
  function convertCCP(raw) {
    const digits = String(raw).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    if (!digits || digits.length > 10 || /^0+$/.test(digits)) return null;
    const ccp10 = digits.padStart(10, "0");
    return { ccp: digits, ccp10, key: ccpKey(ccp10), rip: "00799999" + ccp10 + ripKey(ccp10) };
  }
  const ccpInput = $("#ccpInput");
  ccpInput.addEventListener("input", () => { ccpInput.value = ccpInput.value.replace(/\D/g, "").slice(0, 10); });
  function doCCP() {
    const r = convertCCP(ccpInput.value);
    if (!r) { toast("ادخل رقم CCP صحيح (حتى 10 أرقام، بلا المفتاح)"); ccpInput.focus(); return; }
    $("#ripOut").innerHTML = r.rip.match(/^(\d{3})(\d{5})(\d{10})(\d{2})$/).slice(1).map((g) => "<span>" + g + "</span>").join("");
    $("#ccpOut").textContent = r.ccp;
    $("#ccpKey").textContent = r.key;
    $("#ccpResult").classList.remove("hidden");
    $("#ripOut").dataset.raw = r.rip;
    addHistory("CCP " + r.ccp, "RIP " + r.rip);
  }
  $("#ccpBtn").addEventListener("click", doCCP);
  ccpInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doCCP(); });
  $('[data-copy="ripOut"]').addEventListener("click", (e) => { e.stopPropagation(); copyText($("#ripOut").dataset.raw); });
  $("#ccpShare").addEventListener("click", () => {
    const txt = "RIP: " + $("#ripOut").dataset.raw + "\nCCP: " + $("#ccpOut").textContent + " clé " + $("#ccpKey").textContent;
    shareText(txt);
  });

  let bulkRows = [];
  $("#bulkBtn").addEventListener("click", () => {
    const lines = $("#bulkInput").value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    bulkRows = lines.map((line) => {
      const [n, ...rest] = line.split(/[,;\t]/);
      return { name: rest.join(" ").trim(), input: n.trim(), r: convertCCP(n) };
    });
    $("#bulkTable tbody").innerHTML = bulkRows.map((row, i) => row.r
      ? "<tr><td>" + (i + 1) + "</td><td>" + esc(row.name) + '</td><td class="mono">' + row.r.ccp + "</td><td>" + row.r.key + '</td><td class="mono">' + row.r.rip + "</td></tr>"
      : "<tr><td>" + (i + 1) + "</td><td>" + esc(row.name) + '</td><td class="mono">' + esc(row.input) + '</td><td>—</td><td class="err">رقم غير صالح</td></tr>').join("");
    $("#bulkTable").classList.toggle("hidden", !bulkRows.length);
    $("#bulkCsv").disabled = $("#bulkPrint").disabled = !bulkRows.length;
    if (bulkRows.length) { addHistory("تحويل بالجملة", bulkRows.length + " حساب"); toast("تم تحويل " + bulkRows.length + " حساب"); }
  });
  $("#bulkCsv").addEventListener("click", () => {
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const csv = ["Nom;CCP;Cle;RIP"].concat(bulkRows.map((r) =>
      [r.name, r.r ? r.r.ccp : r.input, r.r ? r.r.key : "", r.r ? "'" + r.r.rip : "INVALIDE"].map(q).join(";"))).join("\r\n");
    saveFile("rip-" + new Date().toISOString().slice(0, 10) + ".csv", "\ufeff" + csv, "text/csv;charset=utf-8");
  });
  $("#bulkPrint").addEventListener("click", () => {
    printHTML("<h1>قائمة أرقام RIP</h1><p>" + new Date().toLocaleDateString("fr-FR") + "</p>" + $("#bulkTable").outerHTML.replace(' class="hidden"', ""));
  });

  /* ================= BAC ================= */
  let bac = null, stream = null;
  const RING = 326.7;
  function renderStreams() {
    $("#streamChips").innerHTML = bac.streams.map((s) => '<button data-id="' + s.id + '"' + (s.id === stream.id ? ' class="on"' : "") + ">" + s.name + "</button>").join("");
  }
  function renderBac() {
    const saved = store("bac:" + stream.id) || {};
    $("#subjects").innerHTML = stream.subjects.map(([name, coef, opt], i) =>
      '<div class="subj"><span>' + esc(name) + '</span><input type="number" inputmode="decimal" min="0" max="20" step="0.01" placeholder="/20" data-i="' + i + '"' +
      (opt ? ' data-opt="1"' : "") + ' value="' + esc(saved["m" + i] ?? "") + '"><input class="coef" type="number" min="0" max="12" title="المعامل" value="' +
      esc(saved["c" + i] ?? coef) + '"></div>').join("");
    $("#bacNote").innerHTML = "<b>المعاملات:</b> " + esc(bac.source) + ". " + esc(bac.optionalRule) + " تقدر تبدّل أي معامل إذا لزم.";
    calcBac(false);
  }
  function calcBac(log) {
    let sum = 0, coefs = 0, filled = 0, total = 0, missingCoef = 0;
    const saved = {};
    $$("#subjects .subj").forEach((row) => {
      const [, mi, ci] = row.children;
      const i = mi.dataset.i;
      const coef = Math.max(0, num(ci.value) || 0);
      saved["c" + i] = ci.value;
      const m = num(mi.value);
      mi.classList.toggle("bad", mi.value !== "" && (isNaN(m) || m < 0 || m > 20));
      if (!mi.dataset.opt) total++;
      if (isNaN(m) || m < 0 || m > 20) { if (!mi.dataset.opt) missingCoef += coef; return; }
      saved["m" + i] = mi.value;
      if (mi.dataset.opt) { if (m > 10) sum += (m - 10) * coef; return; }
      sum += m * coef; coefs += coef; filled++;
    });
    store("bac:" + stream.id, saved);
    const fg = $("#ringFg"), men = $("#bacMention");
    if (!coefs) {
      $("#bacAvg").textContent = "—"; men.textContent = "ادخل علاماتك"; men.className = "mention";
      $("#bacDetail").textContent = ""; $("#bacNeed").textContent = ""; fg.style.strokeDashoffset = RING; return;
    }
    const avg = sum / coefs;
    $("#bacAvg").textContent = fmt(avg);
    fg.style.strokeDashoffset = RING * (1 - Math.min(avg, 20) / 20);
    fg.style.stroke = avg >= 10 ? "#d4a93b" : "#e0574b";
    const label = avg >= 18 ? "ممتاز مع تهاني اللجنة 🏆" : avg >= 16 ? "ممتاز 🌟" : avg >= 14 ? "جيد جداً 👏" : avg >= 12 ? "جيد 👍" : avg >= 10 ? "مقبول — ناجح 🎉" : "مازال — ما تحبطش 💪";
    men.textContent = label;
    men.className = "mention " + (avg >= 10 ? "pass" : "fail");
    $("#bacDetail").textContent = "المجموع " + fmt(sum) + " ÷ " + coefs + " معامل · " + filled + "/" + total + " مادة";
    // كم يلزم في المواد الناقصة للنجاح
    if (filled < total && missingCoef > 0) {
      const need = (10 * (coefs + missingCoef) - sum) / missingCoef;
      $("#bacNeed").textContent = need <= 0 ? "✓ ناجح مهما كانت علامات المواد الباقية."
        : need > 20 ? "المواد الباقية ما تكفيش للوصول إلى 10."
        : "باش تنجح، يلزمك معدل " + fmt(need) + " في المواد الباقية.";
    } else $("#bacNeed").textContent = "";
    if (log && filled === total) addHistory("معدل الباك (" + stream.name + ")", fmt(avg));
  }
  $("#subjects").addEventListener("input", () => calcBac(false));
  $("#subjects").addEventListener("change", () => calcBac(true));
  $("#streamChips").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    stream = bac.streams.find((s) => s.id === b.dataset.id);
    store("bac-stream", stream.id);
    renderStreams(); renderBac();
  });

  /* ================= Salary / IRG ================= */
  let irg = null;
  function computeIRG(taxable, special) {
    const t = Math.floor(taxable / 10) * 10;
    if (t <= irg.exemptUpTo) return 0;
    let tax = 0, prev = 0;
    for (const b of irg.brackets) {
      const top = b.upTo == null ? Infinity : b.upTo;
      if (t > prev) tax += (Math.min(t, top) - prev) * b.rate;
      prev = top;
    }
    tax -= Math.min(irg.abatement.max, Math.max(irg.abatement.min, tax * irg.abatement.rate));
    tax = Math.max(0, tax);
    if (special && t < 42500) tax = tax * 93 / 61 - 81213 / 41;
    else if (t < 35000) tax = tax * 137 / 51 - 27925 / 8;
    return Math.max(0, Math.round(tax * 100) / 100);
  }
  function salary(gross, special) {
    const cnas = gross * irg.cnasRate;
    const taxable = gross - cnas;
    const tax = computeIRG(taxable, special);
    return { gross, cnas, taxable, irg: tax, net: taxable - tax };
  }
  function doSalary(log) {
    if (!irg) return;
    const g = num($("#grossInput").value);
    if (!(g > 0)) { $("#salaryResult").classList.add("hidden"); if (log) toast("ادخل الراتب الخام"); return; }
    const s = salary(g, $("#specialCase").checked);
    $("#sCnas").textContent = dzd(s.cnas);
    $("#sTaxable").textContent = dzd(s.taxable);
    $("#sIrg").textContent = dzd(s.irg);
    $("#sNet").textContent = dzd(s.net);
    $("#barNet").style.flex = s.net; $("#barCnas").style.flex = s.cnas; $("#barIrg").style.flex = s.irg || 0.0001;
    $("#salaryResult").classList.remove("hidden");
    if (log) addHistory("راتب خام " + fmt(g, 0), "صافي " + dzd(s.net));
  }
  $("#salaryBtn").addEventListener("click", () => doSalary(true));
  $("#grossInput").addEventListener("input", () => doSalary(false));
  $("#grossInput").addEventListener("keydown", (e) => { if (e.key === "Enter") doSalary(true); });
  $("#specialCase").addEventListener("change", () => doSalary(false));

  $("#psMonth").value = new Date().toISOString().slice(0, 7);
  $("#psBtn").addEventListener("click", () => {
    if (!irg) return;
    const base = num($("#psGross").value) || 0, bonus = num($("#psBonus").value) || 0;
    if (!(base > 0)) return toast("ادخل الأجر القاعدي");
    const s = salary(base + bonus, false);
    const row = (a, b, c) => "<tr><td>" + a + "</td><td>" + (b ?? "") + "</td><td>" + (c ?? "") + "</td></tr>";
    printHTML("<h1>كشف الراتب</h1><p>الموظف: <b>" + esc($("#psName").value || "—") + "</b> — الشهر: " + esc($("#psMonth").value) + "</p>" +
      "<table><thead><tr><th>البند</th><th>مستحقات</th><th>اقتطاعات</th></tr></thead><tbody>" +
      row("الأجر القاعدي", fmt(base)) + row("المنح الخاضعة", fmt(bonus)) + row("الأجر الخام", fmt(s.gross)) +
      row("الضمان الاجتماعي CNAS 9%", "", fmt(s.cnas)) + row("الأجر الخاضع للضريبة", fmt(s.taxable)) + row("IRG", "", fmt(s.irg)) +
      "<tr><th>الصافي للدفع</th><th colspan='2'>" + dzd(s.net) + "</th></tr></tbody></table>" +
      "<p style='font-size:12px;margin-top:16px'>وثيقة استرشادية — خدمات DZ</p>");
  });

  /* ================= Currency ================= */
  const CUR = [["EUR", "🇪🇺 اليورو"], ["USD", "🇺🇸 الدولار الأمريكي"], ["GBP", "🇬🇧 الجنيه الإسترليني"], ["CAD", "🇨🇦 الدولار الكندي"],
    ["CHF", "🇨🇭 الفرنك السويسري"], ["TRY", "🇹🇷 الليرة التركية"], ["SAR", "🇸🇦 الريال السعودي"], ["AED", "🇦🇪 الدرهم الإماراتي"],
    ["QAR", "🇶🇦 الريال القطري"], ["TND", "🇹🇳 الدينار التونسي"], ["MAD", "🇲🇦 الدرهم المغربي"], ["CNY", "🇨🇳 اليوان الصيني"]];
  let rates = null, dir = "toDzd";
  $("#curSel").innerHTML = CUR.map(([c, n]) => '<option value="' + c + '">' + n + " (" + c + ")</option>").join("");
  $("#curSel").value = store("cur") || "EUR";
  function loadPar() { $("#parInput").value = store("par:" + $("#curSel").value) || ""; $("#parCode").textContent = $("#curSel").value; }
  function calcMoney() {
    const c = $("#curSel").value, a = num($("#amtInput").value) || 0;
    const off = rates && rates[c] ? rates[c] : NaN;
    const par = num($("#parInput").value);
    const conv = (rate) => dir === "toDzd" ? dzd(a * rate) : fmt(a / rate) + " " + c;
    $("#mOfficial").textContent = isFinite(off) ? conv(off) : "—";
    $("#mOfficialRate").textContent = isFinite(off) ? "1 " + c + " = " + fmt(off) + " دج" : "";
    $("#mParallel").textContent = par > 0 ? conv(par) : "اكتب السعر ↓";
    $("#mParRate").textContent = par > 0 && isFinite(off) ? "الفرق مع الرسمي: +" + fmt((par / off - 1) * 100, 0) + "%" : "";
  }
  $("#amtInput").addEventListener("input", calcMoney);
  $("#curSel").addEventListener("change", () => { store("cur", $("#curSel").value); loadPar(); calcMoney(); });
  $("#parInput").addEventListener("input", () => { store("par:" + $("#curSel").value, $("#parInput").value); calcMoney(); });
  $("#dirToggle").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("#dirToggle button").forEach((x) => x.classList.toggle("on", x === b));
    dir = b.dataset.dir; calcMoney();
  });
  // المصادر بالترتيب: API مباشر ← نسخة GitHub (data/live.json، تتحدث كل 6 ساعات) ← آخر نسخة محفوظة في الجهاز
  let ratesMeta = null, liveCache = null;
  async function getLive() {
    if (!liveCache) liveCache = getJSON("data/live.json").catch(() => null);
    return liveCache;
  }
  async function loadRates(force) {
    const cached = store("rates2");
    if (!force && cached && Date.now() - cached.at < 3 * 3600e3) { useRates(cached, false); return; }
    let got = null;
    try {
      const d = await getJSON("https://open.er-api.com/v6/latest/DZD");
      if (d.result !== "success") throw 0;
      const dzdPer = {};
      CUR.forEach(([c]) => { if (d.rates[c]) dzdPer[c] = 1 / d.rates[c]; });
      got = { dzdPer, updated: d.time_last_update_unix * 1000, source: "ExchangeRate-API — مباشر" };
    } catch (e) {}
    if (!got) {
      const l = await getLive();
      if (l && l.currency) got = { dzdPer: l.currency.dzdPer, updated: Date.parse(l.currency.updated), source: "نسخة GitHub (تتحدث كل 6 ساعات)" };
    }
    if (got) { got.at = Date.now(); store("rates2", got); useRates(got, false); }
    else if (cached) useRates(cached, true);
    else { setUpd("money", "⚠️ ما قدرناش نجيبو السعر الرسمي — تحقق من الأنترنت. سعر السكوار يخدم عادي."); }
    if (force) toast(got ? "تحدّثت الأسعار ✓" : "ما كانش اتصال — بقات آخر نسخة");
  }
  function useRates(r, stale) {
    rates = r.dzdPer; ratesMeta = r;
    calcMoney();
    setUpd("money", "🔄 <b>آخر تحديث للسعر الرسمي:</b> " + fdate(r.updated) + " (" + ago(r.updated) + ") · المصدر: " + esc(r.source) +
      (stale ? " · <b>نسخة محفوظة بلا أنترنت</b>" : "") + ' <button class="link-btn" data-act="refresh-rates">↻ حدّث دركا</button>');
    $("#ratesNote").innerHTML = "<b>السعر الرسمي</b> هو سعر الصرف الدولي المرجعي، ويقدر يختلف شوية على سعر بنك الجزائر اليومي. <b>سعر السكوار</b> تكتبو انت ويتحفظ في جهازك.";
    const eur = rates.EUR;
    if (eur) { const c = $("#todayEur"); if (c) c.textContent = "💶 1€ = " + fmt(eur) + " دج (رسمي)"; }
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "refresh-rates") loadRates(true);
    if (b.dataset.act === "refresh-gold") loadGold(true);
    if (b.dataset.act === "use-gold" && goldMeta) { $("#zGold").value = goldMeta.k24; store("f:zGold", String(goldMeta.k24)); calcZakat(); }
  });

  /* ================= Prayer times ================= */
  // خوارزمية فلكية (على نهج PrayTimes.org) بمعايير الجزائر: الفجر 18°، العشاء 17°، العصر = ظل المثل
  const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
  const fixA = (a) => ((a % 360) + 360) % 360, fixH = (h) => ((h % 24) + 24) % 24;
  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  function sunPos(jd) {
    const D = jd - 2451545.0;
    const g = fixA(357.529 + 0.98560028 * D), q = fixA(280.459 + 0.98564736 * D);
    const L = fixA(q + 1.915 * Math.sin(rad(g)) + 0.020 * Math.sin(rad(2 * g)));
    const e = 23.439 - 0.00000036 * D;
    const RA = fixH(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15);
    return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt: q / 15 - RA };
  }
  function prayerTimes(date, lat, lng, tz) {
    const jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
    const mid = (t) => fixH(12 - sunPos(jd + t).eqt);
    const angleTime = (angle, t, ccw) => {
      const decl = sunPos(jd + t).decl;
      const T = deg(Math.acos((-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat))))) / 15;
      return mid(t) + (ccw ? -T : T);
    };
    const asr = (t) => {
      const decl = sunPos(jd + t).decl;
      return angleTime(-deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(lat - decl)))))), t, false);
    };
    let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
    for (let k = 0; k < 2; k++) { // تكرار لتحسين الدقة
      const p = (h) => h / 24;
      t = {
        fajr: angleTime(18, p(t.fajr), true), sunrise: angleTime(0.833, p(t.sunrise), true), dhuhr: mid(p(t.dhuhr)),
        asr: asr(p(t.asr)), maghrib: angleTime(0.833, p(t.maghrib), false), isha: angleTime(17, p(t.isha), false)
      };
    }
    const adj = tz - lng / 15;
    const out = {};
    for (const k in t) out[k] = t[k] + adj;
    return out;
  }
  const PNAMES = { fajr: "الفجر", sunrise: "الشروق", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
  const hm = (h) => { const m = Math.round(h * 60); return String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
  let wilayas = [], place = null, prayerTimer = null;
  function renderPrayer() {
    if (!place) return;
    const now = new Date();
    // توقيت الجزائر UTC+1 دائماً
    const dzNow = new Date(now.getTime() + (now.getTimezoneOffset() + 60) * 60000);
    const today = prayerTimes(dzNow, place.lat, place.lng, 1);
    const nowH = dzNow.getHours() + dzNow.getMinutes() / 60 + dzNow.getSeconds() / 3600;
    let next = Object.keys(today).find((k) => k !== "sunrise" && today[k] > nowH);
    let diff;
    if (next) diff = today[next] - nowH;
    else { const tm = new Date(dzNow.getTime() + 864e5); next = "fajr"; diff = 24 - nowH + prayerTimes(tm, place.lat, place.lng, 1).fajr; }
    const s = Math.max(0, Math.round(diff * 3600));
    const cd = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((x) => String(x).padStart(2, "0")).join(":");
    $("#nextPrayer").innerHTML = "<small>الصلاة القادمة — " + esc(place.name) + "</small><b>" + PNAMES[next] + "</b><div class=\"cd\" dir=\"ltr\">" + cd + "</div>";
    setUpd("prayer", "🕌 <b>محسوبة لتاريخ اليوم:</b> " + dzNow.toLocaleDateString("fr-FR") + " · تتحدث وحدها كل يوم · المعايير: الفجر 18°، العشاء 17° (وزارة الشؤون الدينية)");
    $("#prayers").innerHTML = Object.keys(PNAMES).map((k) => '<div class="' + (k === next ? "now" : "") + '"><small>' + PNAMES[k] + '</small><b dir="ltr">' + hm(today[k]) + "</b></div>").join("");
  }
  function setPlace(p) {
    place = p; store("place", p);
    renderPrayer();
    clearInterval(prayerTimer);
    prayerTimer = setInterval(() => { if ($('.view[data-view="prayer"]').classList.contains("active")) renderPrayer(); }, 1000);
  }
  $("#wilayaSel").addEventListener("change", () => {
    const w = wilayas.find((x) => String(x[0]) === $("#wilayaSel").value);
    if (w) setPlace({ id: w[0], name: w[1], lat: w[3], lng: w[4] });
  });
  $("#geoBtn").addEventListener("click", () => {
    if (!navigator.geolocation) return toast("جهازك ما يدعمش تحديد الموقع");
    navigator.geolocation.getCurrentPosition((pos) => {
      setPlace({ id: 0, name: "موقعك الحالي", lat: pos.coords.latitude, lng: pos.coords.longitude });
      $("#wilayaSel").value = "";
    }, () => toast("ما قدرناش نحددو موقعك — اختار ولايتك"));
  });

  /* ================= Zakat ================= */
  const zIds = ["zGold", "zCash", "zGoldVal", "zTrade", "zOwed", "zDebt"];
  persist(zIds);
  function calcZakat() {
    const v = Object.fromEntries(zIds.map((id) => [id, Math.max(0, num($("#" + id).value) || 0)]));
    const base = v.zCash + v.zGoldVal + v.zTrade + v.zOwed - v.zDebt;
    if (!v.zGold) { $("#zNisab").textContent = "—"; $("#zDue").textContent = "—"; $("#zMsg").textContent = "ادخل سعر غرام الذهب باش نحسبو النصاب."; return; }
    const nisab = 85 * v.zGold;
    $("#zNisab").textContent = dzd(nisab, 0);
    if (base >= nisab) {
      $("#zDue").textContent = dzd(base * 0.025);
      $("#zMsg").textContent = "مالك الزكوي " + dzd(base, 0) + " — بلغ النصاب. الزكاة = 2.5% منه إذا حال عليه الحول (سنة هجرية).";
    } else {
      $("#zDue").textContent = "0 دج";
      $("#zMsg").textContent = base > 0 ? "مالك الزكوي " + dzd(base, 0) + " ما بلغش النصاب — ما عليكش زكاة المال." : "";
    }
  }
  zIds.forEach((id) => $("#" + id).addEventListener("input", calcZakat));
  let goldMeta = null;
  async function loadGold(force) {
    const cached = store("gold");
    let g = (!force && cached && Date.now() - cached.at < 3 * 3600e3) ? cached : null;
    if (!g) {
      try {
        const [x, l] = await Promise.all([getJSON("https://api.gold-api.com/price/XAU"), rates ? null : getLive()]);
        const usd = (rates && rates.USD) || (l && l.currency && l.currency.dzdPer.USD) || (cached && cached.usd);
        if (!(x.price > 0) || !usd) throw 0;
        g = { k24: Math.round(x.price / 31.1034768 * usd), updated: x.updatedAt || Date.now(), usd, source: "gold-api.com — مباشر", at: Date.now() };
      } catch (e) {
        const l = await getLive();
        if (l && l.gold) g = { k24: l.gold.dzdPerGram.k24, updated: l.gold.updated, source: "نسخة GitHub", at: Date.now() };
      }
      if (g) store("gold", g); else g = cached;
    }
    if (!g) { setUpd("zakat", "⚠️ ما قدرناش نجيبو سعر الذهب — اكتبو بيدك."); return; }
    goldMeta = g;
    if (!$("#zGold").value) { $("#zGold").value = g.k24; calcZakat(); }
    setUpd("zakat", "🔄 <b>سعر غرام الذهب عيار 24 (السعر العالمي):</b> " + dzd(g.k24, 0) + " · آخر تحديث " + fdate(g.updated) + " (" + ago(g.updated) + ") · " + esc(g.source) +
      '<br>السعر عند الصايغ في الجزائر يختلف عادة. <button class="link-btn" data-act="use-gold">استعمل هذا السعر</button> <button class="link-btn" data-act="refresh-gold">↻ حدّث</button>');
    if (force) toast("تحدّث سعر الذهب ✓");
  }

  /* ================= Loan ================= */
  let loanMode = "flat";
  persist(["lPrice", "lDown", "lRate", "lMonths"]);
  function calcLoan() {
    const price = num($("#lPrice").value) || 0, down = num($("#lDown").value) || 0;
    const rate = (num($("#lRate").value) || 0) / 100, n = Math.round(num($("#lMonths").value) || 0);
    const P = price - down;
    if (!(P > 0) || !(n > 0)) { ["lMonthly", "lFinanced", "lExtra", "lTotal"].forEach((id) => $("#" + id).textContent = "—"); return; }
    let monthly;
    if (loanMode === "flat") monthly = P * (1 + rate) / n;
    else { const i = rate / 12; monthly = i ? P * i / (1 - Math.pow(1 + i, -n)) : P / n; }
    const paid = monthly * n;
    $("#lMonthly").textContent = dzd(monthly);
    $("#lFinanced").textContent = dzd(P, 0);
    $("#lExtra").textContent = dzd(paid - P, 0);
    $("#lTotal").textContent = dzd(paid + down, 0);
  }
  ["lPrice", "lDown", "lRate", "lMonths"].forEach((id) => $("#" + id).addEventListener("input", calcLoan));
  $("#loanMode").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("#loanMode button").forEach((x) => x.classList.toggle("on", x === b));
    loanMode = b.dataset.mode;
    $("#lRateLbl").textContent = loanMode === "flat" ? "هامش الربح الإجمالي (%)" : "نسبة الفائدة السنوية (%)";
    calcLoan();
  });

  /* ================= Percent ================= */
  function calcPercent() {
    const p = num($("#pPrice").value), d = num($("#pDisc").value);
    $("#pOut1").innerHTML = p > 0 && d >= 0 ? 'الثمن الجديد: <span class="hl">' + dzd(p * (1 - d / 100)) + "</span> · ربحت " + dzd(p * d / 100) : "—";
    const a = num($("#pFrom").value), b = num($("#pTo").value);
    $("#pOut2").innerHTML = a > 0 && !isNaN(b) ? (b >= a ? "زيادة بـ " : "نقصان بـ ") + '<span class="hl">' + fmt(Math.abs(b - a) / a * 100) + "%</span> (" + fmt(b - a) + ")" : "—";
    const x = num($("#pPart").value), y = num($("#pWhole").value);
    $("#pOut3").innerHTML = y > 0 && !isNaN(x) ? fmt(x, 0) + " يمثّل " + '<span class="hl">' + fmt(x / y * 100) + "%</span> من " + fmt(y, 0) : "—";
  }
  ["pPrice", "pDisc", "pFrom", "pTo", "pPart", "pWhole"].forEach((id) => $("#" + id).addEventListener("input", calcPercent));

  /* ================= Age ================= */
  function diffYMD(a, b) {
    let y = b.getFullYear() - a.getFullYear(), m = b.getMonth() - a.getMonth(), d = b.getDate() - a.getDate();
    if (d < 0) { m--; d += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    return { y, m, d };
  }
  const ymdText = (r) => [r.y && r.y + " سنة", r.m && r.m + " شهر", (r.d || (!r.y && !r.m)) && r.d + " يوم"].filter(Boolean).join(" و ");
  const parseDate = (v) => { const [y, m, d] = v.split("-").map(Number); return y ? new Date(y, m - 1, d) : null; };
  const hijri = (d) => { try { return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(d); } catch (e) { return "—"; } };
  persist(["birth"]);
  function calcAge() {
    const b = parseDate($("#birth").value), now = new Date(); now.setHours(0, 0, 0, 0);
    if (!b || b > now) { ["aAge", "aDays", "aNext", "aHijri"].forEach((id) => $("#" + id).textContent = "—"); return; }
    $("#aAge").textContent = ymdText(diffYMD(b, now));
    $("#aDays").textContent = fmt(Math.round((now - b) / 864e5), 0) + " يوم";
    let nb = new Date(now.getFullYear(), b.getMonth(), b.getDate());
    if (nb < now) nb = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate());
    const left = Math.round((nb - now) / 864e5);
    $("#aNext").textContent = left === 0 ? "اليوم! 🎉" : "بعد " + left + " يوم";
    $("#aHijri").textContent = hijri(b);
  }
  $("#birth").addEventListener("input", calcAge);
  function calcDates() {
    const a = parseDate($("#d1").value), b = parseDate($("#d2").value);
    if (!a || !b) { $("#dOut").textContent = "—"; return; }
    const [x, y] = a <= b ? [a, b] : [b, a];
    $("#dOut").innerHTML = '<span class="hl">' + ymdText(diffYMD(x, y)) + "</span> · " + fmt(Math.round((y - x) / 864e5), 0) + " يوم";
  }
  $("#d1").addEventListener("input", calcDates);
  $("#d2").addEventListener("input", calcDates);

  /* ================= Wilayas ================= */
  function renderWilayas() {
    const q = norm($("#wSearch").value.trim());
    $("#wList").innerHTML = wilayas.filter((w) => !q || norm(w[0] + " " + w[1] + " " + w[2]).includes(q) || String(w[0]).padStart(2, "0") === q)
      .map((w) => '<div class="w"><span class="n">' + String(w[0]).padStart(2, "0") + "</span><div><b>" + w[1] + "</b><small>" + w[2] + " · الرمز البريدي " + String(w[0]).padStart(2, "0") + "000</small></div></div>").join("") ||
      '<p class="muted">ما كاين حتى ولاية بهذا الاسم.</p>';
  }
  $("#wSearch").addEventListener("input", renderWilayas);

  /* ================= Suggestions (GitHub Issues) ================= */
  let cfg = { owner: "ya3in3335", repo: "Grewd", suggestionLabel: "اقتراح" };
  let sugLoaded = false;
  async function loadSuggestions() {
    if (sugLoaded) return; sugLoaded = true;
    const ul = $("#sugList");
    try {
      const r = await fetch("https://api.github.com/repos/" + cfg.owner + "/" + cfg.repo + "/issues?state=all&per_page=15", { headers: { Accept: "application/vnd.github+json" } });
      if (!r.ok) throw 0;
      const items = (await r.json()).filter((i) => !i.pull_request);
      ul.innerHTML = items.length ? items.map((it) => '<li><a href="' + esc(it.html_url) + '" target="_blank" rel="noopener">' + (it.state === "closed" ? "✅ " : "💡 ") + esc(it.title) +
        "</a><small>👍 " + ((it.reactions && it.reactions["+1"]) || 0) + " · 💬 " + it.comments + "</small></li>").join("") : '<li class="muted">كون أول واحد يقترح 👋</li>';
    } catch (e) { ul.innerHTML = '<li class="muted">ما قدرناش نحمّلو الاقتراحات دركا.</li>'; sugLoaded = false; }
  }
  $("#sugBtn").addEventListener("click", () => {
    const title = $("#sugTitle").value.trim();
    if (!title) { toast("اكتب اقتراحك أولاً"); return; }
    const body = $("#sugBody").value.trim() + "\n\n---\nأُرسل من موقع خدمات DZ";
    window.open("https://github.com/" + cfg.owner + "/" + cfg.repo + "/issues/new?labels=" + encodeURIComponent(cfg.suggestionLabel) +
      "&title=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(body), "_blank", "noopener");
  });

  /* ================= Today strip ================= */
  function renderToday() {
    const now = new Date();
    const g = now.toLocaleDateString("ar-DZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const parts = ["📅 " + g, "🌙 " + hijri(now)];
    try {
      const ram = nextHijri(9, 1), eid = nextHijri(10, 1), adha = nextHijri(12, 10);
      [["رمضان", ram], ["عيد الفطر", eid], ["عيد الأضحى", adha]].sort((a, b) => a[1] - b[1]).slice(0, 1)
        .forEach(([n, d]) => parts.push("⏳ " + n + " بعد ~" + d + " يوم"));
    } catch (e) {}
    $("#today").innerHTML = parts.map((p) => "<span>" + esc(p) + "</span>").join("") + '<span id="todayEur" class="chip-live"></span>';
  }
  function nextHijri(month, day) { // عدد الأيام حتى تاريخ هجري (أم القرى — تقريبي ±1 يوم حسب رؤية الهلال)
    const f = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { month: "numeric", day: "numeric" });
    const d = new Date(); d.setHours(12, 0, 0, 0);
    for (let i = 0; i < 400; i++) {
      const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
      if (+p.month === month && +p.day === day) return i;
      d.setDate(d.getDate() + 1);
    }
    throw 0;
  }

  /* ================= Settings ================= */
  function seg(id, key, def, apply) {
    const el = $("#" + id);
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      store(key, b.dataset.v); apply(); syncSettings();
    });
    return () => $$("button", el).forEach((b) => b.classList.toggle("on", b.dataset.v === (store(key) || def)));
  }
  const syncTheme = seg("setTheme", "theme", "dark", applyTheme);
  const syncSize = seg("setSize", "size", "md", applySize);
  function syncSettings() {
    syncTheme(); syncSize();
    if (place && place.id) $("#setWilaya").value = place.id;
    $("#setCur").value = $("#curSel").value;
    const r = store("rates2"), g = store("gold");
    $("#setData").innerHTML =
      "<li><span>💶 أسعار العملات</span><small>" + (r ? fdate(r.updated) + " · " + ago(r.updated) : "ما تحمّلتش بعد") + "</small></li>" +
      "<li><span>🪙 سعر الذهب</span><small>" + (g ? fdate(g.updated) + " · " + ago(g.updated) : "ما تحمّلش بعد") + "</small></li>" +
      "<li><span>🕌 مواقيت الصلاة</span><small>تتحسب وحدها كل يوم</small></li>" +
      "<li><span>📚 البكالوريا · IRG · الولايات</span><small>تتحدث من GitHub في كل فتحة</small></li>";
  }
  $("#setCur").innerHTML = $("#curSel").innerHTML;
  $("#setWilaya").addEventListener("change", () => { $("#wilayaSel").value = $("#setWilaya").value; $("#wilayaSel").dispatchEvent(new Event("change")); toast("تحفظت ✓"); });
  $("#setCur").addEventListener("change", () => { $("#curSel").value = $("#setCur").value; $("#curSel").dispatchEvent(new Event("change")); toast("تحفظت ✓"); });
  $("#setRefresh").addEventListener("click", async () => {
    liveCache = null;
    await Promise.all([loadRates(true), loadGold(true)]);
    syncSettings();
  });
  $("#setClear").addEventListener("click", () => {
    if (!confirm("نمسحو كل بياناتك (العلامات، السجل، الإعدادات)؟")) return;
    try { Object.keys(localStorage).filter((k) => k.startsWith("dz:")).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
    if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
    toast("تمسحت ✓"); setTimeout(() => location.reload(), 700);
  });
  $("#setShare").addEventListener("click", () => shareText("خدمات DZ — CCP إلى RIP، معدل الباك، الراتب الصافي، العملات، مواقيت الصلاة… مجاناً:\n" + SITE));
  const SITE = "https://ya3in3335.github.io/Grewd/";
  function renderAbout() {
    const tg = (cfg.telegram || "").replace(/^@/, "").trim();
    const inApp = !!NATIVE;
    const appVer = inApp && NATIVE.version ? NATIVE.version() : null;
    $("#aboutVer").textContent = "الإصدار " + (appVer || cfg.appVersion || "—") + (inApp ? " · تطبيق أندرويد" : " · نسخة الويب");
    $("#devTg").classList.toggle("hidden", !tg);
    $$("[data-tg]").forEach((a) => { a.href = "https://t.me/" + tg; a.classList.toggle("hidden", !tg); });
    $("#devGh").href = "https://github.com/" + cfg.owner + "/" + cfg.repo;
    const apk = cfg.apk || "";
    const android = /Android/i.test(navigator.userAgent);
    $$("[data-apk]").forEach((a) => { a.href = apk; a.classList.toggle("hidden", !apk || inApp); });
    $("#appBanner").classList.toggle("hidden", !apk || inApp || !android);
    if (appVer && cfg.appVersion && cmpVer(cfg.appVersion, appVer) > 0) {
      $("#updBanner").classList.remove("hidden");
      $("#updBanner a").href = apk;
      $("#updVer").textContent = cfg.appVersion;
    }
  }
  const cmpVer = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };

  // PWA
  let deferredInstall = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; $("#pwaBtn").classList.remove("hidden"); });
  $("#pwaBtn").addEventListener("click", () => { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; $("#pwaBtn").classList.add("hidden"); } });
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

  /* ================= boot ================= */
  onEnter.history = renderHistory;
  onEnter.suggest = loadSuggestions;
  onEnter.money = () => loadRates(false);
  onEnter.zakat = () => loadGold(false);
  onEnter.prayer = () => { if (place) renderPrayer(); };
  onEnter.settings = syncSettings;

  renderGrid("");
  renderToday();
  loadPar();
  calcZakat(); calcLoan(); calcAge();
  route();

  (async function boot() {
    try { Object.assign(cfg, await getJSON("data/config.json")); } catch (e) {}
    $("#repoLink").href = "https://github.com/" + cfg.owner + "/" + cfg.repo;
    const rv = cfg.reviews || {};
    setUpd("ccp", "✓ <b>طريقة الحساب مراجَعة في:</b> " + (rv.ccp || "—") + " · مطابقة لرقم RIP حقيقي. الحساب يصير في جهازك وما يحتاجش أنترنت.");
    setUpd("salary", "📜 <b>جدول IRG:</b> قانون المالية 2022 (ساري في 2026) · <b>آخر مراجعة:</b> " + (rv.irg || "—") + ". إذا تبدّل القانون، يتحدّث هنا وحدو.");
    setUpd("wilayas", "🗺️ 58 ولاية · <b>آخر مراجعة:</b> " + (rv.wilayas || "—"));
    setUpd("sos", "☎️ <b>آخر مراجعة للأرقام:</b> " + (rv.sos || "—"));
    setUpd("percent", "🧮 حسابات رياضية بحتة — ما تحتاجش تحديث.");
    setUpd("loan", "🧮 حسابات رياضية — النسب تكتبها انت حسب العرض اللي عندك.");
    setUpd("age", "📅 التاريخ الهجري حسب تقويم أم القرى — ممكن يختلف بيوم على رؤية الهلال في الجزائر.");
    renderAbout();
    loadRates(false);

    getJSON("data/bac.json").then((d) => {
      bac = d;
      stream = bac.streams.find((s) => s.id === store("bac-stream")) || bac.streams[0];
      renderStreams(); renderBac();
      setUpd("bac", "📚 <b>المعاملات:</b> " + esc(bac.source) + " · <b>آخر مراجعة:</b> " + esc(bac.reviewed || (cfg.reviews || {}).bac || "—"));
    }).catch(() => toast("ما قدرناش نحمّلو بيانات البكالوريا"));

    getJSON("data/irg.json").then((d) => { irg = d; doSalary(false); }).catch(() => toast("ما قدرناش نحمّلو جدول IRG"));

    getJSON("data/wilayas.json").then((d) => {
      wilayas = d;
      $("#wilayaSel").innerHTML = '<option value="">— اختار ولايتك —</option>' + d.map((w) => '<option value="' + w[0] + '">' + String(w[0]).padStart(2, "0") + " · " + w[1] + "</option>").join("");
      renderWilayas();
      const p = store("place") || { id: 16, name: "الجزائر", lat: 36.754, lng: 3.059 };
      if (p.id) $("#wilayaSel").value = p.id;
      setPlace(p);
      $("#setWilaya").innerHTML = $("#wilayaSel").innerHTML;
      syncSettings();
    }).catch(() => toast("ما قدرناش نحمّلو قائمة الولايات"));

  })();

  // للاختبار
  window.DZ = { convertCCP, prayerTimes, salary: (g, s) => salary(g, s), go: (h) => { location.hash = h; } };
})();
