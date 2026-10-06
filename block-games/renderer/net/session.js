// Online-Sessions über Supabase Realtime — Broadcast + Presence, KEINE neuen
// Tabellen. Transport-Entscheidung (siehe ROADMAP „Online-Spiel"): supabase-js
// ist bereits mit dem vollen Realtime-Stack gebündelt (`../vendor`-freier
// UMD-Build), die CSP erlaubt `wss://…supabase.co` bereits, und der Renderer
// ist vollständig gesandboxt (kein Node — kein anderer Transport wäre ohne
// IPC/CSP-Änderung möglich). Host-autoritativ: der Host simuliert alles
// (inkl. Bots), Gäste senden nur Eingaben und rendern Snapshots (siehe
// renderer/block-bomb/main.js bzw. laser-lines/main.js, `role: 'guest'`).
//
// Ein SessionCode identifiziert einen Realtime-Channel `blockgames:session:
// <CODE>`. Jeder Client (Host wie Gast) trackt sich selbst per Presence
// (`peerId` als Presence-Key); Nachrichten laufen als EIN Broadcast-Event
// `msg` mit `{ type, payload, from }`, damit `on(type, handler)` generisch
// dispatchen kann, statt für jeden Nachrichtentyp einen eigenen Broadcast-
// Event-Namen zu brauchen.
//
// Einladungen laufen über einen zweiten, permanenten Channel pro angemeldetem
// Nutzer: `blockgames:user:<userId>`. Wer eingeladen werden will, abonniert
// seinen eigenen Channel beim Login; zum Einladen wird der Channel der
// Zielperson kurz geöffnet, die Nachricht gesendet und wieder geschlossen.

'use strict';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O/1/I
const SESSION_PREFIX = 'blockgames:session:';
const USER_PREFIX = 'blockgames:user:';

function randomCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

// Client-Identität: angemeldet → echte User-ID (stabil über Sessions hinweg,
// nötig für Freundes-Einladungen); als Gast eine zufällige, nur für diesen
// Prozess gültige ID.
function localPeerId() {
  if (window.Auth && Auth.userId) return Auth.userId;
  if (!window.__blockGamesGuestPeerId) {
    window.__blockGamesGuestPeerId = 'guest-' + Math.random().toString(36).slice(2, 10);
  }
  return window.__blockGamesGuestPeerId;
}

