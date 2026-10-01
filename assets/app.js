/* خدمات DZ — كل المنطق يعمل في المتصفح، والبيانات تُقرأ من مجلد data/ في مستودع GitHub */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const fmt = (n, d = 2) => Number(n).toLocaleString("fr-DZ", { minimumFractionDigits: d, maximumFractionDigits: d });
  const dzd = (n) => fmt(n) + " دج";

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  async function getJSON(path) {
    const r = await fetch(path, { cache: "no-cache" });
    if (!r.ok) throw new Error(path);
    return r.json();
  }

  /* ---------- theme ---------- */
  const savedTheme = store("theme");
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  $("#themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store("theme", next);
  });

  /* ---------- history (Pro) ---------- */
  function addHistory(label, value) {
    const h = store("history") || [];
    // نفس العملية خلال دقيقة؟ نحدّث آخر سطر بدل ما نزيد سطر جديد
    if (h[0] && h[0].label === label && Date.now() - new Date(h[0].at) < 60000) h.shift();
    h.unshift({ label, value, at: new Date().toISOString() });
    store("history", h.slice(0, 50));
    renderHistory();
  }
  function renderHistory() {
    const h = store("history") || [];
    const ul = $("#history");
    ul.innerHTML = h.length ? "" : '<li class="hint">لا يوجد سجل بعد.</li>';
    h.forEach((it) => {
      const li = document.createElement("li");
      const d = new Date(it.at);
      li.innerHTML = "<span></span><small></small>";
      li.firstChild.textContent = it.label + " ← " + it.value;
      li.lastChild.textContent = d.toLocaleDateString("ar-DZ") + " " + d.toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" });
      ul.appendChild(li);
    });
  }
  $("#clearHist").addEventListener("click", () => { store("history", []); renderHistory(); });
  renderHistory();

  /* ---------- copy buttons ---------- */
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".copy");
    if (!b) return;
    const txt = document.getElementById(b.dataset.copy).textContent;
    navigator.clipboard.writeText(txt).then(() => toast("تم النسخ ✓"), () => toast(txt));
  });

  /* ---------- CCP / RIP ---------- */
  // مفتاح CCP: مجموع الأرقام مضروبة في أوزان من 4 إلى 13 (من اليمين) ، باقي القسمة على 100
  function ccpKey(ccp10) {
    let s = 0;
    for (let i = 0; i < 10; i++) s += Number(ccp10[9 - i]) * (i + 4);
    return String(s % 100).padStart(2, "0");
  }
  // مفتاح RIP: 97 - ((799999 + CCP) × 100 mod 97)
  function ripKey(ccp10) {
    const n = BigInt("799999" + ccp10);
    return String(97n - ((n * 100n) % 97n)).padStart(2, "0");
  }
  function convertCCP(raw) {
    const digits = String(raw).replace(/\D/g, "");
    if (!digits || digits.length > 10) return null;
    const ccp10 = digits.padStart(10, "0");
    return { ccp: digits, key: ccpKey(ccp10), rip: "00799999" + ccp10 + ripKey(ccp10) };
  }

  const ccpInput = $("#ccpInput");
  ccpInput.addEventListener("input", () => { ccpInput.value = ccpInput.value.replace(/\D/g, "").slice(0, 10); });
  function doCCP() {
    const r = convertCCP(ccpInput.value);
    if (!r) { toast("ادخل رقم CCP صحيح (حتى 10 أرقام)"); return; }
    $("#ccpKey").textContent = r.key;
    $("#ripOut").textContent = r.rip;
    $("#ccpFull").textContent = r.ccp + " clé " + r.key;
    $("#ccpResult").classList.remove("hidden");
    addHistory("CCP " + r.ccp, "RIP " + r.rip);
  }
  $("#ccpBtn").addEventListener("click", doCCP);
  ccpInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doCCP(); });

  /* ---------- Bulk (Pro) ---------- */
  let bulkRows = [];
  $("#bulkBtn").addEventListener("click", () => {
    const lines = $("#bulkInput").value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    bulkRows = lines.map((line) => {
      const [num, ...rest] = line.split(/[,;\t]/);
      const r = convertCCP(num);
      return { name: rest.join(" ").trim(), input: num.trim(), r };
    });
    const tb = $("#bulkTable tbody");
    tb.innerHTML = "";
    bulkRows.forEach((row, i) => {
      const tr = document.createElement("tr");
      const cells = row.r ? [i + 1, row.name, row.r.ccp, row.r.key, row.r.rip] : [i + 1, row.name, row.input, "—", "رقم غير صالح"];
      cells.forEach((c, j) => {
        const td = document.createElement("td");
        td.textContent = c;
        if (!row.r && j === 4) td.className = "err";
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    $("#bulkTable").classList.toggle("hidden", !bulkRows.length);
    $("#bulkCsv").disabled = $("#bulkPrint").disabled = !bulkRows.length;
    if (bulkRows.length) addHistory("تحويل بالجملة", bulkRows.length + " حساب");
  });
  $("#bulkCsv").addEventListener("click", () => {
    const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const csv = ["Nom;CCP;Cle;RIP"].concat(bulkRows.map((r) =>
      [r.name, r.r ? r.r.ccp : r.input, r.r ? r.r.key : "", r.r ? "'" + r.r.rip : "INVALIDE"].map(esc).join(";")
    )).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rip-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $("#bulkPrint").addEventListener("click", () => {
    printHTML("<h1>قائمة أرقام RIP</h1><p>" + new Date().toLocaleDateString("ar-DZ") + "</p>" +
      $("#bulkTable").outerHTML.replace(' class="hidden"', ""));
  });

  function printHTML(html) {
    const area = $("#printArea");
    area.innerHTML = '<div dir="rtl" style="font-family:Tajawal,sans-serif;padding:20px">' + html + "</div>";
    window.print();
  }

  /* ---------- BAC ---------- */
  let streams = [];
  function renderBac() {
    const st = streams.find((s) => s.id === $("#streamSel").value) || streams[0];
    const saved = store("bac-" + st.id) || {};
    const box = $("#subjects");
    box.innerHTML = '<div class="subj subj-head"><span>المادة</span><span>العلامة</span><span>المعامل</span></div>' +
      (window.innerWidth > 760 ? '<div class="subj subj-head"><span>المادة</span><span>العلامة</span><span>المعامل</span></div>' : "");
    st.subjects.forEach(([name, coef, optional], i) => {
      const row = document.createElement("div");
      row.className = "subj";
      row.innerHTML = '<span></span><input type="number" min="0" max="20" step="0.25" inputmode="decimal"><input class="coef" type="number" min="0" max="10" step="1">';
      row.children[0].textContent = name;
      row.children[1].value = saved[i] ?? "";
      row.children[1].dataset.i = i;
      row.children[1].dataset.optional = optional ? "1" : "";
      row.children[2].value = coef;
      box.appendChild(row);
    });
    calcBac();
  }
  function calcBac() {
    const st = $("#streamSel").value;
    let sum = 0, coefs = 0, filled = 0;
    const saved = {};
    document.querySelectorAll("#subjects .subj:not(.subj-head)").forEach((row) => {
      const mark = parseFloat(row.children[1].value);
      const coef = parseFloat(row.children[2].value) || 0;
      if (isNaN(mark)) return;
      const m = Math.min(20, Math.max(0, mark));
      saved[row.children[1].dataset.i] = row.children[1].value;
      if (row.children[1].dataset.optional) {
        // المادة الاختيارية تُحسب فقط النقاط فوق 10
        if (m > 10) sum += (m - 10) * coef;
        return;
      }
      sum += m * coef; coefs += coef; filled++;
    });
    store("bac-" + st, saved);
    const avgEl = $("#bacAvg"), men = $("#bacMention");
    if (!coefs) { avgEl.textContent = "—"; men.textContent = "ادخل علاماتك"; men.className = "mention"; $("#bacDetail").textContent = ""; return; }
    const avg = sum / coefs;
    avgEl.textContent = fmt(avg);
    let label;
    if (avg >= 18) label = "ممتاز مع تهنئة اللجنة 🏆";
    else if (avg >= 16) label = "ممتاز 🌟";
    else if (avg >= 14) label = "جيد جداً 👏";
    else if (avg >= 12) label = "جيد 👍";
    else if (avg >= 10) label = "مقبول — ناجح 🎉";
    else label = "غير ناجح — مازال فيها 💪";
    men.textContent = label;
    men.className = "mention " + (avg >= 10 ? "pass" : "fail");
    $("#bacDetail").textContent = "المجموع " + fmt(sum) + " ÷ " + coefs + " معامل · " + filled + " مادة";
  }
  $("#subjects").addEventListener("input", calcBac);
  $("#subjects").addEventListener("change", () => {
    const v = $("#bacAvg").textContent;
    if (v !== "—") addHistory("معدل الباك (" + $("#streamSel").selectedOptions[0].text + ")", v);
  });
  $("#streamSel").addEventListener("change", () => { store("bac-stream", $("#streamSel").value); renderBac(); });

  /* ---------- Salary / IRG ---------- */
  let irg = null;
  function computeIRG(taxable) {
    const t = Math.floor(taxable / 10) * 10;
    if (t <= irg.exemptUpTo) return 0;
    let tax = 0, prev = 0;
    for (const b of irg.brackets) {
      const top = b.upTo == null ? Infinity : b.upTo;
      if (t > prev) tax += (Math.min(t, top) - prev) * b.rate;
      prev = top;
    }
    let ab = tax * irg.abatement.rate;
    ab = Math.min(irg.abatement.max, Math.max(irg.abatement.min, ab));
    tax = Math.max(0, tax - ab);
    if (t < irg.smoothing.to) tax = tax * irg.smoothing.mult - irg.smoothing.minus;
    return Math.max(0, Math.round(tax * 100) / 100);
  }
  function salary(gross) {
    const cnas = gross * irg.cnasRate;
    const taxable = gross - cnas;
    const tax = computeIRG(taxable);
    return { gross, cnas, taxable, irg: tax, net: taxable - tax };
  }
  function doSalary() {
    const g = parseFloat(String($("#grossInput").value).replace(/\s/g, "").replace(",", "."));
    if (!irg) return toast("البيانات مازال تتحمل…");
    if (!(g > 0)) return toast("ادخل الراتب الخام");
    const s = salary(g);
    $("#sCnas").textContent = dzd(s.cnas);
    $("#sTaxable").textContent = dzd(s.taxable);
    $("#sIrg").textContent = dzd(s.irg);
    $("#sNet").textContent = dzd(s.net);
    $("#barNet").style.flex = s.net;
    $("#barCnas").style.flex = s.cnas;
    $("#barIrg").style.flex = s.irg;
    $("#salaryResult").classList.remove("hidden");
    addHistory("راتب خام " + fmt(g, 0), "صافي " + dzd(s.net));
  }
  $("#salaryBtn").addEventListener("click", doSalary);
  $("#grossInput").addEventListener("keydown", (e) => { if (e.key === "Enter") doSalary(); });

  // Payslip (Pro)
  $("#psMonth").value = new Date().toISOString().slice(0, 7);
  $("#psBtn").addEventListener("click", () => {
    if (!irg) return toast("البيانات مازال تتحمل…");
    const base = parseFloat($("#psGross").value) || 0;
    const bonus = parseFloat($("#psBonus").value) || 0;
    if (!(base > 0)) return toast("ادخل الراتب الخام");
    const s = salary(base + bonus);
    const name = ($("#psName").value || "—").replace(/[<>&]/g, "");
    const row = (a, b, c) => "<tr><td>" + a + "</td><td>" + (b ?? "") + "</td><td>" + (c ?? "") + "</td></tr>";
    printHTML(
      "<h1>كشف الراتب</h1><p>الموظف: <b>" + name + "</b> — الشهر: " + $("#psMonth").value + "</p>" +
      "<table><thead><tr><th>البند</th><th>مستحقات</th><th>اقتطاعات</th></tr></thead><tbody>" +
      row("الأجر القاعدي", fmt(base)) + row("المنح الخاضعة", fmt(bonus)) +
      row("الأجر الخام", fmt(s.gross)) + row("الضمان الاجتماعي CNAS 9%", "", fmt(s.cnas)) +
      row("الأجر الخاضع للضريبة", fmt(s.taxable)) + row("IRG", "", fmt(s.irg)) +
      "<tr><th>الصافي للدفع</th><th colspan='2'>" + dzd(s.net) + "</th></tr></tbody></table>" +
      "<p style='font-size:12px;margin-top:16px'>وثيقة استرشادية مولّدة من خدمات DZ.</p>"
    );
    addHistory("كشف راتب " + name, dzd(s.net));
  });

  /* ---------- Currency ---------- */
  let rates = null, dir = "toDzd";
  function calcMoney() {
    if (!rates) return;
    const c = rates.currencies.find((x) => x.code === $("#curSel").value);
    const a = parseFloat(String($("#amtInput").value).replace(",", ".")) || 0;
    if (dir === "toDzd") {
      $("#mOfficial").textContent = dzd(a * c.official);
      $("#mParallel").textContent = dzd(a * c.parallel);
    } else {
      $("#mOfficial").textContent = fmt(a / c.official) + " " + c.code;
      $("#mParallel").textContent = fmt(a / c.parallel) + " " + c.code;
    }
  }
  $("#amtInput").addEventListener("input", calcMoney);
  $("#curSel").addEventListener("change", calcMoney);
  document.querySelectorAll(".toggle button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".toggle button").forEach((x) => x.classList.toggle("on", x === b));
    dir = b.dataset.dir;
    calcMoney();
  }));

  /* ---------- Community: GitHub Issues as backend ---------- */
  let cfg = { owner: "", repo: "", suggestionLabel: "اقتراح" };
  function detectRepo() {
    // على GitHub Pages: owner.github.io/repo
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (m) {
      cfg.owner = m[1];
      const seg = location.pathname.split("/").filter(Boolean)[0];
      if (seg && !/\.html?$/.test(seg)) cfg.repo = seg;
    }
  }
  async function loadSuggestions() {
    const ul = $("#sugList");
    try {
      const url = "https://api.github.com/repos/" + cfg.owner + "/" + cfg.repo +
        "/issues?state=all&per_page=10&labels=" + encodeURIComponent(cfg.suggestionLabel);
      const r = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
      if (!r.ok) throw new Error(r.status);
      const items = (await r.json()).filter((i) => !i.pull_request);
      ul.innerHTML = items.length ? "" : '<li class="hint">كن أول من يقترح 👋</li>';
      items.forEach((it) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = it.html_url; a.target = "_blank"; a.rel = "noopener";
        a.textContent = (it.state === "closed" ? "✅ " : "💡 ") + it.title;
        const sm = document.createElement("small");
        sm.textContent = "👍 " + ((it.reactions && it.reactions["+1"]) || 0) + " · 💬 " + it.comments;
        li.append(a, sm);
        ul.appendChild(li);
      });
    } catch (e) {
      ul.innerHTML = '<li class="hint">تعذّر تحميل الاقتراحات الآن.</li>';
    }
  }
  $("#sugBtn").addEventListener("click", () => {
    const title = $("#sugTitle").value.trim();
    if (!title) return toast("اكتب اقتراحك أولاً");
    const body = ($("#sugBody").value.trim() || "") + "\n\n---\nأُرسل من موقع خدمات DZ";
    const url = "https://github.com/" + cfg.owner + "/" + cfg.repo + "/issues/new?labels=" +
      encodeURIComponent(cfg.suggestionLabel) + "&title=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(body);
    window.open(url, "_blank", "noopener");
  });

  /* ---------- boot: load data from repo ---------- */
  (async function boot() {
    try { Object.assign(cfg, await getJSON("data/config.json")); } catch (e) {}
    detectRepo();
    const repoUrl = "https://github.com/" + cfg.owner + "/" + cfg.repo;
    $("#repoLink").href = repoUrl;

    getJSON("data/bac.json").then((d) => {
      streams = d.streams;
      $("#streamSel").innerHTML = streams.map((s) => '<option value="' + s.id + '">' + s.name + "</option>").join("");
      const last = store("bac-stream");
      if (last && streams.some((s) => s.id === last)) $("#streamSel").value = last;
      renderBac();
    }).catch(() => toast("تعذّر تحميل بيانات البكالوريا"));

    getJSON("data/irg.json").then((d) => { irg = d; }).catch(() => toast("تعذّر تحميل جدول IRG"));

    getJSON("data/rates.json").then((d) => {
      rates = d;
      $("#curSel").innerHTML = d.currencies.map((c) => '<option value="' + c.code + '">' + c.flag + " " + c.name + " (" + c.code + ")</option>").join("");
      $("#ratesNote").textContent = "آخر تحديث: " + d.updated + " — " + d.note;
      calcMoney();
    }).catch(() => toast("تعذّر تحميل أسعار العملات"));

    loadSuggestions();
  })();

  // للاختبار
  window.DZ = { convertCCP, computeIRG: (t) => computeIRG(t), salary: (g) => salary(g) };
})();
