import { LitElement, css, html } from "lit";

const TOKEN_KEY = "tanpit_token";
const USER_KEY = "tanpit_user";
const LABELS = { fill: "注液", tanning: "鞣制中", drained: "已放液" };

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data.detail;
    let msg;
    if (typeof d === "string") msg = d;
    else if (Array.isArray(d) && d.length) msg = d.map((x) => x.msg).join("；");
    else msg = "请求失败";
    throw new Error(msg);
  }
  return data;
}

class TanYard extends LitElement {
  static properties = {
    ready: { type: Boolean },
    view: { type: String },
    board: { type: Object },
    picked: { type: Object },
    ph: { type: String },
    err: { type: String },
    username: { type: String },
    password: { type: String },
    user: { type: Object },
    setting: { type: Object },
    settingErr: { type: String },
  };

  static styles = css`
    :host { display: block; font-family: "KaiTi", serif; color: #2b2118; }
    .wrap { max-width: 880px; margin: 0 auto; padding: 28px 16px 50px; }
    .topbar { display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #8a5a2b; padding-bottom: 10px; margin-bottom: 18px; }
    .topbar .brand { font-size: 1.3em; font-weight: bold; margin-right: auto; }
    .navbtn { padding: 6px 14px; border: 1px solid #8a5a2b; background: #f4ece1; cursor: pointer; border-radius: 4px; }
    .navbtn.active { background: #8a5a2b; color: #fff; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .pit { min-height: 110px; border-radius: 8px; color: #fff; cursor: pointer; border: 0; }
    .fill { background: #6d8f9e; }
    .tanning { background: #8a5a2b; }
    .drained { background: #5f6f4a; }
    .err { color: #9b1c1c; }
    .hint { color: #6b5a48; font-size: 0.92em; }
    .gate-on { color: #9b1c1c; font-weight: bold; }
    label { display: block; margin: 8px 0; }
    input, button { font: inherit; padding: 8px 10px; margin: 4px 6px 4px 0; }
    .switch-row { display: flex; align-items: center; gap: 12px; border: 1px solid #d8c7b2; border-radius: 8px; padding: 16px; background: #faf5ee; }
    .switch-row input { width: 20px; height: 20px; margin: 0; }
    .badge { padding: 2px 10px; border-radius: 12px; font-size: 0.9em; }
    .badge.on { background: #9b1c1c; color: #fff; }
    .badge.off { background: #cfc4b4; color: #3a2f24; }
  `;

