// Block Games — Auth gegen das Supabase-Backend der Block-Drop Arcade Website.
// Der Flow ist 1:1 von app/auth.js der Website übernommen, damit bestehende
// Website-Konten hier genauso funktionieren:
//   · Accounts haben eine synthetische Auth-Mail <username>@blockdrop.local
//   · Eine echte Mail ist optional und liegt nur in user_metadata.contact_email
//   · Login: direkter Versuch → synthetische Mail → RPC resolve_login_email
'use strict';

const SUPABASE_URL = 'https://yjyvqidjqksvagyxrwyf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9J1vJchMV6Ym-1btnintAw_zih4pdea';
const SYNTH_DOMAIN = 'blockdrop.local';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const syntheticEmail = (username) =>
  `${String(username || '').trim().toLowerCase()}@${SYNTH_DOMAIN}`;

const looksLikeEmail = (s) => /@/.test(String(s || ''));

const Auth = {
  user: null,
  profile: null,
  _listeners: [],

  // Beim App-Start aufrufen. Lädt eine evtl. gespeicherte Session
  // (localStorage) und meldet jede Auth-Änderung an die UI.
  //
  // getSession() kann bei abgelaufener Session einen Netz-Refresh auslösen —
  // ohne Internet/Supabase-Erreichbarkeit hängt der Promise dann auf ewig,
  // und boot() (app.js) kommt nie am Login-Screen an (bleibt im Lade-Screen
  // stecken). Deshalb hier dieselbe Absicherung wie beim Update-Check
  // (main.js → UPDATE_CHECK_TIMEOUT_MS): nach 8s ohne Antwort einfach als
  // "keine Session" werten, der Spieler landet dann normal am Login.
  async init() {
    client.auth.onAuthStateChange(async (_event, session) => {
      this.user = session?.user || null;
      await this._loadProfile();
      this._notify();
    });

    const timeout = new Promise(resolve => setTimeout(() => resolve({ data: { session: null } }), 8000));
    let data;
    try {
      ({ data } = await Promise.race([client.auth.getSession(), timeout]));
    } catch {
      data = { session: null };
    }
    this.user = data.session?.user || null;
    await this._loadProfile();
    return this.user;
  },

  onChange(fn) { this._listeners.push(fn); },

  _notify() { this._listeners.forEach(fn => fn(this)); },

  async _loadProfile() {
    if (!this.user) { this.profile = null; return; }
    const { data } = await client
      .from('profiles').select('*').eq('id', this.user.id).maybeSingle();
    this.profile = data || null;
  },

  get username() {
    return this.profile?.username
      || this.user?.user_metadata?.username
      || 'Spieler';
  },

  // Eigene User-ID (für Freundes-Abfragen).
  get userId() { return this.user?.id || null; },

  // Roher Supabase-Client — für Online-Sessions (renderer/net/session.js),
  // die Realtime-Channels über dieselbe Verbindung/Auth öffnen (RLS-taugliche
  // private Channels via realtime.setAuth(), das supabase-js intern schon bei
  // jedem Auth-Change nachzieht). Absichtlich read-only nach außen gereicht.
  get client() { return client; },

  // Optionale Kontakt-E-Mail (liegt nur in user_metadata, nie als Auth-Mail).
  // Synthetische `@blockdrop.local`-Adressen werden bewusst nicht angezeigt.
  get contactEmail() {
    const m = this.user?.user_metadata?.contact_email;
    return (m && looksLikeEmail(m) && !String(m).endsWith('@' + SYNTH_DOMAIN)) ? m : '';
  },

  // Registrierung. `email` ist optional — fehlt sie, läuft der Account allein
  // über den Username (synthetische Auth-Mail).
  async signUp(email, password, username) {
    const uname = (username || '').trim();
    const contact = (email || '').trim();
    const authEmail = syntheticEmail(uname);

    const { data, error } = await client.auth.signUp({
      email: authEmail,
      password,
      options: { data: { username: uname, contact_email: contact || null } }
    });
    if (error) {
      // Synthetische Mail kollidiert → Username (case-insensitiv) schon vergeben.
      const m = (error.message || '').toLowerCase();
      if (m.includes('already registered') || m.includes('already exists') || m.includes('user already')) {
        return { error: { message: 'Username schon vergeben' } };
      }
      return { error };
    }
    if (!data.user) return { error: { message: 'Registrierung fehlgeschlagen' } };

    // Sicherstellen dass wir wirklich eingeloggt sind — sonst blockiert RLS den Profile-Insert.
    if (!data.session) {
      const { error: signInErr } = await client.auth.signInWithPassword({ email: authEmail, password });
      if (signInErr) return { error: signInErr };
    }

    // Profil anlegen (RLS erlaubt insert nur für auth.uid() === id).
    // Existiert es schon (23505), war der Account bereits über die Website registriert.
    const { error: pErr } = await client.from('profiles').insert({
      id: data.user.id,
      username: uname
    });
    if (pErr) {
      if (pErr.code === '23505') return { error: { message: 'Username schon vergeben' } };
      return { error: pErr };
    }

    this.user = data.user;
    await this._loadProfile();
    this._notify();
    return { data };
  },

  // Login per E-Mail ODER Username — gleiche Kaskade wie auf der Website.
  async signIn(identifier, password) {
    const id = (identifier || '').trim();
    let directErr = null;

    if (looksLikeEmail(id)) {
      const r = await client.auth.signInWithPassword({ email: id, password });
      if (!r.error) return r;
      directErr = r.error;
    } else {
      const r = await client.auth.signInWithPassword({ email: syntheticEmail(id), password });
      if (!r.error) return r;
      directErr = r.error;
    }

    const { data: resolved, error: rpcErr } = await client.rpc('resolve_login_email', { identifier: id });
    if (!rpcErr && resolved) {
      return await client.auth.signInWithPassword({ email: resolved, password });
    }

    return { error: directErr || { message: 'E-Mail/Username oder Passwort falsch.' } };
  },

  async signOut() {
    await client.auth.signOut();
  },

  // ── Freunde ──────────────────────────────────────────────────────────
  // Spiegelt das Freundes-System der Website (Tabelle `public.friends`):
  // eine Zeile pro Beziehung mit requester_id/addressee_id und
  // status `pending`|`accepted`. RLS erlaubt nur Zeilen, an denen man
  // selbst beteiligt ist. Profilbilder bleiben außen vor (CSP lässt nur
  // lokale Bilder zu) — die UI nutzt wie das Menü den Anfangsbuchstaben.
  async getFriendOverview() {
    const empty = { friends: [], incoming: [], outgoing: [] };
    if (!this.user) return empty;
    const me = this.user.id;

    const { data: rows, error } = await client
      .from('friends')
      .select('id, requester_id, addressee_id, status, created_at')
      .or(`requester_id.eq.${me},addressee_id.eq.${me}`);
    if (error || !rows) return empty;

    // Usernamen der jeweils anderen Seite in einem Rutsch nachladen.
    const otherIds = [...new Set(
      rows.map(r => (r.requester_id === me ? r.addressee_id : r.requester_id))
    )];
    const names = {};
    if (otherIds.length) {
      const { data: profs } = await client
        .from('profiles').select('id, username').in('id', otherIds);
      (profs || []).forEach(p => { names[p.id] = p.username; });
    }

    const decorate = (r) => {
      const otherId = r.requester_id === me ? r.addressee_id : r.requester_id;
      return {
        rowId: r.id,
        userId: otherId,
        username: names[otherId] || 'Spieler',
        status: r.status,
      };
    };

    return {
      friends:  rows.filter(r => r.status === 'accepted').map(decorate),
      incoming: rows.filter(r => r.status === 'pending' && r.addressee_id === me).map(decorate),
      outgoing: rows.filter(r => r.status === 'pending' && r.requester_id === me).map(decorate),
    };
  },

  // Usernamen-Suche für „Freund hinzufügen" (sich selbst ausgeschlossen).
  async searchUsers(query) {
    const q = (query || '').trim();
    if (q.length < 2 || !this.user) return [];
    const { data } = await client
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${q}%`)
      .neq('id', this.user.id)
      .limit(8);
    return data || [];
  },

  async sendFriendRequest(addresseeId) {
    if (!this.user) return { error: { message: 'Nicht angemeldet.' } };
    const { error } = await client.from('friends').insert({
      requester_id: this.user.id,
      addressee_id: addresseeId,
      status: 'pending',
    });
    if (error && error.code === '23505') {
      return { error: { message: 'Anfrage besteht bereits.' } };
    }
    return { error };
  },

  async acceptFriendRequest(rowId) {
    const { error } = await client.from('friends')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', rowId);
    return { error };
  },

  // Dient zum Ablehnen einer Anfrage UND zum Entfernen eines Freundes
  // (beides ist dieselbe Zeile in `friends`).
  async removeFriend(rowId) {
    const { error } = await client.from('friends').delete().eq('id', rowId);
    return { error };
  },

  // ── Konto bearbeiten ─────────────────────────────────────────────────
  // Username = Login-Schlüssel: Wir aktualisieren `profiles.username`
  // (unique) UND ziehen für Accounts mit synthetischer Auth-Mail die
  // Login-Mail `<username>@blockdrop.local` nach, damit der Login mit dem
  // neuen Namen weiter funktioniert. Alt-Accounts mit echter Auth-Mail
  // behalten ihre Login-Mail.
  async updateUsername(newName) {
    if (!this.user) return { error: { message: 'Nicht angemeldet.' } };
    const uname = (newName || '').trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(uname)) {
      return { error: { message: 'Username: 3–20 Zeichen, nur Buchstaben, Zahlen und _' } };
    }
    if (uname === this.username) return {}; // nichts zu tun

    const { error: pErr } = await client
      .from('profiles').update({ username: uname }).eq('id', this.user.id);
    if (pErr) {
      if (pErr.code === '23505') return { error: { message: 'Username schon vergeben' } };
      return { error: pErr };
    }

    const updates = { data: { ...this.user.user_metadata, username: uname } };
    if ((this.user.email || '').endsWith('@' + SYNTH_DOMAIN)) {
      updates.email = syntheticEmail(uname);
    }
    const { error: aErr } = await client.auth.updateUser(updates);
    if (aErr) return { error: aErr };

    await this._loadProfile();
    this._notify();
    return {};
  },

  // Optionale Kontakt-E-Mail (nur user_metadata, nie die Auth-Mail).
  async updateContactEmail(email) {
    if (!this.user) return { error: { message: 'Nicht angemeldet.' } };
    const contact = (email || '').trim();
    if (contact && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) {
      return { error: { message: 'Bitte eine gültige E-Mail eingeben.' } };
    }
    const { error } = await client.auth.updateUser({
      data: { ...this.user.user_metadata, contact_email: contact || null }
    });
    if (!error) this._notify();
    return { error };
  },

  async updatePassword(newPw) {
    if (!this.user) return { error: { message: 'Nicht angemeldet.' } };
    if ((newPw || '').length < 6) {
      return { error: { message: 'Passwort: mindestens 6 Zeichen.' } };
    }
    const { error } = await client.auth.updateUser({ password: newPw });
    return { error };
  }
};
