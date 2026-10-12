// ============================================
// API CLIENT — fetch ke Google Apps Script
// ============================================
const API = {
  token: localStorage.getItem('artha_token') || '',
  user: (function () { try { return JSON.parse(localStorage.getItem('artha_user') || 'null'); } catch (e) { return null; } })(),

  configured() {
    const u = (window.APP_CONFIG || {}).GAS_URL || '';
    return /^https:\/\/script\.google\.com\/.+\/exec/.test(u);
  },

  setSession(token, user) {
    this.token = token; this.user = user;
    localStorage.setItem('artha_token', token);
    localStorage.setItem('artha_user', JSON.stringify(user));
  },
  clear() {
    this.token = ''; this.user = null;
    localStorage.removeItem('artha_token'); localStorage.removeItem('artha_user');
  },

  async _fetch(url, opts) {
    if (!this.configured()) {
      return { success: false, message: 'URL backend belum diisi. Edit js/config.js lalu push ulang.' };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    try {
      const res = await fetch(url, Object.assign({ signal: ctrl.signal }, opts));
      const text = await res.text();
      try { return JSON.parse(text); }
      catch (e) { return { success: false, message: 'Respons server tidak valid. Pastikan Web App di-deploy: Execute as Me, akses Anyone.' }; }
    } catch (err) {
      const msg = err.name === 'AbortError' ? 'Server terlalu lama merespons. Coba lagi.' : 'Tidak dapat terhubung ke server. Periksa koneksi internet.';
      return { success: false, message: msg };
    } finally { clearTimeout(timer); }
  },

  // GET publik (tanpa login)
  get(action, params) {
    const q = new URLSearchParams(Object.assign({ action }, params || {})).toString();
    return this._fetch(window.APP_CONFIG.GAS_URL + '?' + q);
  },

  // POST (token di body). Wajib text/plain agar tidak memicu CORS preflight.
  async post(action, data) {
    const r = await this._fetch(window.APP_CONFIG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, token: this.token, data: data || {} })
    });
    if (r && r.code === 'AUTH') {
      this.clear();
      window.dispatchEvent(new CustomEvent('auth-expired'));
    }
    return r;
  }
};