  constructor() {
    super();
    this.ready = Boolean(localStorage.getItem(TOKEN_KEY));
    this.view = "board";
    this.board = null;
    this.picked = null;
    this.ph = "4.2";
    this.err = "";
    this.username = "admin";
    this.password = "123456";
    this.user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    this.setting = null;
    this.settingErr = "";
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.ready) this.start();
  }

  get isAdmin() {
    return this.user?.role === "admin";
  }

  async start() {
    try {
      this.user = await api("/api/auth/me");
      localStorage.setItem(USER_KEY, JSON.stringify(this.user));
      await this.refresh();
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

  async login(e) {
    e.preventDefault();
    this.err = "";
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: this.username, password: this.password }),
      });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      this.user = data.user;
      this.ready = true;
      this.view = "board";
      await this.refresh();
    } catch (ex) {
      this.err = ex.message;
    }
  }

  // 抽屉登记：原文直送服务端，由闸门在写库前裁决；界面成败与落库完全一致
  async writePh() {
    this.err = "";
    try {
      this.picked = await api(`/api/pits/${this.picked.id}/samples`, {
        method: "POST",
        body: JSON.stringify({ ph: this.ph }),
      });
      await this.refresh();
    } catch (ex) {
      await this.refresh();
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

  async openDecimal() {
    this.view = "decimal";
    this.settingErr = "";
    try {
      this.setting = await api("/api/settings/decimal");
    } catch (e) {
      this.settingErr = e.message;
    }
  }

  async toggleGate(e) {
    const on = e.target.checked;
    this.settingErr = "";
    try {
      this.setting = await api("/api/settings/decimal", {
        method: "PUT",
        body: JSON.stringify({ ph_one_decimal: on }),
      });
      // 同步场地图顶栏/抽屉所依据的闸门状态
      await this.refresh();
    } catch (ex) {
      // 失败时回滚勾选并提示，开关状态以服务端为准
      this.setting = await api("/api/settings/decimal");
      this.settingErr = ex.message;
    }
  }

  renderLogin() {
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

  renderTopbar() {
    return html`<nav class="topbar">
      <span class="brand">南冈鞣场</span>
      <button class="navbtn ${this.view === "board" ? "active" : ""}" @click=${() => (this.view = "board")}>坑位场地图</button>
      <button class="navbtn ${this.view === "decimal" ? "active" : ""}" @click=${() => this.openDecimal()}>小数位</button>
      <span class="hint">${this.user?.username} · ${this.isAdmin ? "管理员" : "操作工"}</span>
    </nav>`;
  }

  renderBoard() {
    if (!this.board) return html`${this.err || "装载坑位…"}`;
    return html`
      <p>${this.board.village} · 点坑登记浸液酸碱度；放液须最近读数 3.5～5.0</p>
      ${this.board.phOneDecimal
        ? html`<p class="gate-on">小数位闸门已开：登记酸碱度小数点后必须恰好一位（例如 4.2），整数或两位及以上整笔拒收。</p>`
        : html`<p class="hint">小数位闸门关闭：酸碱度按原规则登记。</p>`}
      <div class="grid">
        ${this.board.pits.map(
          (p) => html`<button class="pit ${p.status}" @click=${() => (this.picked = p)}>
            <strong>${p.code}</strong><br />${LABELS[p.status]}
          </button>`
        )}
      </div>
      ${this.picked
        ? html`<section>
            <h3>${this.picked.code} · ${LABELS[this.picked.status]}</h3>
            <p>最近酸碱度：${this.picked.latestPh ?? "无"} · ${this.picked.sampleCount} 次</p>
            <input .value=${this.ph} @input=${(e) => (this.ph = e.target.value)} />
            <button @click=${this.writePh}>登记酸碱度</button>
            <div>
              <button @click=${() => this.setStatus("fill")}>注液</button>
              <button @click=${() => this.setStatus("tanning")}>鞣制中</button>
              <button @click=${() => this.setStatus("drained")}>已放液</button>
            </div>
          </section>`
        : ""}
      ${this.err ? html`<p class="err">${this.err}</p>` : ""}
    `;
  }

  renderDecimal() {
    if (!this.setting) return html`${this.settingErr || "装载闸门…"}`;
    const on = this.setting.ph_one_decimal;
    return html`
      <h2>小数位</h2>
      <p class="hint">此处列出各道小数位闸门。${this.isAdmin ? "管理员可开可关。" : "操作工只许浏览，不得改动。"}</p>
      <div class="switch-row">
        <input
          type="checkbox"
          .checked=${on}
          ?disabled=${!this.isAdmin}
          @change=${(e) => this.toggleGate(e)}
        />
        <div>
          <strong>酸碱度必须一位小数</strong>
          <div class="hint">开启后，新登记的酸碱度小数点后必须恰好一位（如 4.2）；整数、两位及以上小数整笔拒绝，不入库。关闭后恢复原规则。</div>
        </div>
        <span class="badge ${on ? "on" : "off"}">${on ? "已开启" : "已关闭"}</span>
      </div>
      ${!this.isAdmin ? html`<p class="hint">当前为操作工身份，开关仅展示。</p>` : ""}
      ${this.settingErr ? html`<p class="err">${this.settingErr}</p>` : ""}
    `;
  }

  render() {
    if (!this.ready) return this.renderLogin();
    return html`<div class="wrap">
      ${this.renderTopbar()}
      ${this.view === "decimal" ? this.renderDecimal() : this.renderBoard()}
    </div>`;
  }
}

customElements.define("tan-yard", TanYard);
