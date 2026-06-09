// Generates static HTML legal/support pages from lib/constants/legal-content.ts
// Output: docs/ (served by GitHub Pages)
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'lib/constants/legal-content.ts'), 'utf8');

// Turn the TS module into something evaluable (it's plain JS objects + template literals)
const transformed = src.replace(/export const /g, 'const ') +
  '\nmodule.exports = { LEGAL_CONTENT, LEGAL_SECTIONS, SUPPORT_EMAIL };';
const mod = { exports: {} };
new Function('module', 'exports', transformed)(mod, mod.exports);
const { LEGAL_CONTENT, LEGAL_SECTIONS, SUPPORT_EMAIL } = mod.exports;

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Convert a plain-text legal block into HTML (paragraphs, headings, line breaks)
function textToHtml(text) {
  const blocks = text.split(/\n\s*\n/);
  return blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return '';
    // A short line that looks like a numbered/section heading
    const first = lines[0];
    const isHeading = /^\d+\.\s/.test(first) || (lines.length === 1 && first.length < 70 && /[A-ZÀ-Ÿ]/.test(first) && !first.endsWith('.'));
    if (isHeading && lines.length === 1) {
      return `<h2>${esc(first)}</h2>`;
    }
    if (isHeading) {
      const head = `<h2>${esc(first)}</h2>`;
      const rest = lines.slice(1).map(esc).join('<br>');
      return head + `<p>${rest}</p>`;
    }
    return `<p>${lines.map(esc).join('<br>')}</p>`;
  }).join('\n');
}

const baseCss = `
:root{--bg:#0a0a0a;--card:#141414;--gold:#d4a853;--text:#eaeaea;--muted:#9a9a9a;--border:#262626}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.65}
.wrap{max-width:780px;margin:0 auto;padding:32px 20px 80px}
header{display:flex;align-items:center;gap:14px;padding:22px 0;border-bottom:1px solid var(--border);margin-bottom:28px}
.logo{font-weight:800;font-size:22px;letter-spacing:1px;color:var(--gold)}
.logo a{color:var(--gold);text-decoration:none}
h1{font-size:28px;margin:8px 0 4px}
h2{color:var(--gold);font-size:18px;margin:28px 0 8px}
p{margin:8px 0;color:var(--text)}
a{color:var(--gold)}
.muted{color:var(--muted);font-size:14px}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:22px;margin:18px 0}
.btn{display:inline-block;background:var(--gold);color:#0a0a0a;font-weight:700;padding:12px 18px;border-radius:10px;text-decoration:none;margin-top:8px}
nav{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px}
nav a{font-size:14px}
footer{border-top:1px solid var(--border);margin-top:48px;padding-top:18px;color:var(--muted);font-size:13px}
`;

function page({ title, body, activeNav }) {
  const nav = [
    ['index.html', 'Accueil'],
    ['privacy.html', 'Confidentialité'],
    ['support.html', 'Assistance'],
    ['legal.html', 'Mentions légales & CGU'],
  ].map(([href, label]) => `<a href="${href}"${activeNav===href?' style="opacity:.6"':''}>${label}</a>`).join('');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — PAKT</title>
<style>${baseCss}</style>
</head>
<body>
<div class="wrap">
<header>
  <span class="logo"><a href="index.html">PAKT</a></span>
</header>
<nav>${nav}</nav>
${body}
<footer>
  PAKT — édité par Velura, micro-entreprise — 229 rue Saint-Honoré, 75001 Paris, France<br>
  Contact : <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
</footer>
</div>
</body>
</html>`;
}

const docs = path.join(root, 'docs');
fs.mkdirSync(docs, { recursive: true });

// --- index.html ---
fs.writeFileSync(path.join(docs, 'index.html'), page({
  title: 'PAKT',
  activeNav: 'index.html',
  body: `
<h1>PAKT</h1>
<p class="muted">Le réseau du business. Découvrez des talents, créez des projets, développez votre activité.</p>
<div class="card">
  <h2 style="margin-top:0">Liens utiles</h2>
  <p><a href="privacy.html">Politique de confidentialité</a></p>
  <p><a href="support.html">Assistance & contact</a></p>
  <p><a href="legal.html">Mentions légales, CGU & CGV</a></p>
</div>`,
}));

// --- support.html ---
fs.writeFileSync(path.join(docs, 'support.html'), page({
  title: 'Assistance',
  activeNav: 'support.html',
  body: `
<h1>Assistance PAKT</h1>
<p>Besoin d'aide, d'un renseignement, ou de signaler un problème ? Notre équipe est là pour vous répondre.</p>
<div class="card">
  <h2 style="margin-top:0">Nous contacter</h2>
  <p>Écrivez-nous, nous répondons généralement sous 48 heures ouvrées.</p>
  <a class="btn" href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
</div>
<div class="card">
  <h2 style="margin-top:0">Questions fréquentes</h2>
  <p><strong>Comment supprimer mon compte ?</strong><br>Rendez-vous dans Réglages → Compte → Supprimer mon compte. La suppression est définitive et efface vos données.</p>
  <p><strong>Comment gérer mon abonnement ?</strong><br>Les abonnements se gèrent dans Réglages, et via votre compte App Store (Réglages iOS → votre nom → Abonnements).</p>
  <p><strong>Comment signaler un utilisateur ?</strong><br>Depuis un profil ou une conversation, utilisez l'option Signaler. Nous traitons chaque signalement.</p>
</div>`,
}));

// --- privacy.html ---
const privacy = LEGAL_CONTENT['privacy'];
const cookies = LEGAL_CONTENT['cookies'];
fs.writeFileSync(path.join(docs, 'privacy.html'), page({
  title: 'Politique de confidentialité',
  activeNav: 'privacy.html',
  body: `
<h1>${esc(privacy.title)}</h1>
${textToHtml(privacy.content)}
<hr style="border:none;border-top:1px solid #262626;margin:36px 0">
<h1>${esc(cookies.title)}</h1>
${textToHtml(cookies.content)}`,
}));

// --- legal.html (everything else) ---
const legalOrder = ['mentions-legales', 'cgu', 'cgv', 'remboursement-resiliation'];
const legalBody = legalOrder.map((id) => {
  const sec = LEGAL_CONTENT[id];
  if (!sec) return '';
  return `<h1>${esc(sec.title)}</h1>\n${textToHtml(sec.content)}\n<hr style="border:none;border-top:1px solid #262626;margin:36px 0">`;
}).join('\n');
fs.writeFileSync(path.join(docs, 'legal.html'), page({
  title: 'Mentions légales & CGU',
  activeNav: 'legal.html',
  body: legalBody,
}));

// .nojekyll so GitHub Pages serves files as-is
fs.writeFileSync(path.join(docs, '.nojekyll'), '');

console.log('Generated docs/:', fs.readdirSync(docs).join(', '));
