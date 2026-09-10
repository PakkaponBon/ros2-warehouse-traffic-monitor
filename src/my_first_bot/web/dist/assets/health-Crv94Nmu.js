import"./modulepreload-polyfill-B5Qt9EMX.js";import{g as u}from"./api-C-_1ynU0.js";const g=document.querySelector("#app");g.innerHTML=`
  <header class="topbar">
    <div class="brand">
      <div class="logo">W</div>
      <div><strong>Warehouse Intelligence</strong><small>System health</small></div>
    </div>
    <div id="connection" class="connection"><i></i><span>Connecting…</span></div>
    <nav class="top-links" aria-label="Dashboard pages">
      <a href="/">Traffic</a>
      <a class="active" href="/health.html">System health</a>
    </nav>
  </header>
  <main class="health-main">
    <section class="health-intro panel">
      <div>
        <h1>System health</h1>
        <p>Live telemetry freshness and diagnostic availability. This page is read-only.</p>
      </div>
      <div id="thresholds" class="health-thresholds">Loading thresholds…</div>
    </section>
    <section id="healthMetrics" class="metrics health-metrics"></section>
    <section class="panel health-services-panel">
      <div class="panel-head"><div><h2>Services</h2><span class="sub">API, database, and recorder status</span></div><span id="version" class="tag">VERSION —</span></div>
      <div id="services" class="health-services"><div class="empty">Waiting for service health…</div></div>
    </section>
    <section class="panel health-vehicles-panel">
      <div class="panel-head"><div><h2>Forklifts</h2><span class="sub">Position telemetry, localization, UWB, and sensor diagnostics</span></div><span class="tag">READ ONLY</span></div>
      <div id="vehicles" class="health-vehicles"><div class="empty">Waiting for vehicle health…</div></div>
    </section>
  </main>
`;const i=e=>document.querySelector(e),s=e=>String(e).replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[a]),d=e=>(e||"unknown").replaceAll("_"," "),h=e=>Number.isFinite(e)?e<60?`${e.toFixed(1)} s ago`:e<3600?`${Math.floor(e/60)} min ago`:`${Math.floor(e/3600)} h ago`:"Never",f=e=>{if(!Number.isFinite(e)||e<=0)return"0 B";const a=["B","KB","MB","GB"],t=Math.min(a.length-1,Math.floor(Math.log(e)/Math.log(1024)));return`${(e/1024**t).toFixed(t?1:0)} ${a[t]}`},r=e=>`<span class="health-badge ${s(e||"unknown")}">${s(d(e))}</span>`,m=(e,a="")=>Number.isFinite(e)?`${e.toFixed(2)}${a}`:"Unknown";function $(e){var n;const a=e.database||{},t=e.traffic_recorder||{},l=[{name:"Web API",status:(n=e.web_api)==null?void 0:n.status,detail:"Health endpoint responding",meta:"Browser ↔ monitoring API"},{name:"Traffic recorder",status:t.status,detail:t.detail||"Recorder state unavailable",meta:`Newest sample ${h(t.age_seconds)}`},{name:"SQLite database",status:a.status,detail:`${Number(a.samples||0).toLocaleString()} position samples`,meta:`${s(a.file||"database")} · ${f(a.bytes)}`}];i("#services").innerHTML=l.map(o=>`
    <article class="health-service">
      <div><strong>${s(o.name)}</strong>${r(o.status)}</div>
      <p>${s(o.detail)}</p>
      <small>${o.meta}</small>
    </article>
  `).join("")}function b(e){if(!e.length){i("#vehicles").innerHTML='<div class="empty">No configured or recorded vehicles.</div>';return}i("#vehicles").innerHTML=e.map(a=>{const t=a.position?`x ${a.position.x.toFixed(2)}, y ${a.position.y.toFixed(2)} · ${s(a.position.frame_id)}`:"No position received",l=a.localization||{},n=a.uwb||{},o=a.lidar||{},p=n.freshness==="online"?n.state:n.freshness||"unknown";return`
      <article class="health-vehicle ${s(a.status)}">
        <div class="health-vehicle-head">
          <div><strong>${s(a.vehicle_id)}</strong><small>${t}</small></div>
          ${r(a.status)}
        </div>
        <div class="health-detail-grid">
          <div><span>Last telemetry</span><b>${h(a.age_seconds)}</b><small>${a.last_seen?new Date(a.last_seen).toLocaleString():"Never received"}</small></div>
          <div><span>Motion</span><b>${s(d(a.motion_state))}</b><small>${m(a.speed," m/s")}</small></div>
          <div><span>Localization</span>${r(l.state)}<small>${s(l.source||"No localization source")} · covariance ${m(l.covariance_trace)}</small></div>
          <div><span>UWB validation</span>${r(p)}<small>Last result ${s(d(n.state))} · ${n.visible_tag_count||0} tags · ${h(n.age_seconds)}</small></div>
          <div><span>LiDAR</span>${r(o.state)}<small>${s(o.detail||"No sensor diagnostic")}</small></div>
        </div>
      </article>
    `}).join("")}function _(e){const a=e.summary;i("#healthMetrics").innerHTML=[["total",a.total,"Configured/observed",""],["online",a.online,"Online","teal"],["stale",a.stale,"Stale","orange"],["offline",a.offline,"Offline","red"],["unknown",a.unknown,"Never observed",""]].map(([t,l,n,o])=>`<article class="metric ${o}" data-status="${t}"><strong>${l}</strong><span>${n}</span></article>`).join(""),i("#thresholds").textContent=`Online < ${e.thresholds.online_under_seconds}s · stale to ${e.thresholds.offline_over_seconds}s · then offline`,i("#version").textContent=`VERSION ${e.software_version}`,$(e.services),b(e.vehicles)}let c=!1;async function v(){if(!c){c=!0;try{const e=await u();_(e),i("#connection").className="connection",i("#connection span").textContent=`Updated ${new Date(e.generated_at).toLocaleTimeString()}`}catch(e){i("#connection").className="connection error",i("#connection span").textContent=`Health unavailable · ${e.message}`}finally{c=!1}}}v();setInterval(v,2e3);
