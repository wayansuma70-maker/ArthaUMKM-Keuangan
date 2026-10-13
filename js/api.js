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

  async _fetch(url, opts, ms) {
    if (!this.configured()) {
      return { success: false, kind: 'config', message: 'URL backend belum diisi. Edit js/config.js lalu push ulang.' };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms || 45000);
    try {
      const res = await fetch(url, Object.assign({ signal: ctrl.signal }, opts));
      const text = await res.text();
      try { return JSON.parse(text); }
      catch (e) {
        const t = text.slice(0, 3000).toLowerCase();
        let msg = 'Respons server tidak valid. Pastikan Web App di-deploy: Execute as Me, akses Anyone.';
        if (res.status === 404) msg = 'Alamat backend tidak ditemukan (404). Periksa GAS_URL di js/config.js.';
        else if (res.status === 401 || res.status === 403 || /accounts\.google|sign in|masuk|authoriz|otorisasi/.test(t))
          msg = 'Backend meminta login/otorisasi Google. Deploy ulang Web App: Execute as Me, Who has access: Anyone, lalu izinkan akses.';
        else if (/script function not found|tidak ditemukan/.test(t))
          msg = 'Fungsi doGet/doPost tidak ditemukan. Pastikan Kode.gs tersimpan penuh lalu deploy versi baru.';
        return { success: false, kind: 'server', message: msg };
      }
    } catch (err) {
      const aborted = err.name === 'AbortError';
      return { success: false, kind: aborted ? 'timeout' : 'network',
        message: aborted ? 'Server terlalu lama merespons. Panggilan pertama setelah lama tidak dipakai bisa lambat. Coba lagi.'
                         : 'Tidak dapat terhubung ke backend. Periksa internet, URL /exec di js/config.js, dan pengaturan akses Web App (Anyone).' };
    } finally { clearTimeout(timer); }
  },

  // GET publik (tanpa login)
  get(action, params, ms) {
    const q = new URLSearchParams(Object.assign({ action }, params || {})).toString();
    return this._fetch(window.APP_CONFIG.GAS_URL + '?' + q, undefined, ms);
  },

  // POST (token di body). Wajib text/plain agar tidak memicu CORS preflight.
  async post(action, data, ms) {
    const r = await this._fetch(window.APP_CONFIG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, token: this.token, data: data || {} })
    }, ms);
    if (r && r.code === 'AUTH') {
      this.clear();
      window.dispatchEvent(new CustomEvent('auth-expired'));
    }
    return r;
  }
};
