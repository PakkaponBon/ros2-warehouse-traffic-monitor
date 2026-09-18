import"./modulepreload-polyfill-B5Qt9EMX.js";import{g as R,s as I}from"./api-as0-rMUe.js";const F=document.querySelector("#app");document.body.classList.add("dashboard","health-page");F.innerHTML=`
  <a class="skip-link" href="#workspace">Skip to workspace</a>
  <aside class="app-sidebar">
    <a class="brand" href="/" aria-label="Warehouse Intelligence home">
      <span class="logo">W</span><span><strong>Warehouse</strong><small>INTELLIGENCE</small></span>
    </a>
    <div class="nav-caption">WORKSPACE</div>
    <nav class="workspace-nav" aria-label="Workspace">
      <a href="/#overview"><span aria-hidden="true">◫</span>Overview</a>
      <a href="/#activity"><span aria-hidden="true">≋</span>Traffic history</a>
      <a href="/#dispatch"><span aria-hidden="true">↗</span>Dispatch a task</a>
      <a href="/#diagnostics"><span aria-hidden="true">⌁</span>Diagnostics</a>
    </nav>
    <div class="sidebar-bottom">
      <a href="/health.html" aria-current="page"><span aria-hidden="true">♡</span>System health</a>
      <p>Warehouse operations<br><span>Traffic & vehicle monitoring</span></p>
    </div>
  </aside>
  <div class="app-workspace">
    <header class="workspace-topbar">
      <span>Operations <span class="breadcrumb">/ <b>System health</b></span></span>
      <div id="connection" class="connection" role="status"><i></i><span>Connecting…</span></div>
    </header>
    <main id="workspace" class="health-main" tabindex="-1">
      <div class="page-heading">
        <div><p class="eyebrow">SYSTEM HEALTH</p><h1>Keep your warehouse connected.</h1><p id="pageDescription">Check service availability and find vehicles that need attention.</p></div>
        <button id="refreshHealth" type="button" class="secondary">Refresh status</button>
      </div>
      <section id="healthOverview" class="health-overview" role="status">
        <span id="overviewIcon" class="overview-icon" aria-hidden="true">◷</span>
        <div><h2 id="overviewTitle">Connecting to your warehouse…</h2><p id="overviewDescription">Waiting for the latest health report.</p></div>
        <span id="healthUpdated" class="health-updated">Auto-refreshes every 2 seconds</span>
      </section>
      <section id="healthMetrics" class="metrics health-metrics" aria-label="Vehicle connectivity">
        ${["Reporting","Delayed updates","Offline","Not yet seen"].map(e=>`<article class="metric"><span>${e}</span><strong>—</strong><small>Waiting for health data</small></article>`).join("")}
      </section>
      <section class="panel health-services-panel">
        <div class="panel-head"><div><h2>Core services</h2><span class="sub">The services that keep monitoring available</span></div><span id="serviceCount" class="tag">Checking…</span></div>
        <div id="services" class="health-services"><div class="empty">Waiting for service health…</div></div>
      </section>
      <section class="panel health-vehicles-panel">
        <div class="panel-head">
          <div><h2>Vehicle health <span id="vehicleCount" class="count-badge">—</span></h2><span class="sub">Open a vehicle for sensor readings and technical details</span></div>
          <div class="health-filters" role="group" aria-label="Filter vehicles">
            <button type="button" data-filter="all" aria-pressed="true">All vehicles</button>
            <button type="button" data-filter="attention" aria-pressed="false">Needs attention <span id="attentionCount">—</span></button>
          </div>
        </div>
        <div id="vehicles" class="health-vehicles"><div class="empty">Waiting for vehicle health…</div></div>
      </section>
    <details id="faultPanel" class="panel fault-panel" hidden>
      <summary class="panel-head">
        <div><h2>Simulation testing</h2><span class="sub">Advanced controls · deliberately interrupt simulated vehicles</span></div>
        <span id="faultCount" class="tag fault-warning">SIMULATION ONLY</span>
      </summary>
      <div class="fault-controls">
        <label class="field"><span>Forklift</span><select id="faultVehicle"></select></label>
        <div class="fault-buttons" aria-label="Persistent simulation faults">
          <button type="button" class="secondary fault-toggle" data-fault="freeze">Freeze drivetrain</button>
          <button type="button" class="secondary fault-toggle" data-fault="lidar_dropout">Drop LiDAR</button>
          <button type="button" class="secondary fault-toggle" data-fault="uwb_dropout">Drop UWB</button>
          <button type="button" class="secondary fault-toggle" data-fault="localization_loss">Lose localization</button>
        </div>
        <div class="fault-buttons" aria-label="One-shot simulation actions">
          <button type="button" data-action="teleport">Teleport +6 m</button>
          <button type="button" class="secondary" data-action="restore">Restore pose</button>
          <button type="button" class="fault-clear" data-action="clear_all">Clear faults</button>
        </div>
      </div>
      <div class="fault-status"><span id="activeFaults">No active faults</span><span id="faultResult" role="status">Ready</span></div>
    </details>

      <details class="health-reference">
        <summary>How status is determined</summary>
        <p id="thresholds">Waiting for reporting thresholds…</p>
        <p>Vehicle connectivity is based on the age of its last position update. Sensor checks are separate; an unknown reading means that a diagnostic is not available.</p>
        <span id="version" class="tag">VERSION —</span>
      </details>
      <footer class="workspace-footer"><span>Warehouse Intelligence</span><span>Live service & vehicle monitoring</span></footer>
    </main>
  </div>
`;const s=e=>document.querySelector(e),d=e=>String(e).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),w=e=>(e||"unknown").replaceAll("_"," "),_=e=>Number.isFinite(e)?e<60?`${e.toFixed(1)} s ago`:e<3600?`${Math.floor(e/60)} min ago`:`${Math.floor(e/3600)} h ago`:"Never",D=e=>{if(!Number.isFinite(e)||e<=0)return"0 B";const t=["B","KB","MB","GB"],n=Math.min(t.length-1,Math.floor(Math.log(e)/Math.log(1024)));return`${(e/1024**n).toFixed(n?1:0)} ${t[n]}`},g=e=>`<span class="health-badge ${d(e||"unknown")}">${d(w(e))}</span>`,N=(e,t="")=>Number.isFinite(e)?`${e.toFixed(2)}${t}`:"Unknown",A={freeze:"drivetrain frozen",lidar_dropout:"LiDAR dropped",uwb_dropout:"UWB dropped",localization_loss:"localization lost"};let c=null,$=!1,y=!1,T="all";const S=new Set;function E(e,t){var i;const n=(i=e==null?void 0:e.active)==null?void 0:i.find(o=>o.vehicle_id===t);return new Set((n==null?void 0:n.faults)||[])}function L(e,t){const n=s("#faultPanel");if(n.hidden=!(e!=null&&e.enabled),!(e!=null&&e.enabled))return;const i=s("#faultVehicle"),o=t.map(r=>r.vehicle_id).filter(r=>r.startsWith("vehicle_")),a=i.value,l=o.join("|");i.dataset.vehicles!==l&&(i.innerHTML=o.map(r=>`<option value="${d(r)}">${d(r)}</option>`).join(""),i.dataset.vehicles=l,o.includes(a)&&(i.value=a));const h=i.value||o[0],v=E(e,h);document.querySelectorAll(".fault-toggle").forEach(r=>{const f=v.has(r.dataset.fault);r.classList.toggle("active",f),r.setAttribute("aria-pressed",String(f))}),s("#activeFaults").textContent=v.size?`${h}: ${[...v].map(r=>A[r]||r).join(", ")}`:`${h||"No vehicle"}: no active faults`;const u=(e.active||[]).reduce((r,f)=>{var m;return r+(((m=f.faults)==null?void 0:m.length)||0)},0);if(s("#faultCount").textContent=u?`${u} ACTIVE FAULT${u===1?"":"S"}`:"SIMULATION ONLY",document.querySelectorAll("#faultPanel button").forEach(r=>{r.disabled=$||!y||!h}),$)return;const p=e.last_action;s("#faultResult").textContent=p?`${w(p.action)} ${p.vehicle_id||""}: ${w(p.status)}${p.detail?` · ${p.detail}`:""}`:"Ready"}function O(e){var o,a;const t=e.database||{},n=e.traffic_recorder||{},i=[{name:"Monitoring API",status:(o=e.web_api)==null?void 0:o.status,detail:((a=e.web_api)==null?void 0:a.status)==="online"?"Connected to the monitoring service":"Monitoring service status unavailable",meta:"Browser ↔ monitoring API"},{name:"Traffic recorder",status:n.status,detail:n.detail||"Recorder state unavailable",meta:`Newest sample ${_(n.age_seconds)}`},{name:"Traffic database",status:t.status,detail:`${Number(t.samples||0).toLocaleString()} position samples`,meta:`${d(t.file||"database")} · ${D(t.bytes)}`}];s("#services").innerHTML=i.map(l=>`
    <article class="health-service">
      <div><strong>${d(l.name)}</strong>${g(l.status)}</div>
      <p>${d(l.detail)}</p>
      <small>${l.meta}</small>
    </article>
  `).join("")}function b(e){var n,i,o,a,l;const t=[];return e.status==="offline"?t.push("No recent position updates"):e.status==="stale"?t.push("Position updates are delayed"):e.status!=="online"&&t.push("No position received yet"),["stale","offline","unavailable"].includes((n=e.localization)==null?void 0:n.state)&&t.push("Check localization"),((i=e.lidar)==null?void 0:i.state)==="unavailable"&&t.push("LiDAR unavailable"),["stale","offline"].includes((o=e.uwb)==null?void 0:o.freshness)?t.push("UWB updates are delayed or missing"):["caution","disagreement","unavailable","uwb_unavailable","waiting_amcl","unsynchronized"].includes((a=e.uwb)==null?void 0:a.state)&&t.push("Check UWB validation"),(l=e.injected_faults)!=null&&l.length&&t.push("Simulation fault active"),t}function M(e){var i,o;const t=(o=(i=document.activeElement)==null?void 0:i.closest("[data-health-vehicle]"))==null?void 0:o.dataset.healthVehicle,n=e.filter(a=>T==="all"||b(a).length).sort((a,l)=>+!!b(l).length-+!!b(a).length||a.vehicle_id.localeCompare(l.vehicle_id,void 0,{numeric:!0}));if(!n.length){s("#vehicles").innerHTML=`<div class="empty">${e.length?"No vehicles need attention based on the available checks.":"No configured or recorded vehicles yet."}</div>`;return}s("#vehicles").innerHTML=n.map(a=>{const l=b(a),h=a.position?`x ${a.position.x.toFixed(2)}, y ${a.position.y.toFixed(2)} · ${d(a.position.frame_id)}`:"No position received",v=a.localization||{},u=a.uwb||{},p=a.lidar||{},r=a.injected_faults||[],f=u.freshness==="online"?u.state:u.freshness||"unknown";return`
      <details class="health-vehicle ${d(a.status)}" data-health-vehicle="${d(a.vehicle_id)}" ${S.has(a.vehicle_id)?"open":""}>
        <summary class="health-vehicle-head">
          <span class="vehicle-health-name"><strong>${d(a.vehicle_id)}</strong><small class="${l.length?"vehicle-issue":""}">${l.length?d(l.join(" · ")):"Position updates are current"}</small></span>
          <span class="vehicle-health-age">${_(a.age_seconds)}</span>
          ${g(a.status)}<span class="expand-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="vehicle-diagnostics">
          <div class="vehicle-position-note">${h}${r.length?`<span class="injected-fault">Simulation: ${d(r.map(m=>A[m]||m).join(", "))}</span>`:""}</div>
          <div class="health-detail-grid">
            <div><span>Last position update</span><b>${_(a.age_seconds)}</b><small>${a.last_seen?new Date(a.last_seen).toLocaleString():"Never received"}</small></div>
            <div><span>Movement</span><b>${d(w(a.motion_state))}</b><small>${N(a.speed," m/s")}</small></div>
            <div><span>Localization</span>${g(v.state)}<small>${d(v.source||"No localization source")} · covariance ${N(v.covariance_trace)}</small></div>
            <div><span>UWB validation</span>${g(f)}<small>Last result ${d(w(u.state))} · ${u.visible_tag_count||0} tags · ${_(u.age_seconds)}</small></div>
            <div><span>LiDAR</span>${g(p.state)}<small>${d(p.detail||"No sensor diagnostic")}</small></div>
          </div>
        </div>
      </details>`}).join(""),s("#vehicles").querySelectorAll("[data-health-vehicle]").forEach(a=>{a.addEventListener("toggle",()=>{a.isConnected&&(a.open?S.add(a.dataset.healthVehicle):S.delete(a.dataset.healthVehicle))}),a.dataset.healthVehicle===t&&a.querySelector("summary").focus({preventScroll:!0})})}function V(e){const t=e.summary,n=e.vehicles.filter(l=>b(l).length).length,i=["web_api","traffic_recorder","database"],o=i.filter(l=>{var h;return((h=e.services[l])==null?void 0:h.status)!=="online"}).length,a=n||o;s("#healthOverview").className=`health-overview ${a?"attention":"connected"}`,s("#overviewIcon").textContent=a?"!":"✓",s("#overviewTitle").textContent=a?"Some checks need your attention":"Monitoring services are connected",s("#overviewDescription").textContent=a?[n?`${n} vehicle${n===1?"":"s"} with delayed updates or diagnostic issues`:"",o?`${o} service${o===1?"":"s"} to check`:""].filter(Boolean).join(" · "):t.total?"Vehicle position updates are current. Open a vehicle to review individual sensor checks.":"No vehicles have been configured or recorded yet.",s("#healthUpdated").textContent=`Checked ${new Date(e.generated_at).toLocaleTimeString()}`,s("#serviceCount").textContent=`${i.length-o} / ${i.length} online`,s("#vehicleCount").textContent=t.total,s("#attentionCount").textContent=n,s("#healthMetrics").innerHTML=[["online",t.online,"Reporting","teal","Recent position updates"],["stale",t.stale,"Delayed updates","orange","Updates older than expected"],["offline",t.offline,"Offline","red","No recent position updates"],["unknown",t.unknown,"Not yet seen","","No position received"]].map(([l,h,v,u,p])=>`<article class="metric ${u}" data-status="${l}"><span>${v}</span><strong>${h}</strong><small>${p}</small></article>`).join(""),s("#thresholds").textContent=`Reporting: less than ${e.thresholds.online_under_seconds}s since the last update. Delayed: up to ${e.thresholds.offline_over_seconds}s. Offline: older than ${e.thresholds.offline_over_seconds}s.`,s("#version").textContent=`VERSION ${e.software_version}`,L(e.simulation_faults,e.vehicles),O(e.services),M(e.vehicles)}s("#refreshHealth").addEventListener("click",C);document.querySelectorAll("[data-filter]").forEach(e=>{e.addEventListener("click",()=>{T=e.dataset.filter,document.querySelectorAll("[data-filter]").forEach(t=>t.setAttribute("aria-pressed",String(t===e))),c&&M(c.vehicles)})});async function x(e){if(!($||!y)){$=!0,document.querySelectorAll("#faultPanel button").forEach(t=>{t.disabled=!0}),s("#faultResult").textContent="Applying simulation fault…";try{const t=await I(e);c&&(c.simulation_faults=t),L(t,(c==null?void 0:c.vehicles)||[]),await C()}catch(t){s("#faultResult").textContent=`Failed: ${t.message}`}finally{$=!1,document.querySelectorAll("#faultPanel button").forEach(t=>{t.disabled=!y||!s("#faultVehicle").value})}}}s("#faultVehicle").addEventListener("change",()=>{L(c==null?void 0:c.simulation_faults,(c==null?void 0:c.vehicles)||[])});s("#faultPanel").addEventListener("click",e=>{const t=e.target.closest("button");if(!t)return;const n=s("#faultVehicle").value;if(n)if(t.dataset.fault){const i=E(c==null?void 0:c.simulation_faults,n);x({action:"set",vehicle_id:n,fault:t.dataset.fault,enabled:!i.has(t.dataset.fault)})}else t.dataset.action&&x({action:t.dataset.action,vehicle_id:n})});let k=!1;async function C(){if(!k){k=!0,s("#refreshHealth").disabled=!0;try{const e=await R();c=e,y=!0,V(e),s("#connection").className="connection",s("#connection span").textContent=`Updated ${new Date(e.generated_at).toLocaleTimeString()}`}catch{s("#connection").className="connection error",y=!1,s("#connection span").textContent="Monitor offline",s("#healthOverview").className="health-overview unavailable",s("#overviewIcon").textContent="!",s("#overviewTitle").textContent="Unable to reach the monitor",s("#overviewDescription").textContent=c?"The information below is from the last successful update and may be out of date. Reconnecting automatically…":"Health information is not available yet. Check that the warehouse monitor is running. Reconnecting automatically…",document.querySelectorAll("#faultPanel button").forEach(t=>{t.disabled=!0})}finally{k=!1,s("#refreshHealth").disabled=!1}}}C();setInterval(C,2e3);
