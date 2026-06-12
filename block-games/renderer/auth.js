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
  async init() {
    client.auth.onAuthStateChange(async (_event, session) => {
      this.user = session?.user || null;
      await this._loadProfile();
      this._notify();
    });

    const { data } = await client.auth.getSession();
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
  }
};