const NetSession = {
  state: 'idle', // 'idle' | 'hosting' | 'guest'
  code: null,
  isHost: false,
  peerId: null,
  displayName: 'Spieler',

  _channel: null,
  _handlers: {},        // type → [handler, ...]
  _presenceHandlers: [], // handler(peers[])
  _joinCheck: null,     // Gast: prüft nach jedem Presence-Sync, ob ein Host da ist
  _joinTimer: null,
  _hostSeen: false,     // Gast: Host war schon einmal in der Presence
  _hostGoneTimer: null, // Gast: läuft, solange der Host in der Presence fehlt

  // Lokales Ereignis an die registrierten Handler (z.B. 'host_left')
  _emit(type, payload, from) {
    const list = this._handlers[type];
    if (list) list.slice().forEach(h => h(payload, from));
  },

  // Peer-ID des Hosts laut Presence (oder null)
  hostPeerId() {
    const h = this.peers().find(p => p.isHost);
    return h ? h.peerId : null;
  },

  // ── Öffentliche API ──────────────────────────────────────────────────
  on(type, handler) {
    (this._handlers[type] || (this._handlers[type] = [])).push(handler);
  },
  off(type, handler) {
    const list = this._handlers[type];
    if (!list) return;
    const i = list.indexOf(handler);
    if (i !== -1) list.splice(i, 1);
  },
  onPresence(handler) { this._presenceHandlers.push(handler); },

  // Aktuelle Mitspieler-Liste aus der Presence (ohne sich selbst).
  peers() {
    if (!this._channel) return [];
    const state = this._channel.presenceState();
    const out = [];
    for (const key in state) {
      if (key === this.peerId) continue;
      const meta = state[key][0];
      out.push({
        peerId: key, name: (meta && meta.name) || 'Spieler',
        isHost: !!(meta && meta.isHost), userId: (meta && meta.userId) || null,
      });
    }
    return out;
  },

  // Sitzung als Host eröffnen. `name` ist der Anzeigename des Hosts (für die
  // eigene Presence-Zeile, z.B. bei einem Reconnect nützlich). Ruft
  // `onReady(code)` nach erfolgreichem Subscribe.
  host(name, onReady) {
    this.leave();
    this.isHost = true;
    this.code = randomCode();
    this.displayName = name || 'Spieler';
    this._join(SESSION_PREFIX + this.code, () => onReady && onReady(this.code));
    return this.code;
  },

  // Sitzung per Code beitreten. Ein Realtime-Channel lässt sich für JEDEN Namen abonnieren —
  // „verbunden" heißt also nicht, dass dort jemand hostet. Der Beitritt gilt erst, wenn ein
  // Host in der Presence auftaucht; kommt binnen 6 s keiner, schlägt er fehl ('NO_HOST').
  join(code, name, onReady, onError) {
    this.leave();
    this.isHost = false;
    this.code = String(code || '').toUpperCase();
    this.displayName = name || 'Spieler';
    let done = false;
    const finish = (ok, why) => {
      if (done) return;
      done = true;
      clearTimeout(this._joinTimer); this._joinTimer = null; this._joinCheck = null;
      if (ok) { this._hostSeen = true; onReady && onReady(this.code); }
      else { this.leave(); onError && onError(why); }
    };
    this._joinCheck = () => { if (this.hostPeerId()) finish(true); };
    this._joinTimer = setTimeout(() => finish(false, 'NO_HOST'), 6000);
    this._join(SESSION_PREFIX + this.code, () => this._joinCheck && this._joinCheck(), (why) => finish(false, why));
  },

  _join(topic, onSubscribed, onError) {
    this.peerId = localPeerId();
    const ch = Auth.client.channel(topic, { config: { presence: { key: this.peerId } } });
    this._channel = ch;
    this.state = this.isHost ? 'hosting' : 'guest';

    ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
      if (!payload || payload.from === this.peerId) return; // eigene Echos ignorieren
      const list = this._handlers[payload.type];
      if (list) list.slice().forEach(h => h(payload.payload, payload.from));
    });
    ch.on('presence', { event: 'sync' }, () => {
      if (this._channel !== ch) return; // alter Channel nach leave()
      const p = this.peers();
      if (this._joinCheck) this._joinCheck();
      // Gast: der Host ist aus der Presence verschwunden (App geschlossen, Verbindung weg).
      // Erst nach 5 s melden: ein kurzer Aussetzer des Hosts soll die Gäste nicht hinauswerfen.
      if (!this.isHost && this._hostSeen) {
        const hostThere = p.some(x => x.isHost);
        if (hostThere) { clearTimeout(this._hostGoneTimer); this._hostGoneTimer = null; }
        else if (!this._hostGoneTimer) {
          this._hostGoneTimer = setTimeout(() => {
            this._hostGoneTimer = null;
            if (this._channel !== ch || this.hostPeerId()) return;
            this._hostSeen = false;
            this._emit('host_left', {}, null);
          }, 5000);
        }
      }
      this._presenceHandlers.slice().forEach(h => h(p));
    });

    let ready = false;
    ch.subscribe((status) => {
      if (this._channel !== ch) return;
      if (status === 'SUBSCRIBED') {
        ch.track({ name: this.displayName, isHost: this.isHost, userId: (window.Auth && Auth.userId) || null });
        // Nach einem Reconnect meldet sich der Channel erneut: Presence neu setzen, aber
        // die Start-Rückrufe nur beim ersten Mal auslösen.
        if (!ready) { ready = true; onSubscribed && onSubscribed(); }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (!ready) onError && onError(status);
      }
    });
  },

  // Nachricht an alle anderen Teilnehmer der Sitzung (nie an sich selbst,
  // s. `from === this.peerId`-Filter in `_join`).
  send(type, payload) {
    if (!this._channel) return;
    this._channel.send({ type: 'broadcast', event: 'msg', payload: { type, payload, from: this.peerId } });
  },

  leave() {
    clearTimeout(this._joinTimer); this._joinTimer = null; this._joinCheck = null;
    clearTimeout(this._hostGoneTimer); this._hostGoneTimer = null;
    this._hostSeen = false;
    if (this._channel) {
      const ch = this._channel;
      this.send('bye', {});
      // untrack() muss den Server WIRKLICH erreicht haben, bevor der Channel
      // fällt — sonst bekommen die anderen Teilnehmer den Presence-„leave"
      // nicht zuverlässig zugestellt (in Tests blieb der Peer sonst online,
      // bis die Verbindung selbst irgendwann als tot erkannt wurde). untrack()
      // gibt dafür ein Promise zurück, das wir abwarten.
      ch.untrack().finally(() => Auth.client.removeChannel(ch));
    }
    this._channel = null;
    this.state = 'idle';
    this.isHost = false;
    this.code = null;
  },

  // ── Einladungen (nur für angemeldete Freunde, s. isOnlineAllowed()) ────
  // Jeder angemeldete Client hält permanent seinen eigenen Einladungs-Channel
  // offen. Läuft unabhängig von einer laufenden Session (eigener Channel,
  // eigener Presence-Key entfällt hier — reiner Broadcast-Posteingang).
  _inboxChannel: null,
  listenForInvites(userId, onInvite) {
    this.stopListeningForInvites();
    if (!userId) return;
    const ch = Auth.client.channel(USER_PREFIX + userId);
    ch.on('broadcast', { event: 'invite' }, ({ payload }) => onInvite && onInvite(payload));
    ch.subscribe();
    this._inboxChannel = ch;
  },
  stopListeningForInvites() {
    if (this._inboxChannel) Auth.client.removeChannel(this._inboxChannel);
    this._inboxChannel = null;
  },

  // Einladung an einen Freund senden. Der Zielkanal wird kurz geöffnet, die
  // Nachricht gesendet, danach wieder geschlossen — der Empfänger muss dafür
  // nicht online sein, verpasst die Einladung dann aber (kein Postfach ohne
  // eigene Tabelle; siehe ROADMAP für einen späteren, dauerhaften Ausbau).
  sendInvite(toUserId, fromName) {
    const ch = Auth.client.channel(USER_PREFIX + toUserId);
    ch.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      ch.send({ type: 'broadcast', event: 'invite', payload: { code: this.code, fromName, fromUserId: (window.Auth && Auth.userId) || null } });
      setTimeout(() => Auth.client.removeChannel(ch), 1500);
    });
  },
};
