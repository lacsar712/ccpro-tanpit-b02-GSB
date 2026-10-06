import { LitElement, css, html } from "lit";

const TOKEN_KEY = "tanpit_token";
const LABELS = { fill: "注液", tanning: "鞣制中", drained: "已放液" };
const ROLE_LABELS = { admin: "管理员", worker: "操作工" };

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "请求失败");
  return data;
}

class TanYard extends LitElement {
  static properties = {
    ready: { type: Boolean },
    board: { type: Object },
    picked: { type: Object },
    ph: { type: String },
    err: { type: String },
    username: { type: String },
    password: { type: String },
    view: { type: String },
    me: { type: Object },
    gates: { type: Array },
    gateErr: { type: String },
  };

  static styles = css`
    :host { display: block; font-family: "KaiTi", serif; color: #2b2118; }
    .topbar {
      display: flex; align-items: center; gap: 18px;
      background: #3a2c1e; color: #f3e9d7; padding: 10px 18px;
    }
    .topbar .brand { font-size: 1.15em; font-weight: bold; }
    .topbar nav { display: flex; gap: 6px; }
    .topbar nav a {
      color: #d8c7a8; text-decoration: none; padding: 6px 12px;
      border-radius: 6px; cursor: pointer;
    }
    .topbar nav a.on { background: #6b5335; color: #fff; }
    .topbar .who { margin-left: auto; font-size: 0.92em; }
    .topbar .who a { color: #d8c7a8; cursor: pointer; margin-left: 10px; }
    .wrap { max-width: 880px; margin: 0 auto; padding: 28px 16px 50px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .pit { min-height: 110px; border-radius: 8px; color: #fff; cursor: pointer; border: 0; }
    .fill { background: #6d8f9e; }
    .tanning { background: #8a5a2b; }
    .drained { background: #5f6f4a; }
    .drawer {
      position: fixed; top: 0; right: 0; height: 100vh; width: 300px;
      background: #f7f1e6; box-shadow: -3px 0 10px rgba(0, 0, 0, 0.25);
      padding: 22px 18px; overflow-y: auto;
    }
    .drawer .close { float: right; cursor: pointer; border: 0; background: none; }
    .gate {
      display: flex; align-items: center; gap: 14px;
      border: 1px solid #cbb892; border-radius: 8px;
      padding: 14px 16px; margin: 10px 0; background: #fbf7ee;
    }
    .gate .state-on { color: #2f6b2f; font-weight: bold; }
    .gate .state-off { color: #8a6d3b; }
    .err { color: #9b1c1c; }
    .hint { color: #6b5a48; font-size: 0.92em; }
    label { display: block; margin: 8px 0; }
    input, button { font: inherit; padding: 8px 10px; margin: 4px 6px 4px 0; }
  `;

