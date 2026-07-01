/**
 * Atlas GEO Report → 2-page A4 PDF (HTML/Puppeteer)
 * Usage: node render_report_pdf.js --data swiggy_data.json --output report.pdf
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const C = { navy:"#1A1A3E", violet:"#5B4FBE", lilac:"#9B93E3", low:"#C8C3EE", zero:"#E4E2F5", white:"#FFFFFF", purple:"#3D3A8C" };
const n = v => (v ?? 0).toLocaleString();
const esc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

function heatBg(v, isClient){
  if(isClient) return v>=50?C.purple:v>=25?C.violet:C.lilac;
  if(v>=70)return C.navy; if(v>=40)return C.violet; if(v>=20)return C.lilac;
  if(v>0)return C.low; return C.zero;
}
const heatFg = v => v>=20 ? C.white : C.navy;

function buildHtml(d, logoSrc){
 const tpl = fs.readFileSync(path.join(__dirname, "report.html"), "utf8");

  // Leaderboard (top 3)
  const lb = d.leaderboard.slice(0,3);
  const maxLb = Math.max(...lb.map(b=>b.mentions), 1);
  const leaderboardRows = lb.map(b=>{
    const me = b.name === d.brandName ? " me" : "";
    const ratio = b.mentions / maxLb;
    const shade = ratio >= 0.66 ? " hi" : ratio >= 0.33 ? " mid" : " lo";
        return `<div class="row${me}"><span class="rk">${b.rank}</span><span class="nm">${esc(b.name)}</span><span class="track"><span class="fill${shade}" style="width:${(ratio*100).toFixed(0)}%"></span></span><span class="mn">${n(b.mentions)}</span></div>`;
  }).join("");

  // Competitor mentions (top 10, fixed)
  const comps = d.competitorMentions.slice(0,10);
  const maxPct = Math.max(...comps.map(c=>c.percentage), 1);
  const competitorRows = comps.map(c=>{
    const me = c.name === d.brandName ? " me" : "";
    const ratio = c.percentage / maxPct;
    const shade = ratio >= 0.66 ? " hi" : ratio >= 0.33 ? " mid" : " lo";
        return `<div class="row${me}"><span class="nm">${esc(c.name)}</span><span class="track"><span class="fill${shade}" style="width:${(ratio*100).toFixed(0)}%"></span></span><span class="pct">${c.percentage}% · ${n(c.mentions)}</span></div>`;
  }).join("");

  // Platforms (adapts to however many are in the data)
  const platformRows = d.platformData.platforms.map(p=>
    `<tr><td>${esc(p.name)}</td><td class="r">${n(p.mentions)}</td><td class="r">${n(p.citations)}</td><td class="r">${p.brandVisibility}%</td><td class="r">${p.domainCoverage}%</td></tr>`
  ).join("");

  // Domains (top 10, fixed)
  const domainRows = d.domainAuthority.slice(0,10).map(x=>
    `<tr><td>${esc(x.domain)}</td><td class="r">${x.coverage}%</td><td class="r">${n(x.uniquePages)}</td><td class="r">${x.domainShare}%</td></tr>`
  ).join("");

  // Heatmap (adapts to brand count)
  const m = d.competitorVisibilityMatrix;
  let heatmap = `<tr><th class="lbl">Theme</th>${m.brands.map(b=>`<th>${esc(b)}</th>`).join("")}</tr>`;
  m.rows.forEach(row=>{
    heatmap += `<tr><td class="lbl">${esc(row.theme)}</td>` + m.brands.map((b,i)=>{
      const v = row.values[b] ?? 0; const isClient = i===0;
      return `<td style="background:${heatBg(v,isClient)};color:${heatFg(v)}">${v}</td>`;
    }).join("") + `</tr>`;
  });

  // Brand pages (top 6, fixed)
  const brandpageRows = d.brandPages.slice(0,6).map(p=>
    `<tr><td>${esc(p.name)}</td><td class="r">${p.prompts}</td></tr>`
  ).join("");

  // Insights (up to 4)
  const insightCards = d.keyInsights.slice(0,4).map(i=>
    `<div class="card"><div class="lab">${esc(i.label)}</div><div class="stat">${esc(i.stat)}</div><div class="desc">${esc(i.description)}</div></div>`
  ).join("");

  return tpl
    .replace(/{{LOGO_SRC}}/g, logoSrc)
    .replace(/{{BRAND}}/g, esc(d.brandName))
    .replace(/{{DOMAIN}}/g, esc(d.domain))
    .replace(/{{PLATFORM_COUNT}}/g, String(d.platformData.platforms.length))
    .replace(/{{BRAND_COUNT}}/g, String(m.brands.length))
    .replace(/{{KPI_MENTIONS}}/g, n(d.overview.totalMentions))
    .replace(/{{KPI_VISIBILITY}}/g, esc(d.overview.avgBrandCoverage))
    .replace(/{{KPI_CITATIONS}}/g, n(d.overview.totalCitations))
    .replace(/{{KPI_RANK}}/g, esc(d.overview.leaderboardRank))
    .replace(/{{LEADERBOARD_ROWS}}/g, leaderboardRows)
    .replace(/{{COMPETITOR_ROWS}}/g, competitorRows)
    .replace(/{{PLATFORM_ROWS}}/g, platformRows)
    .replace(/{{DOMAIN_ROWS}}/g, domainRows)
    .replace(/{{HEATMAP}}/g, heatmap)
    .replace(/{{BRANDPAGE_ROWS}}/g, brandpageRows)
    .replace(/{{INSIGHT_CARDS}}/g, insightCards);
}

async function generatePdf(data, outFile){
const logoPath = path.join(__dirname, "..", "logos", "pepper-logo.png");
let logoSrc = "";
try {
  logoSrc = "data:image/png;base64," + fs.readFileSync(logoPath).toString("base64");
} catch (e) {
  console.warn("Logo not found at", logoPath, "-", e.message);
}
const html = buildHtml(data, logoSrc);
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.pdf({ path: outFile, format: "A4", printBackground: true, margin: {top:0,right:0,bottom:0,left:0} });
  await browser.close();
  return outFile;
}

module.exports = { buildHtml, generatePdf };

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const dataFile = args[args.indexOf("--data")+1] || "swiggy_data.json";
  const outFile  = args[args.indexOf("--output")+1] || "report.pdf";
  const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  generatePdf(data, outFile).then(f => console.log("✓ PDF written:", f)).catch(e => { console.error(e); process.exit(1); });
}
