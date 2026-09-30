'use strict';
// Belege der Kasse: gemeinsam für Kasse und Belege-Seite. Gespeichert wird im Browser, getrennt nach Gast und Konto.
window.Belege = (() => {
  const BK = 'automat5dk.casino.belege.v1';
  const MAX = 200;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = c => (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const owner = () => (window.Auth && Auth.user && Auth.user.id) || 'gast';
  const readAll = () => { try { const a = JSON.parse(localStorage.getItem(BK)); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const list = () => readAll().filter(b => b.owner === owner()).sort((a, b) => b.ts - a.ts);
  function add(b) {
    const all = readAll();
    all.push({ ...b, owner: owner() });
    try { localStorage.setItem(BK, JSON.stringify(all.slice(-MAX))); return true; } catch (e) { return false; }
  }
  const when = ts => new Date(ts).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'medium' });
  // Beleg-Karte als HTML (Klassen .beleg aus belege.css-Block in den Seiten)
  const isOut = b => b.kind === 'auszahlung';
  const html = b => isOut(b) ? `<div class="beleg">
    <div class="beleg-head"><strong>AUSZAHLUNGSBELEG</strong><span>${esc(b.no)}</span></div>
    <div class="beleg-row"><span>Datum</span><b>${when(b.ts)}</b></div>
    <div class="beleg-row"><span>Konto</span><b>${esc(b.payer || '–')}</b></div>
    <div class="beleg-row"><span>Ziel</span><b>Auszahlungstopf</b></div>
    <div class="beleg-row total"><span>Ausgezahlt</span><b>${money(b.cents)}</b></div>
    <div class="beleg-row"><span>Neues Guthaben</span><b>${money(b.balance)}</b></div>
    <p class="beleg-note">Spielgeld. Es wurde nie echtes Geld überwiesen. Dieser Beleg ist kein Zahlungsnachweis.</p>
  </div>` : `<div class="beleg">
    <div class="beleg-head"><strong>BELEG</strong><span>${esc(b.no)}</span></div>
    <div class="beleg-row"><span>Datum</span><b>${when(b.ts)}</b></div>
    <div class="beleg-row"><span>Zahlungsart</span><b>${esc(b.method)}</b></div>
    <div class="beleg-row"><span>Zahler</span><b>${esc(b.payer || '–')}</b></div>
    ${b.fromPool ? `<div class="beleg-row"><span>Aus dem Auszahlungstopf</span><b>${money(b.fromPool)}</b></div>` : ''}
    ${b.fromCard ? `<div class="beleg-row"><span>Von der Karte / Konto</span><b>${money(b.fromCard)}</b></div>` : ''}
    <div class="beleg-row total"><span>Gutgeschrieben</span><b>${money(b.cents)}</b></div>
    <div class="beleg-row"><span>Neues Guthaben</span><b>${money(b.balance)}</b></div>
    <p class="beleg-note">Spielgeld. Es wurde nie echtes Geld abgebucht. Dieser Beleg ist kein Zahlungsnachweis.</p>
  </div>`;
  const css = `
  .beleg { background: #fbfaf5; color: #1b1b1b; border-radius: 6px; padding: 16px 16px 12px; font-family: 'Share Tech Mono', monospace; font-size: 13px; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
  .beleg-head { display: flex; justify-content: space-between; gap: 10px; padding-bottom: 8px; margin-bottom: 6px; border-bottom: 2px dashed #9a9a90; font-size: 14px; }
  .beleg-row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; color: #4a4a44; }
  .beleg-row b { font-weight: 400; color: #1b1b1b; text-align: right; }
  .beleg-row.total { border-top: 2px dashed #9a9a90; margin-top: 6px; padding-top: 8px; font-size: 15px; }
  .beleg-row.total b { font-weight: 700; }
  .beleg-note { margin-top: 10px; font: 400 11px/1.4 'IBM Plex Sans', sans-serif; color: #6a6a62; }`;
  return { add, list, html, isOut, css, money, esc, when };
})();
