import"./modulepreload-polyfill-B5Qt9EMX.js";import{s as F,g as x}from"./api-BiLEcXRt.js";const M=document.querySelector("#app");M.innerHTML=`
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
    <section id="faultPanel" class="panel fault-panel" hidden>
      <div class="panel-head">
        <div><h2>Simulation fault injection</h2><span class="sub">Exercise monitoring and recovery without changing real forklift interfaces</span></div>
        <span class="tag fault-warning">GAZEBO ONLY</span>
      </div>
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
      <div class="fault-status"><span id="activeFaults">No active faults</span><span id="faultResult">Ready</span></div>
    </section>
    <section id="healthMetrics" class="metrics health-metrics"></section>
    <section class="panel health-services-panel">
      <div class="panel-head"><div><h2>Services</h2><span class="sub">API, database, and recorder status</span></div><span id="version" class="tag">VERSION —</span></div>
      <div id="services" class="health-services"><div class="empty">Waiting for service health…</div></div>
    </section>
    <section class="panel health-vehicles-panel">
      <div class="panel-head"><div><h2>Forklifts</h2><span class="sub">Position telemetry, localization, UWB, and sensor diagnostics</span></div><span class="tag">MONITORING</span></div>
      <div id="vehicles" class="health-vehicles"><div class="empty">Waiting for vehicle health…</div></div>
    </section>
  </main>
`;const n=t=>document.querySelector(t),l=t=>String(t).replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e]),p=t=>(t||"unknown").replaceAll("_"," "),b=t=>Number.isFinite(t)?t<60?`${t.toFixed(1)} s ago`:t<3600?`${Math.floor(t/60)} min ago`:`${Math.floor(t/3600)} h ago`:"Never",z=t=>{if(!Number.isFinite(t)||t<=0)return"0 B";const e=["B","KB","MB","GB"],a=Math.min(e.length-1,Math.floor(Math.log(t)/Math.log(1024)));return`${(t/1024**a).toFixed(a?1:0)} ${e[a]}`},v=t=>`<span class="health-badge ${l(t||"unknown")}">${l(p(t))}</span>`,L=(t,e="")=>Number.isFinite(t)?`${t.toFixed(2)}${e}`:"Unknown",S={freeze:"drivetrain frozen",lidar_dropout:"LiDAR dropped",uwb_dropout:"UWB dropped",localization_loss:"localization lost"};let o=null,m=!1;function N(t,e){var s;const a=(s=t==null?void 0:t.active)==null?void 0:s.find(i=>i.vehicle_id===e);return new Set((a==null?void 0:a.faults)||[])}function $(t,e){const a=n("#faultPanel");if(a.hidden=!(t!=null&&t.enabled),!(t!=null&&t.enabled))return;const s=n("#faultVehicle"),i=e.map(r=>r.vehicle_id).filter(r=>r.startsWith("vehicle_")),c=s.value,f=i.join("|");s.dataset.vehicles!==f&&(s.innerHTML=i.map(r=>`<option value="${l(r)}">${l(r)}</option>`).join(""),s.dataset.vehicles=f,i.includes(c)&&(s.value=c));const h=s.value||i[0],d=N(t,h);document.querySelectorAll(".fault-toggle").forEach(r=>{const y=d.has(r.dataset.fault);r.classList.toggle("active",y),r.setAttribute("aria-pressed",String(y))}),n("#activeFaults").textContent=d.size?`${h}: ${[...d].map(r=>S[r]||r).join(", ")}`:`${h||"No vehicle"}: no active faults`;const u=t.last_action;n("#faultResult").textContent=u?`${p(u.action)} ${u.vehicle_id||""}: ${p(u.status)}${u.detail?` · ${u.detail}`:""}`:"Ready"}function A(t){var i;const e=t.database||{},a=t.traffic_recorder||{},s=[{name:"Web API",status:(i=t.web_api)==null?void 0:i.status,detail:"Health endpoint responding",meta:"Browser ↔ monitoring API"},{name:"Traffic recorder",status:a.status,detail:a.detail||"Recorder state unavailable",meta:`Newest sample ${b(a.age_seconds)}`},{name:"SQLite database",status:e.status,detail:`${Number(e.samples||0).toLocaleString()} position samples`,meta:`${l(e.file||"database")} · ${z(e.bytes)}`}];n("#services").innerHTML=s.map(c=>`
    <article class="health-service">
      <div><strong>${l(c.name)}</strong>${v(c.status)}</div>
      <p>${l(c.detail)}</p>
      <small>${c.meta}</small>
    </article>
  `).join("")}function R(t){if(!t.length){n("#vehicles").innerHTML='<div class="empty">No configured or recorded vehicles.</div>';return}n("#vehicles").innerHTML=t.map(e=>{const a=e.position?`x ${e.position.x.toFixed(2)}, y ${e.position.y.toFixed(2)} · ${l(e.position.frame_id)}`:"No position received",s=e.localization||{},i=e.uwb||{},c=e.lidar||{},f=e.injected_faults||[],h=i.freshness==="online"?i.state:i.freshness||"unknown";return`
      <article class="health-vehicle ${l(e.status)}">
        <div class="health-vehicle-head">
          <div><strong>${l(e.vehicle_id)}</strong><small>${a}</small>${f.length?`<small class="injected-fault">Injected: ${l(f.map(d=>S[d]||d).join(", "))}</small>`:""}</div>
          ${v(e.status)}
        </div>
        <div class="health-detail-grid">
          <div><span>Last telemetry</span><b>${b(e.age_seconds)}</b><small>${e.last_seen?new Date(e.last_seen).toLocaleString():"Never received"}</small></div>
          <div><span>Motion</span><b>${l(p(e.motion_state))}</b><small>${L(e.speed," m/s")}</small></div>
          <div><span>Localization</span>${v(s.state)}<small>${l(s.source||"No localization source")} · covariance ${L(s.covariance_trace)}</small></div>
          <div><span>UWB validation</span>${v(h)}<small>Last result ${l(p(i.state))} · ${i.visible_tag_count||0} tags · ${b(i.age_seconds)}</small></div>
          <div><span>LiDAR</span>${v(c.state)}<small>${l(c.detail||"No sensor diagnostic")}</small></div>
        </div>
      </article>
    `}).join("")}function B(t){const e=t.summary;n("#healthMetrics").innerHTML=[["total",e.total,"Configured/observed",""],["online",e.online,"Online","teal"],["stale",e.stale,"Stale","orange"],["offline",e.offline,"Offline","red"],["unknown",e.unknown,"Never observed",""]].map(([a,s,i,c])=>`<article class="metric ${c}" data-status="${a}"><strong>${s}</strong><span>${i}</span></article>`).join(""),n("#thresholds").textContent=`Online < ${t.thresholds.online_under_seconds}s · stale to ${t.thresholds.offline_over_seconds}s · then offline`,n("#version").textContent=`VERSION ${t.software_version}`,$(t.simulation_faults,t.vehicles),A(t.services),R(t.vehicles)}async function w(t){if(!m){m=!0,document.querySelectorAll("#faultPanel button").forEach(e=>{e.disabled=!0}),n("#faultResult").textContent="Applying simulation fault…";try{const e=await F(t);o&&(o.simulation_faults=e),$(e,(o==null?void 0:o.vehicles)||[]),await _()}catch(e){n("#faultResult").textContent=`Failed: ${e.message}`}finally{m=!1,document.querySelectorAll("#faultPanel button").forEach(e=>{e.disabled=!1})}}}n("#faultVehicle").addEventListener("change",()=>{$(o==null?void 0:o.simulation_faults,(o==null?void 0:o.vehicles)||[])});n("#faultPanel").addEventListener("click",t=>{const e=t.target.closest("button");if(!e)return;const a=n("#faultVehicle").value;if(a)if(e.dataset.fault){const s=N(o==null?void 0:o.simulation_faults,a);w({action:"set",vehicle_id:a,fault:e.dataset.fault,enabled:!s.has(e.dataset.fault)})}else e.dataset.action&&w({action:e.dataset.action,vehicle_id:a})});let g=!1;async function _(){if(!g){g=!0;try{const t=await x();o=t,B(t),n("#connection").className="connection",n("#connection span").textContent=`Updated ${new Date(t.generated_at).toLocaleTimeString()}`}catch(t){n("#connection").className="connection error",n("#connection span").textContent=`Health unavailable · ${t.message}`}finally{g=!1}}}_();setInterval(_,2e3);