  constructor() {
    super();
    this.ready = Boolean(localStorage.getItem(TOKEN_KEY));
    this.board = null;
    this.picked = null;
    this.ph = "4.2";
    this.err = "";
    this.username = "admin";
    this.password = "123456";
    this.view = "board";
    this.me = null;
    this.gates = [];
    this.gateErr = "";
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.ready) this.bootstrap();
  }

  get isAdmin() {
    return this.me?.role === "admin";
  }

  get oneDecimalOn() {
    return this.gates.some((g) => g.key === "ph_one_decimal" && g.enabled);
  }

  async bootstrap() {
    try {
      this.me = await api("/api/auth/me");
      await Promise.all([this.refresh(), this.loadGates()]);
    } catch (e) {
      this.err = e.message;
    }
  }

  async refresh() {
    try {
      this.board = await api("/api/board");
      if (this.picked) {
        this.picked = this.board.pits.find((p) => p.id === this.picked.id) || this.board.pits[0];
      }
    } catch (e) {
      this.err = e.message;
    }
  }

  async loadGates() {
    try {
      this.gates = (await api("/api/gates")).gates;
      this.gateErr = "";
    } catch (e) {
      this.gateErr = e.message;
    }
  }

  async login(e) {
    e.preventDefault();
    this.err = "";
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: this.username, password: this.password }),
      });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      this.me = data.user;
      this.ready = true;
      await Promise.all([this.refresh(), this.loadGates()]);
    } catch (ex) {
      this.err = ex.message;
    }
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    this.ready = false;
    this.board = null;
    this.picked = null;
    this.me = null;
    this.view = "board";
  }

  go(view) {
    this.view = view;
    this.err = "";
    if (view === "gates") this.loadGates();
  }

  async toggleGate(gate) {
    this.gateErr = "";
    try {
      await api(`/api/gates/${gate.key}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !gate.enabled }),
      });
      await this.loadGates();
    } catch (ex) {
      this.gateErr = ex.message;
    }
  }

  async writePh() {
    this.err = "";
    try {
      // 按写入原样上送字符串，小数位规矩由后端按写入形式判定
      this.picked = await api(`/api/pits/${this.picked.id}/samples`, {
        method: "POST",
        body: JSON.stringify({ ph: this.ph }),
      });
      await this.refresh();
    } catch (ex) {
      this.err = ex.message;
    }
  }

  async setStatus(status) {
    this.err = "";
    try {
      this.picked = await api(`/api/pits/${this.picked.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await this.refresh();
    } catch (ex) {
      this.err = ex.message;
    }
  }

  renderTopbar() {
    return html`<header class="topbar">
      <span class="brand">南冈鞣场</span>
      <nav>
        <a class=${this.view === "board" ? "on" : ""} @click=${() => this.go("board")}>坑位场地图</a>
        <a class=${this.view === "gates" ? "on" : ""} @click=${() => this.go("gates")}>小数位</a>
      </nav>
      <span class="who">
        ${this.me ? `${this.me.username} · ${ROLE_LABELS[this.me.role] || this.me.role}` : ""}
        <a @click=${this.logout}>退出</a>
      </span>
    </header>`;
  }

  renderBoard() {
    if (!this.board) return html`<div class="wrap">${this.err || "装载坑位…"}</div>`;
    return html`<div class="wrap">
      <h1>${this.board.yard}</h1>
      <p>${this.board.village} · 点坑登记浸液酸碱度；放液须最近读数 3.5～5.0</p>
      <div class="grid">
        ${this.board.pits.map(
          (p) => html`<button class="pit ${p.status}" @click=${() => (this.picked = p)}>
            <strong>${p.code}</strong><br />${LABELS[p.status]}
          </button>`
        )}
      </div>
      ${this.picked ? this.renderDrawer() : ""}
      ${this.err && !this.picked ? html`<p class="err">${this.err}</p>` : ""}
    </div>`;
  }

  renderDrawer() {
    return html`<section class="drawer">
      <button class="close" @click=${() => (this.picked = null)}>✕</button>
      <h3>${this.picked.code} · ${LABELS[this.picked.status]}</h3>
      <p>最近酸碱度：${this.picked.latestPh ?? "无"} · ${this.picked.sampleCount} 次</p>
      ${this.oneDecimalOn
        ? html`<p class="hint">小数位闸门已开：酸碱度须恰好一位小数（如 4.2），整数或两位及以上整笔拒绝。</p>`
        : ""}
      <input .value=${this.ph} @input=${(e) => (this.ph = e.target.value)} />
      <button @click=${this.writePh}>登记酸碱度</button>
      <div>
        <button @click=${() => this.setStatus("fill")}>注液</button>
        <button @click=${() => this.setStatus("tanning")}>鞣制中</button>
        <button @click=${() => this.setStatus("drained")}>已放液</button>
      </div>
      ${this.err ? html`<p class="err">${this.err}</p>` : ""}
    </section>`;
  }

  renderGates() {
    return html`<div class="wrap">
      <h1>小数位</h1>
      <p class="hint">
        闸门开关列于此页。${this.isAdmin ? "管理员可开可关。" : "操作工只许浏览开关，不得改动。"}
      </p>
      ${this.gates.map(
        (g) => html`<div class="gate">
          <strong>${g.label}</strong>
          <span class=${g.enabled ? "state-on" : "state-off"}>
            ${g.enabled ? "已打开" : "已关闭"}
          </span>
          ${this.isAdmin
            ? html`<button @click=${() => this.toggleGate(g)}>${g.enabled ? "关闭" : "打开"}</button>`
            : html`<span class="hint">只读</span>`}
        </div>`
      )}
      ${this.gateErr ? html`<p class="err">${this.gateErr}</p>` : ""}
    </div>`;
  }

  render() {
    if (!this.ready) {
      return html`<div class="wrap">
        <h1>南冈鞣场</h1>
        <form @submit=${this.login} autocomplete="off">
          <label>用户名
            <input name="username" autocomplete="off" .value=${this.username} @input=${(e) => (this.username = e.target.value)} />
          </label>
          <label>密码
            <input name="password" type="password" autocomplete="off" .value=${this.password} @input=${(e) => (this.password = e.target.value)} />
          </label>
          <p class="hint">已预填 admin / 123456，另有 worker / 123456</p>
          <button>登录</button>
        </form>
        ${this.err ? html`<p class="err">${this.err}</p>` : ""}
      </div>`;
    }
    return html`
      ${this.renderTopbar()}
      ${this.view === "gates" ? this.renderGates() : this.renderBoard()}
    `;
  }
}

customElements.define("tan-yard", TanYard);
