/* ═══════════════════════════════════════════════════════════════
   Orion OS — Shared Shell
   Injects: tokens CSS, starfield canvas, sidebar, topnav, theme toggle.
   Usage:
     <script src="_shell.js"></script>
     <script>OrionShell.init({ active: 'trends', title: 'Trends',
       subtitle: 'Discovered trends and their pipeline status.',
       iconPath: '...' })</script>
   Then place page content inside <main id="page-content">.
   ═══════════════════════════════════════════════════════════════ */

window.OrionShell = (function () {

  /* ── TOKEN + ANIMATION CSS ── */
  const STYLE = `
  :root,[data-theme="dark"]{
    --ui-bg:#070a12;--ui-bg-2:#0a0e1a;--ui-surface:#0f1626;
    --ui-panel:rgba(15,22,38,0.55);--ui-elevated:#161f33;
    --ui-hover:#1b2540;--ui-border:rgba(255,255,255,0.07);
    --ui-border-strong:rgba(255,255,255,0.12);--ui-hairline:rgba(255,255,255,0.04);
    --ui-fg1:#EDF1FA;--ui-fg2:#9AA3B5;--ui-fg3:#5F6A80;--ui-fg4:#3C4458;
    --ui-primary:#8B5CF6;--ui-primary-strong:#7C3AED;
    --ui-primary-soft:rgba(139,92,246,0.12);--ui-primary-text:#C4B5FD;
    --ui-cyan:#22D3EE;--ui-success:#34D399;--ui-warning:#FBBF24;--ui-danger:#F87171;
    --ui-chart-grid:rgba(255,255,255,0.05);
    --ui-nebula-a:rgba(168,85,247,0.22);--ui-nebula-b:rgba(34,211,238,0.16);--ui-nebula-c:rgba(139,92,246,0.12);
    --ui-shadow-card:inset 0 1px 0 rgba(255,255,255,0.08),0 12px 40px rgba(0,0,0,0.45),0 2px 8px rgba(0,0,0,0.25);
    --ui-shadow-primary:0 14px 32px -8px rgba(139,92,246,0.45);
  }
  [data-theme="light"]{
    --ui-bg:#F4F4F7;--ui-bg-2:#FFFFFFCC;--ui-surface:#FFFFFF;
    --ui-panel:rgba(255,255,255,0.72);--ui-elevated:#F8F8FB;
    --ui-hover:#EEEEF3;--ui-border:rgba(15,23,42,0.08);
    --ui-border-strong:rgba(15,23,42,0.14);--ui-hairline:rgba(15,23,42,0.05);
    --ui-fg1:#1A1C23;--ui-fg2:#555968;--ui-fg3:#868A97;--ui-fg4:#B5B8C2;
    --ui-primary:#6D28D9;--ui-primary-strong:#5B21B6;
    --ui-primary-soft:rgba(109,40,217,0.08);--ui-primary-text:#5B21B6;
    --ui-cyan:#0891B2;--ui-success:#059669;--ui-warning:#B45309;--ui-danger:#B91C1C;
    --ui-chart-grid:rgba(15,23,42,0.06);
    --ui-nebula-a:rgba(168,85,247,0.12);--ui-nebula-b:rgba(34,211,238,0.10);--ui-nebula-c:rgba(99,102,241,0.08);
    --ui-shadow-card:inset 0 1px 0 rgba(255,255,255,0.7),0 12px 40px rgba(15,23,42,0.08),0 2px 8px rgba(15,23,42,0.04);
    --ui-shadow-primary:0 14px 32px -8px rgba(109,40,217,0.35);
  }
  *,*::before,*::after{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{background:var(--ui-bg);color:var(--ui-fg1);
    font-family:"Geist",ui-sans-serif,system-ui,-apple-system,sans-serif;
    font-feature-settings:"cv11","ss01","ss03";
    min-height:100vh;position:relative;transition:background 0.3s,color 0.3s;}
  body::before{content:"";position:fixed;inset:-10%;z-index:0;pointer-events:none;
    background:radial-gradient(at 18% 20%,var(--ui-nebula-a) 0,transparent 55%),
      radial-gradient(at 85% 15%,var(--ui-nebula-b) 0,transparent 50%),
      radial-gradient(at 60% 90%,var(--ui-nebula-c) 0,transparent 50%);
    animation:nebula-drift 38s ease-in-out infinite alternate;will-change:transform;}
  @keyframes nebula-drift{0%{transform:translate(0,0) scale(1)}50%{transform:translate(2%,-1.5%) scale(1.04)}100%{transform:translate(-2%,1.5%) scale(1.02)}}
  body::after{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;
    background:linear-gradient(100deg,transparent 44%,rgba(167,139,250,0.05) 50%,transparent 56%);
    background-size:300% 100%;animation:sweep 14s linear infinite;mix-blend-mode:screen;}
  [data-theme="light"] body::after{mix-blend-mode:multiply;opacity:.6;}
  @keyframes sweep{0%{background-position:150% 0}100%{background-position:-150% 0}}
  #orion-starfield{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.9;transition:opacity .3s;}
  [data-theme="light"] #orion-starfield{opacity:.3;}
  .orion-app{position:relative;z-index:1;display:grid;grid-template-columns:260px 1fr;min-height:100vh;}
  /* Sidebar */
  .orion-sidebar{background:var(--ui-surface);border-right:1px solid var(--ui-border);
    display:flex;flex-direction:column;padding:24px 0 16px;
    position:sticky;top:0;height:100vh;transition:background .3s,border-color .3s;}
  .o-brand{display:flex;align-items:center;gap:12px;padding:0 24px 24px;border-bottom:1px solid var(--ui-border);}
  .o-brand-tile{width:40px;height:40px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 6px 16px rgba(167,139,250,0.28));}
  .o-brand-tile svg{width:40px;height:40px;}
  .o-brand-name{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:20px;letter-spacing:-0.02em;color:var(--ui-fg1);}
  .o-brand-tag{font-family:"Space Grotesk",sans-serif;font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:var(--ui-fg3);margin-top:2px;}
  .o-nav-label{font-family:"Space Grotesk",sans-serif;font-size:10px;font-weight:500;
    letter-spacing:.2em;text-transform:uppercase;color:var(--ui-fg3);padding:18px 24px 8px;}
  .o-nav-item{display:flex;align-items:center;gap:12px;padding:10px 24px;
    font-family:"Geist",sans-serif;font-size:13.5px;font-weight:500;color:var(--ui-fg2);
    cursor:pointer;border-left:2px solid transparent;transition:all .2s;text-decoration:none;}
  .o-nav-item:hover{background:var(--ui-hover);color:var(--ui-fg1);}
  .o-nav-item.active{background:var(--ui-primary-soft);color:var(--ui-primary-text);border-left-color:var(--ui-primary);}
  .o-nav-item svg{width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;}
  .o-nav-item .dot{margin-left:auto;width:6px;height:6px;border-radius:50%;background:var(--ui-warning);box-shadow:0 0 8px var(--ui-warning);}
  .o-sidebar-footer{margin-top:auto;padding:16px 24px;border-top:1px solid var(--ui-border);display:flex;align-items:center;gap:10px;}
  .o-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#22D3EE);
    display:flex;align-items:center;justify-content:center;color:#fff;
    font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:13px;}
  .o-user-name{font-size:13.5px;font-weight:500;color:var(--ui-fg1);font-family:"Geist",sans-serif;}
  .o-user-role{font-size:11.5px;color:var(--ui-fg3);}
  /* Topnav */
  .orion-topnav{position:sticky;top:0;z-index:10;height:64px;padding:0 32px;
    display:flex;align-items:center;gap:16px;
    background:var(--ui-bg-2);backdrop-filter:blur(24px) saturate(180%);
    border-bottom:1px solid var(--ui-border);transition:background .3s;}
  .o-search{display:flex;align-items:center;gap:10px;background:var(--ui-elevated);
    border:1px solid var(--ui-border);border-radius:9999px;padding:8px 16px;flex:0 1 340px;color:var(--ui-fg2);}
  .o-search input{background:transparent;border:none;outline:none;color:var(--ui-fg2);
    font-family:"Space Grotesk",sans-serif;font-size:10px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;flex:1;}
  .o-spacer{flex:1;}
  .o-icon-btn{width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;
    border-radius:9999px;background:var(--ui-elevated);color:var(--ui-fg2);
    border:1px solid var(--ui-border);position:relative;cursor:pointer;transition:all .2s;}
  .o-icon-btn:hover{background:var(--ui-hover);color:var(--ui-fg1);}
  .o-icon-btn svg{width:16px;height:16px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;}
  .o-badge-dot{position:absolute;top:7px;right:7px;width:8px;height:8px;border-radius:50%;
    background:var(--ui-danger);box-shadow:0 0 8px var(--ui-danger);}
  .o-live-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 8px;border-radius:9999px;
    background:rgba(16,185,129,0.10);color:var(--ui-success);
    font-family:"Space Grotesk",sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;
    border:1px solid rgba(16,185,129,0.18);}
  .o-live-chip .p{width:6px;height:6px;border-radius:50%;background:var(--ui-success);
    box-shadow:0 0 8px var(--ui-success);animation:pulse 2s ease-in-out infinite;}
  .o-btn-primary{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;
    font-family:"Geist",sans-serif;font-weight:500;font-size:13px;cursor:pointer;border:none;
    background:var(--ui-primary-strong);color:#fff;box-shadow:var(--ui-shadow-primary);transition:all .2s;}
  .o-btn-primary:hover{filter:brightness(1.08);transform:translateY(-1px);}
  .o-btn-primary svg,.o-btn-ghost svg{width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;}
  .o-btn-ghost{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;
    font-family:"Geist",sans-serif;font-weight:500;font-size:13px;cursor:pointer;border:none;
    background:transparent;color:var(--ui-fg2);transition:all .2s;}
  .o-btn-ghost:hover{background:var(--ui-hover);color:var(--ui-fg1);}
  /* Theme toggle */
  .o-theme-toggle{position:fixed;top:16px;right:20px;z-index:50;display:inline-flex;align-items:center;
    gap:6px;padding:4px;background:var(--ui-panel);backdrop-filter:blur(12px);
    border:1px solid var(--ui-border);border-radius:9999px;box-shadow:var(--ui-shadow-card);}
  .o-theme-toggle button{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;
    border-radius:9999px;border:none;cursor:pointer;background:transparent;color:var(--ui-fg2);
    font-family:"Space Grotesk",sans-serif;font-size:10px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;transition:all .2s;}
  .o-theme-toggle button.active{background:var(--ui-primary);color:#fff;box-shadow:0 4px 12px -2px rgba(124,58,237,0.4);}
  .o-theme-toggle svg{width:12px;height:12px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;}
  /* Main area */
  .orion-main{padding:36px 44px 64px;max-width:1500px;}
  .o-page-header{display:flex;align-items:center;gap:18px;margin-bottom:32px;}
  .o-page-header .tile{width:48px;height:48px;border-radius:12px;
    background:linear-gradient(135deg,rgba(124,58,237,0.28),rgba(6,182,212,0.28));
    border:1px solid rgba(167,139,250,0.35);display:flex;align-items:center;justify-content:center;
    color:var(--ui-primary-text);box-shadow:0 8px 24px -8px rgba(124,58,237,0.45),inset 0 1px 0 rgba(255,255,255,0.1);}
  .o-page-header .tile svg{width:24px;height:24px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;}
  .o-page-header h1{margin:0;font-family:"Space Grotesk",sans-serif;font-size:32px;font-weight:700;letter-spacing:-0.02em;color:var(--ui-fg1);}
  .o-page-header .subtitle{font-size:14px;color:var(--ui-fg2);margin-top:2px;}
  /* Card */
  .o-card{border-radius:12px;background:var(--ui-panel);backdrop-filter:blur(24px) saturate(180%);
    border:1px solid var(--ui-border);box-shadow:var(--ui-shadow-card);
    transition:background .3s,border-color .3s;position:relative;overflow:hidden;}
  .o-card-pad{padding:22px 24px;}
  /* Grid helpers */
  .o-grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
  .o-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
  .o-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .o-2col{display:grid;grid-template-columns:2fr 1fr;gap:16px;}
  /* Stat card */
  .o-stat-label{font-family:"Space Grotesk",sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ui-fg3);}
  .o-stat-value{font-family:"Space Grotesk",sans-serif;font-size:32px;font-weight:700;letter-spacing:-0.025em;color:var(--ui-fg1);margin-top:4px;font-variant-numeric:tabular-nums;}
  .o-stat-sub{font-size:12.5px;color:var(--ui-fg2);margin-top:6px;}
  /* Badge */
  .o-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:9999px;font-size:11.5px;font-weight:500;font-family:"Geist",sans-serif;}
  .o-badge-green{background:rgba(16,185,129,0.12);color:var(--ui-success);}
  .o-badge-amber{background:rgba(245,158,11,0.14);color:var(--ui-warning);}
  .o-badge-red{background:rgba(239,68,68,0.12);color:var(--ui-danger);}
  .o-badge-violet{background:var(--ui-primary-soft);color:var(--ui-primary-text);}
  .o-badge-blue{background:rgba(59,130,246,0.14);color:#60A5FA;}
  .o-badge-grey{background:var(--ui-elevated);color:var(--ui-fg2);border:1px solid var(--ui-border);}
  /* Section heading */
  .o-section{display:flex;align-items:center;gap:16px;margin:32px 0 16px;}
  .o-section h2{margin:0;font-family:"Space Grotesk",sans-serif;font-size:16px;font-weight:600;color:var(--ui-fg1);letter-spacing:-0.01em;}
  .o-section .rule{flex:1;height:1px;background:var(--ui-border);}
  .o-eyebrow{font-family:"Space Grotesk",sans-serif;font-size:10px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--ui-primary-text);}
  /* Table */
  .o-table{width:100%;border-collapse:collapse;}
  .o-table th{font-family:"Space Grotesk",sans-serif;font-size:10px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--ui-fg3);text-align:left;padding:10px 12px;border-bottom:1px solid var(--ui-border);}
  .o-table td{padding:14px 12px;border-bottom:1px solid var(--ui-hairline);font-size:13.5px;color:var(--ui-fg1);}
  .o-table tr:last-child td{border-bottom:none;}
  .o-table tr:hover td{background:var(--ui-hairline);}
  /* Progress track */
  .o-track{height:8px;background:var(--ui-hairline);border-radius:9999px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.25);}
  [data-theme="light"] .o-track{background:rgba(15,23,42,0.06);}
  .o-fill{height:100%;border-radius:9999px;}
  /* Separator */
  .o-sep{height:1px;background:var(--ui-hairline);margin:16px 0;}
  /* Animations */
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes orbit-a{to{transform:rotate(360deg)}}
  .o-brand-tile svg .orbit-ring{transform-origin:50px 50px;animation:orbit-a 22s linear infinite;}
  .o-brand-tile svg .sat-group{transform-origin:50px 50px;animation:orbit-a 28s linear infinite reverse;}
  .o-brand-tile svg .core{transform-origin:50px 50px;animation:pulse 3.2s ease-in-out infinite;}
  @media(prefers-reduced-motion:reduce){
    body::before,body::after,#orion-starfield,.o-live-chip .p,.o-brand-tile svg *{animation:none!important;}
    #orion-starfield{display:none;}
  }
  `;

  /* ── NAV CONFIG ── */
  const NAV = {
    main: [
      { id:'dashboard', label:'Dashboard', href:'dashboard.html', icon:'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>' },
      { id:'trends',    label:'Trends',    href:'trends.html',    icon:'<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>' },
      { id:'queue',     label:'Content Queue', href:'queue.html', icon:'<path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/><path d="m16 12 5 3-5 3z"/>', dot: true },
      { id:'generation',label:'Generation', href:'generation.html', icon:'<path d="M9.9 15.5A2 2 0 0 0 8.5 14.1L2.4 12.5a.5.5 0 0 1 0-1l6.1-1.5A2 2 0 0 0 9.9 8.5l1.6-6.1a.5.5 0 0 1 1 0L14 8.5a2 2 0 0 0 1.4 1.4l6.2 1.6a.5.5 0 0 1 0 1l-6.2 1.6a2 2 0 0 0-1.4 1.4l-1.6 6.1a.5.5 0 0 1-1 0z"/>' },
      { id:'publishing',label:'Publishing', href:'publishing.html', icon:'<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>' },
    ],
    insight: [
      { id:'analytics', label:'Analytics',     href:'analytics.html', icon:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>' },
      { id:'system',    label:'System Health', href:'system.html',    icon:'<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.5.5 0 0 1-.96 0L9.68 3.18a.5.5 0 0 0-.96 0l-2.35 8.36A2 2 0 0 1 4.44 13H2"/>' },
      { id:'settings',  label:'Settings',      href:'settings.html',  icon:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
    ],
  };

  const APERTURE_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="shellAp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A78BFA"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs><circle class="orbit-ring" cx="50" cy="50" r="32" fill="none" stroke="url(#shellAp)" stroke-width="2.5" opacity="0.8" stroke-dasharray="60 22"/><g class="sat-group"><circle cx="18" cy="50" r="5" fill="#A78BFA"/><circle cx="66" cy="22" r="5" fill="#22D3EE"/><circle cx="66" cy="78" r="5" fill="#A78BFA"/></g><circle class="core" cx="50" cy="50" r="9" fill="url(#shellAp)"/><circle cx="50" cy="50" r="14" fill="none" stroke="url(#shellAp)" stroke-width="1.8"/></svg>`;

  function navItem(item, active) {
    const cls = 'o-nav-item' + (item.id === active ? ' active' : '');
    const dot  = item.dot ? '<span class="dot"></span>' : '';
    return `<a href="${item.href}" class="${cls}"><svg viewBox="0 0 24 24">${item.icon}</svg>${item.label}${dot}</a>`;
  }

  function injectStyle() {
    const s = document.createElement('style');
    s.textContent = STYLE;
    document.head.insertBefore(s, document.head.firstChild);
  }

  function injectFonts() {
    if (document.querySelector('[data-orion-fonts]')) return;
    const l1 = document.createElement('link'); l1.rel='preconnect'; l1.href='https://fonts.googleapis.com';
    const l2 = document.createElement('link'); l2.rel='preconnect'; l2.href='https://fonts.gstatic.com'; l2.crossOrigin='anonymous';
    const l3 = document.createElement('link'); l3.rel='stylesheet'; l3.setAttribute('data-orion-fonts','');
    l3.href='https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
    document.head.append(l1, l2, l3);
    const fi = document.createElement('link'); fi.rel='icon'; fi.type='image/svg+xml';
    fi.href='../assets/favicon.svg';
    document.head.appendChild(fi);
  }

  function buildShell(cfg) {
    const sidebarHTML = `
<aside class="orion-sidebar">
  <div class="o-brand">
    <div class="o-brand-tile">${APERTURE_SVG}</div>
    <div><div class="o-brand-name">orion</div><div class="o-brand-tag">Mission Control</div></div>
  </div>
  <div class="o-nav-label">Operations</div>
  ${NAV.main.map(i => navItem(i, cfg.active)).join('')}
  <div class="o-nav-label">Insight</div>
  ${NAV.insight.map(i => navItem(i, cfg.active)).join('')}
  <div class="o-sidebar-footer">
    <div class="o-avatar">AK</div>
    <div><div class="o-user-name">Ari Khoury</div><div class="o-user-role">Operator · Admin</div></div>
  </div>
</aside>`;

    const topnavHTML = `
<div class="orion-topnav">
  <div class="o-search">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input type="text" placeholder="SEARCH SYSTEM…">
  </div>
  <span class="o-live-chip"><span class="p"></span>LIVE VIEW</span>
  <div class="o-spacer"></div>
  <button class="o-icon-btn"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg></button>
  <button class="o-icon-btn"><svg viewBox="0 0 24 24"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg><span class="o-badge-dot"></span></button>
  <button class="o-btn-primary">
    <svg viewBox="0 0 24 24"><path d="M9.9 15.5A2 2 0 0 0 8.5 14.1L2.4 12.5a.5.5 0 0 1 0-1l6.1-1.5A2 2 0 0 0 9.9 8.5l1.6-6.1a.5.5 0 0 1 1 0L14 8.5a2 2 0 0 0 1.4 1.4l6.2 1.6a.5.5 0 0 1 0 1l-6.2 1.6a2 2 0 0 0-1.4 1.4l-1.6 6.1a.5.5 0 0 1-1 0z"/></svg>
    Generate
  </button>
</div>`;

    const pageHeader = `
<div class="o-page-header">
  <div class="tile"><svg viewBox="0 0 24 24">${cfg.iconPath || ''}</svg></div>
  <div>
    <h1>${cfg.title}</h1>
    <div class="subtitle">${cfg.subtitle || ''}</div>
  </div>
</div>`;

    const themeToggle = `
<div class="o-theme-toggle">
  <button id="ot-dark" class="active" onclick="OrionShell.setTheme('dark')"><svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>Dark</button>
  <button id="ot-light" onclick="OrionShell.setTheme('light')"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>Light</button>
</div>`;

    const content = document.getElementById('page-content');
    const contentHTML = content ? content.innerHTML : '';
    document.body.innerHTML = `
<canvas id="orion-starfield" aria-hidden="true"></canvas>
${themeToggle}
<div class="orion-app">
  ${sidebarHTML}
  <section>
    ${topnavHTML}
    <main class="orion-main">
      ${pageHeader}
      ${contentHTML}
    </main>
  </section>
</div>`;
  }

  function startStarfield() {
    const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = document.getElementById('orion-starfield');
    if (!canvas || REDUCED) return;
    const ctx = canvas.getContext('2d');
    let w, h, stars, dpr;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.width = innerWidth * dpr; h = canvas.height = innerHeight * dpr;
      canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
      const n = Math.min(180, Math.floor(innerWidth * innerHeight / 12000));
      stars = Array.from({length: n}, () => ({
        x: Math.random()*w, y: Math.random()*h,
        r: (Math.random()*1.2+0.3)*dpr,
        vx: (Math.random()-.5)*.04*dpr, vy: (Math.random()-.5)*.03*dpr,
        phase: Math.random()*Math.PI*2, speed: .6+Math.random()*1.4,
        hue: Math.random()<.25?'cyan':(Math.random()<.55?'violet':'white'),
      }));
    }
    const C = {white:[237,241,250], violet:[167,139,250], cyan:[34,211,238]};
    let t0 = performance.now();
    function frame(now) {
      const dt = (now-t0)/1000; t0 = now;
      const light = document.documentElement.getAttribute('data-theme') === 'light';
      ctx.clearRect(0,0,w,h);
      for (const s of stars) {
        s.x += s.vx; s.y += s.vy; s.phase += dt*s.speed;
        if(s.x<0)s.x+=w; if(s.x>w)s.x-=w; if(s.y<0)s.y+=h; if(s.y>h)s.y-=h;
        const tw = .45+.55*(.5+.5*Math.sin(s.phase));
        const [r,g,b] = C[s.hue]; const a = (light?.4:.9)*tw;
        ctx.beginPath(); ctx.fillStyle=`rgba(${r},${g},${b},${a})`;
        ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
        if (s.r > 1.4*dpr) { ctx.beginPath(); ctx.fillStyle=`rgba(${r},${g},${b},${a*.14})`; ctx.arc(s.x,s.y,s.r*3.5,0,Math.PI*2); ctx.fill(); }
      }
      requestAnimationFrame(frame);
    }
    resize(); addEventListener('resize', resize); requestAnimationFrame(frame);
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const d = document.getElementById('ot-dark'), l = document.getElementById('ot-light');
    if (d) d.classList.toggle('active', t==='dark');
    if (l) l.classList.toggle('active', t==='light');
    try { localStorage.setItem('orion-theme', t); } catch(e) {}
  }

  function restoreTheme() {
    try { const t = localStorage.getItem('orion-theme'); if (t) setTheme(t); } catch(e) {}
  }

  function init(cfg) {
    injectStyle();
    injectFonts();
    buildShell(cfg);
    startStarfield();
    restoreTheme();
  }

  return { init, setTheme };
})();
