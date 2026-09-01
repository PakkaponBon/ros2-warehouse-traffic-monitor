import"./modulepreload-polyfill-B5Qt9EMX.js";async function M(i){const t=await fetch(i,{cache:"no-store"}),s=await t.text();let e;try{e=s?JSON.parse(s):{}}catch{throw new Error(`API returned invalid JSON (${t.status})`)}if(!t.ok)throw new Error(e.error||t.statusText);return e}async function z(){const i=await M("/api/map");if(!Array.isArray(i.origin)||!i.width||!i.height||!i.resolution)throw new Error("Map metadata unavailable");return i}const U=()=>M("/api/bounds");async function q(i){const t=await M(`/api/state?${new URLSearchParams(i)}`);if(!Array.isArray(t.latest)||!Array.isArray(t.density))throw new Error("Traffic history unavailable");return t}const m=i=>String(i).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),Y=i=>i.vehicle_id==="my_robot"?`${m(i.vehicle_id)} <span class="tag">AMR</span>`:m(i.vehicle_id),C={moving:["Moving","moving"],turning:["Turning normally","turning"],waiting_vehicle:["Waiting for vehicle","waiting"],blocked_obstacle:["Blocked by obstacle","blocked"],stalled:["Commanded but not moving","blocked"],stuck:["Stuck","blocked"],idle:["Idle / intentional stop","idle"],planning:["Planning next route","idle"],localizing:["Waiting for localization","idle"],sensor_wait:["Waiting for LiDAR","idle"],unknown:["State unavailable","idle"]};function R(i){const t=i.speed>=.05?"moving":"unknown",s=i.motion_state||t,[e,o]=C[s]||C.unknown;return{state:s,label:e,className:o}}function G(i,t){var l;const s=t.latest.filter(c=>R(c).state==="moving").length,e=(l=t.localization)==null?void 0:l.summary,o=e!=null&&e.samples?`${e.mean_error.toFixed(2)} m`:"—";i.innerHTML=[["samples",t.samples.toLocaleString(),"Position samples",""],["vehicles",t.latest.length,"Active vehicles","teal"],["moving",s,"Moving now","teal"],["stuck",t.stuck.length,"Stuck hotspots","orange"],["congestion",t.congestion.length,"Congestion hotspots","red"],["localization",o,"Mean AMCL error","teal"]].map(c=>`<article class="metric ${c[3]}"><strong>${c[1]}</strong><span>${c[2]}</span></article>`).join("")}function J(i,t,s=[]){if(!t.length){i.innerHTML='<div class="empty">No fresh vehicle positions at the end of this range.</div>';return}i.innerHTML=t.map(e=>{const o=R(e),l=s.find(c=>c.vehicle_id===e.vehicle_id);return`<article class="vehicle-card vehicle-action" data-vehicle="${m(e.vehicle_id)}" role="button" tabindex="0" title="Show ${m(e.vehicle_id)} path on the map">
      <div class="vehicle-card-head"><strong><i class="status-dot ${o.className}"></i>${Y(e)}</strong>
        <b class="speed">${e.speed.toFixed(2)} m/s</b></div>
      <div class="vehicle-position">Position <b>x ${e.x.toFixed(2)} m</b><b>y ${e.y.toFixed(2)} m</b></div>
      ${l?`<div class="localization-error">LiDAR AMCL error <b>${l.latest_error.toFixed(2)} m</b></div>`:""}
      <small class="motion-state ${o.className}">● ${o.label}</small>
    </article>`}).join("")}function X(i,t){const s=t==null?void 0:t.summary,e=(t==null?void 0:t.vehicles)||[];if(!(s!=null&&s.samples)){i.innerHTML='<div class="empty">Waiting for AMCL and Gazebo comparison samples…</div>';return}const o=s.mean_yaw_error*180/Math.PI;i.innerHTML=`
    <div class="localization-overview">
      <div><strong>${s.mean_error.toFixed(2)} m</strong><small>Mean error</small></div>
      <div><strong>${s.rms_error.toFixed(2)} m</strong><small>RMS error</small></div>
      <div><strong>${s.max_error.toFixed(2)} m</strong><small>Maximum</small></div>
      <div><strong>${o.toFixed(1)}°</strong><small>Mean yaw error</small></div>
    </div>
    <div class="localization-list">${e.map(l=>`
      <div class="localization-row">
        <span><b>${m(l.vehicle_id)}</b><small>${l.samples} comparisons</small></span>
        <span><strong>${l.mean_error.toFixed(2)} m</strong><small>latest ${l.latest_error.toFixed(2)} m</small></span>
      </div>`).join("")}</div>`}function K(i,t){const s=(t==null?void 0:t.vehicles)||[],e=(t==null?void 0:t.summary)||{};if(!s.length){i.innerHTML=t!=null&&t.historical?'<div class="empty">No recorded UWB validation in this time range.</div>':'<div class="empty">Waiting for live UWB validation…</div>';return}const o={confirmed:["Confirmed","confirmed"],caution:["Caution","caution"],disagreement:["Disagreement","disagreement"],uwb_unavailable:["UWB unavailable","unavailable"],waiting_amcl:["Waiting for AMCL","unavailable"],unsynchronized:["Time mismatch","unavailable"]},l=(e.uwb_unavailable||0)+(e.waiting_amcl||0)+(e.unsynchronized||0),c=t.as_of?new Date(t.as_of).toLocaleString():null;i.innerHTML=`
    <div class="uwb-overview">
      <div><strong>${e.confirmed||0}</strong><small>Confirmed</small></div>
      <div><strong>${e.caution||0}</strong><small>Caution</small></div>
      <div><strong>${e.disagreement||0}</strong><small>Disagree</small></div>
      <div><strong>${l}</strong><small>Not compared</small></div>
    </div>
    <div class="uwb-list">${s.map(r=>{var p;const[d,h]=o[r.state]||["Unknown","unavailable"],u=Number.isFinite(r.error_m)?`${r.error_m.toFixed(2)} m difference`:r.state==="unsynchronized"&&Number.isFinite(r.measurement_skew_s)?`${r.measurement_skew_s.toFixed(2)} s time mismatch`:((p=r.uwb_reason)==null?void 0:p.replaceAll("_"," "))||"No comparison",g=r.raw_state&&r.raw_state!==r.state?` · checking ${r.raw_state.replaceAll("_"," ")}`:"";return`<div class="uwb-row">
        <span><b>${m(r.vehicle_id)}</b><small>${r.visible_tag_count||0} tags visible · ${m(u)}${m(g)}</small></span>
        <strong class="uwb-state ${h}">${d}</strong>
      </div>`}).join("")}</div>
    <p class="uwb-note">${t.live?"Live comparison":`Recorded comparison${c?` at ${c}`:""}`}. AMCL remains the position source; UWB is confirmation only.</p>`}function Q(i,t){const s=t==null?void 0:t.most_stuck_location,e=t==null?void 0:t.worst_path,o=(l,c)=>l?`${new Date(l*1e3).toLocaleString()} → ${new Date((c||l)*1e3).toLocaleString()}`:"No slow/stuck interval in this range";i.innerHTML=`
    <div class="insight-row ${s?"insight-action":""}" ${s?`data-insight="stuck" role="button" tabindex="0" data-x="${s.x}" data-y="${s.y}" data-events="${s.events}" data-first="${s.first_started||""}" data-last="${s.last_ended||""}"`:""}>
      <i class="insight-icon orange">!</i><div><b>Most stuck position</b><small>${s?`x ${s.x.toFixed(2)} · y ${s.y.toFixed(2)} · ${s.events} event(s)`:"No stuck position recorded"}</small>${s?`<em>${o(s.first_started,s.last_ended)}</em>`:""}</div>
    </div>
    <div class="insight-row ${e?"insight-action":""}" ${e?`data-insight="path" role="button" tabindex="0" data-vehicle="${m(e.vehicle_id)}"`:""}>
      <i class="insight-icon red">↝</i><div><b>Worst vehicle path</b><small>${e?`${m(e.vehicle_id)} · ${e.reason}`:"No vehicle path recorded"}</small>${e?`<em>${e.distance_m.toFixed(1)} m travelled · ${e.slow_seconds.toFixed(0)} s slow</em>`:""}</div>
    </div>
    <div class="insight-row ${e?"insight-action":""}" ${e?`data-insight="window" role="button" tabindex="0" data-vehicle="${m(e.vehicle_id)}"`:""}>
      <i class="insight-icon blue">◷</i><div><b>Bad path window</b><small>${e?o(e.bad_when_start,e.bad_when_end):"No bad interval found"}</small>${e?`<em>Average speed ${e.average_speed.toFixed(2)} m/s</em>`:""}</div>
    </div>`}function Z(i,t){const s=[...t.congestion.map(e=>({...e,type:"Congestion",color:"var(--red)"})),...t.stuck.map(e=>({...e,type:"Stuck",color:"var(--orange)"}))].sort((e,o)=>o.events-e.events).slice(0,6);i.innerHTML=s.length?s.map(e=>`<button type="button" class="hotspot-row" data-hotspot
    data-x="${e.x}" data-y="${e.y}" data-type="${e.type}"
    data-events="${e.events}" data-first="${e.first_started||""}" data-last="${e.last_ended||""}"
    title="Show ${e.type.toLowerCase()} location on the map">
    <span><b style="color:${e.color}">${e.type}</b><small>x ${e.x.toFixed(1)} · y ${e.y.toFixed(1)}</small></span>
    <span class="hotspot-count"><strong>${e.events}×</strong><small>View map</small></span>
  </button>`).join(""):'<div class="empty">No stuck or congestion events.</div>'}function _(i,t){const s=document.querySelector("#connection");s.classList.toggle("error",!i),s.querySelector("span").textContent=t}function F(i){const t=document.querySelector("#mode");t.textContent=i,t.className=`mode ${i.toLowerCase()}`}const E=["#8d6bff","#00a7d8","#ef7d50","#21a47b","#d45fc0","#789637","#d99924","#4a75dc","#d35c69"];class tt{constructor(t){this.canvas=t,this.ctx=t.getContext("2d"),this.info={origin:[-18.6,-26.3],resolution:.05,width:607,height:1004},this.image=null,this.hits=[],this.focused=null,this.focusedVehicle=null,this.lastData=null,this.lastOptions=null,this.rotated=!1,this.tooltip=document.querySelector("#mapTooltip"),t.addEventListener("mousemove",s=>this.showTooltip(s)),t.addEventListener("mouseleave",()=>{this.tooltip.style.display="none"})}async load(t,s="/map.png"){this.info=t,this.rotated=this.height()>this.width()*1.1,this.canvas.width=this.rotated?1600:1200;const e=this.rotated?this.width()/this.height():this.height()/this.width();return this.canvas.height=Math.max(1,Math.round(this.canvas.width*e)),new Promise(o=>{const l=new Image;l.onload=()=>{this.image=l,o()},l.onerror=()=>o(),l.src=`${s}?${Date.now()}`})}width(){return this.info.width*this.info.resolution}height(){return this.info.height*this.info.resolution}project(t,s){const e=(t-this.info.origin[0])/this.width(),o=(s-this.info.origin[1])/this.height();return this.rotated?{x:o*this.canvas.width,y:e*this.canvas.height}:{x:e*this.canvas.width,y:(1-o)*this.canvas.height}}drawGrid(){const{ctx:t,canvas:s}=this;t.fillStyle="#e9eef0",t.fillRect(0,0,s.width,s.height),this.image&&(this.rotated?(t.save(),t.translate(s.width,0),t.rotate(Math.PI/2),t.drawImage(this.image,0,0,s.height,s.width),t.restore()):t.drawImage(this.image,0,0,s.width,s.height)),t.fillStyle="#ffffff18",t.fillRect(0,0,s.width,s.height),t.strokeStyle="#aebbc499",t.lineWidth=1,t.font="11px system-ui",t.fillStyle="#536875";const e=this.width()>35?5:4,o=Math.ceil(this.info.origin[0]/e)*e,l=this.info.origin[0]+this.width();for(let d=o;d<=l;d+=e){const h=this.project(d,this.info.origin[1]),u=this.project(d,this.info.origin[1]+this.height());t.beginPath(),t.moveTo(h.x,h.y),t.lineTo(u.x,u.y),t.stroke(),this.rotated?t.fillText(`${d.toFixed(0)} m`,7,h.y-4):t.fillText(`${d.toFixed(0)} m`,h.x+4,s.height-8)}const c=Math.ceil(this.info.origin[1]/e)*e,r=this.info.origin[1]+this.height();for(let d=c;d<=r;d+=e){const h=this.project(this.info.origin[0],d),u=this.project(this.info.origin[0]+this.width(),d);t.beginPath(),t.moveTo(h.x,h.y),t.lineTo(u.x,u.y),t.stroke(),this.rotated?t.fillText(`${d.toFixed(0)} m`,h.x+4,s.height-8):t.fillText(`${d.toFixed(0)} m`,7,h.y-4)}t.strokeStyle="#43596a",t.lineWidth=7,t.strokeRect(4,4,s.width-8,s.height-8)}drawHeat(t,s,e="count"){if(!t.density.length)return;const o=t.density.map(h=>Number(h[e]||0)).sort((h,u)=>h-u),l=o[Math.floor((o.length-1)*s)]||0,c=Math.max(l+1,o[Math.floor((o.length-1)*.95)]||1),r=Math.log1p(l),d=Math.max(.001,Math.log1p(c)-r);t.density.forEach(h=>{const u=Number(h[e]||0);if(u<l)return;const g=Math.max(0,Math.min(1,(Math.log1p(u)-r)/d)),p=12+16*g,{x,y:w}=this.project(h.x,h.y),L=this.ctx.createRadialGradient(x,w,0,x,w,p),A=Math.round(210*(1-g));L.addColorStop(0,`hsla(${A}, 90%, 53%, ${.15+.4*g})`),L.addColorStop(1,`hsla(${A}, 90%, 53%, 0)`),this.ctx.fillStyle=L,this.ctx.beginPath(),this.ctx.arc(x,w,p,0,Math.PI*2),this.ctx.fill();const j=e==="vehicles"?`${u} unique vehicle(s)`:e==="slow_samples"?`${u} slow sample(s)`:`${u} occupancy sample(s)`;this.hits.push({x,y:w,radius:p,label:`${j} · average ${Number(h.average_speed||0).toFixed(2)} m/s`})})}trackColor(t){let s=0;for(const e of t)s=s*31+e.charCodeAt(0)>>>0;return E[s%E.length]}drawPaths(t){this.focusedVehicle&&(t.tracks||[]).forEach(s=>{if(s.points.length<2||this.focusedVehicle&&s.vehicle_id!==this.focusedVehicle)return;const e=this.focusedVehicle===s.vehicle_id;this.ctx.strokeStyle=this.trackColor(s.vehicle_id),this.ctx.lineWidth=e?4:2.5,this.ctx.lineCap="round",this.ctx.lineJoin="round",this.ctx.globalAlpha=.8,this.ctx.beginPath();let o=null;s.points.forEach(l=>{const c=Number(l[0]),r=Number(l[1]),d=Number(l[2]),h=Number.isFinite(c)&&Number.isFinite(r)&&Number.isFinite(d),u=o&&Math.hypot(c-o.x,r-o.y),g=!h||o&&(u>1.5||d-o.time>5);if(!h){o=null;return}const p=this.project(c,r);!o||g?this.ctx.moveTo(p.x,p.y):this.ctx.lineTo(p.x,p.y),o={x:c,y:r,time:d}}),this.ctx.stroke(),this.ctx.globalAlpha=1})}circle(t,s,e,o,l){const{x:c,y:r}=this.project(t.x,t.y);this.ctx.fillStyle=e,this.ctx.beginPath(),this.ctx.arc(c,r,s,0,Math.PI*2),this.ctx.fill(),l&&(this.ctx.strokeStyle=l,this.ctx.lineWidth=2,this.ctx.stroke()),this.hits.push({x:c,y:r,radius:Math.max(s,12),label:o})}drawVehicle(t){const{x:s,y:e}=this.project(t.x,t.y),o=t.motion_state||(t.speed<.05?"unknown":"moving"),l={moving:"#25d0ae",turning:"#3da4ff",waiting_vehicle:"#ffbf47",blocked_obstacle:"#ff6856",stalled:"#ff5263",stuck:"#ff5263",idle:"#91a7b9",planning:"#91a7b9",localizing:"#91a7b9",sensor_wait:"#91a7b9",unknown:"#91a7b9"},c=t.vehicle_id==="my_robot"?"#ffffff":l[o]||l.unknown;this.ctx.shadowColor="#07111a",this.ctx.shadowBlur=8,this.ctx.fillStyle=c,this.ctx.beginPath(),this.ctx.arc(s,e,9,0,Math.PI*2),this.ctx.fill(),this.ctx.shadowBlur=0,this.ctx.strokeStyle="#132638",this.ctx.lineWidth=2,this.ctx.stroke();const r=t.vehicle_id.replace("vehicle_","V");this.ctx.font="bold 11px system-ui";const d=this.ctx.measureText(r).width+10;this.ctx.fillStyle="#0b1825e8",this.ctx.fillRect(s-d/2,e-29,d,16),this.ctx.fillStyle="#f2f7fa",this.ctx.textAlign="center",this.ctx.fillText(r,s,e-17),this.ctx.textAlign="start",this.hits.push({x:s,y:e,radius:13,label:`${t.vehicle_id} · ${o.replaceAll("_"," ")} · ${t.speed.toFixed(2)} m/s · x ${t.x.toFixed(2)}, y ${t.y.toFixed(2)}`})}drawUwbTags(){(this.info.uwb_tags||[]).forEach(t=>{const{x:s,y:e}=this.project(Number(t.x),Number(t.y));this.ctx.save(),this.ctx.translate(s,e),this.ctx.rotate(Math.PI/4),this.ctx.globalAlpha=t.enabled===!1?.35:1,this.ctx.fillStyle="#f04df2",this.ctx.shadowColor="#f04df2",this.ctx.shadowBlur=10,this.ctx.fillRect(-7,-7,14,14),this.ctx.shadowBlur=0,this.ctx.strokeStyle="#53145f",this.ctx.lineWidth=2,this.ctx.strokeRect(-7,-7,14,14),this.ctx.restore(),this.ctx.font="bold 10px system-ui",this.ctx.fillStyle="#6e187c",this.ctx.textAlign="center",this.ctx.fillText(t.id,s,e-13),this.ctx.textAlign="start",this.hits.push({x:s,y:e,radius:14,label:`UWB tag ${t.id} · ${t.enabled===!1?"disabled":"enabled"} · battery ${Number(t.battery_pct??100).toFixed(0)}% · x ${Number(t.x).toFixed(1)}, y ${Number(t.y).toFixed(1)}, z ${Number(t.z).toFixed(1)} m`})})}draw(t,s){this.lastData=t,this.lastOptions=s,this.hits=[],this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height),this.drawGrid(),s.heat&&this.drawHeat(t,s.heatFilter,s.heatMetric),s.paths&&this.drawPaths(t),s.stuck&&t.stuck.slice(0,12).forEach(e=>this.circle(e,8+Math.min(10,Math.log2(e.events+1)*2),"#ffbf47cc",`${e.events} stuck event(s) · ${Math.round(e.duration)} seconds`,"#fff0bd")),s.congestion&&t.congestion.slice(0,12).forEach(e=>this.circle(e,10+Math.min(14,e.max_vehicles*2),"#ff5263b8",`${e.events} congestion event(s) · up to ${e.max_vehicles} vehicles`,"#ff9ba5")),s.vehicles&&(s.stateFilter==="all"?t.latest:t.latest.filter(o=>(o.motion_state||(o.speed<.05?"unknown":"moving"))===s.stateFilter)).forEach(o=>this.drawVehicle(o)),s.tags&&this.drawUwbTags(),this.drawFocus(),this.drawVehicleFocus(t)}focusAt(t){this.focused=t,this.focusedVehicle=null,this.lastData&&this.lastOptions&&this.draw(this.lastData,this.lastOptions)}focusVehicle(t){this.focused=null,this.focusedVehicle=t,this.lastData&&this.lastOptions&&this.draw(this.lastData,this.lastOptions)}drawFocus(){if(!this.focused||!Number.isFinite(Number(this.focused.x))||!Number.isFinite(Number(this.focused.y)))return;const{x:t,y:s}=this.project(Number(this.focused.x),Number(this.focused.y)),e=this.focused.type==="Congestion"?"#ff5263":"#ffbf47",o=`${this.focused.type} · ${this.focused.events} event(s)`;this.ctx.save(),this.ctx.strokeStyle=e,this.ctx.lineWidth=3,this.ctx.shadowColor=e,this.ctx.shadowBlur=14,this.ctx.beginPath(),this.ctx.arc(t,s,20,0,Math.PI*2),this.ctx.stroke(),this.ctx.shadowBlur=0,this.ctx.beginPath(),this.ctx.moveTo(t-30,s),this.ctx.lineTo(t+30,s),this.ctx.moveTo(t,s-30),this.ctx.lineTo(t,s+30),this.ctx.stroke(),this.ctx.font="bold 11px system-ui";const l=this.ctx.measureText(o).width+14;this.ctx.fillStyle="#07111aeb",this.ctx.fillRect(t-l/2,s+27,l,18),this.ctx.fillStyle="#f2f7fa",this.ctx.textAlign="center",this.ctx.fillText(o,t,s+40),this.ctx.textAlign="start",this.ctx.restore(),this.hits.push({x:t,y:s,radius:32,label:`${o} · x ${Number(this.focused.x).toFixed(2)}, y ${Number(this.focused.y).toFixed(2)}`})}drawVehicleFocus(t){var h;if(!this.focusedVehicle)return;const s=(t.latest||[]).find(u=>u.vehicle_id===this.focusedVehicle),e=(t.tracks||[]).find(u=>u.vehicle_id===this.focusedVehicle),o=s||((h=e==null?void 0:e.points)!=null&&h.length?{x:e.points.at(-1)[0],y:e.points.at(-1)[1]}:null);if(!o)return;const{x:l,y:c}=this.project(Number(o.x),Number(o.y));this.ctx.save(),this.ctx.strokeStyle="#b06cff",this.ctx.lineWidth=3,this.ctx.shadowColor="#b06cff",this.ctx.shadowBlur=16,this.ctx.beginPath(),this.ctx.arc(l,c,22,0,Math.PI*2),this.ctx.stroke(),this.ctx.shadowBlur=0,this.ctx.font="bold 11px system-ui";const r=`${this.focusedVehicle} path`,d=this.ctx.measureText(r).width+14;this.ctx.fillStyle="#07111aeb",this.ctx.fillRect(l-d/2,c+28,d,18),this.ctx.fillStyle="#f2f7fa",this.ctx.textAlign="center",this.ctx.fillText(r,l,c+41),this.ctx.textAlign="start",this.ctx.restore(),this.hits.push({x:l,y:c,radius:34,label:`${r} · x ${Number(o.x).toFixed(2)}, y ${Number(o.y).toFixed(2)}`})}showTooltip(t){const s=this.canvas.getBoundingClientRect(),e=(t.clientX-s.left)*this.canvas.width/s.width,o=(t.clientY-s.top)*this.canvas.height/s.height,l=this.hits.slice().reverse().find(c=>Math.hypot(c.x-e,c.y-o)<=c.radius);if(!l){this.tooltip.style.display="none";return}this.tooltip.textContent=l.label,this.tooltip.style.display="block",this.tooltip.style.left=`${t.clientX-s.left+14}px`,this.tooltip.style.top=`${t.clientY-s.top+14}px`}}const et=document.querySelector("#app");et.innerHTML=`
  <header class="topbar">
    <div class="brand">
      <div class="logo">W</div>
      <div>
        <strong>Warehouse Intelligence</strong>
        <small>Traffic analytics and vehicle monitoring</small>
      </div>
    </div>
    <div id="connection" class="connection">
      <i></i>
      <span>Connecting…</span>
    </div>
  </header>

  <section class="toolbar">
    <div class="control-row">
      <button id="liveButton" class="secondary">● Live now</button>

      <label class="field">
        <span>Replay starts at</span>
        <input id="selectedTime" type="datetime-local" step="1">
      </label>

      <button id="jumpButton" class="secondary">Jump to time</button>
      <button id="playButton">▶ Play to latest</button>

      <label class="field">
        <span>Playback speed</span>
        <select id="playSpeed">
          <option value="1">1× realtime</option>
          <option value="10">10×</option>
          <option value="60" selected>60×</option>
          <option value="300">300×</option>
        </select>
      </label>

      <label class="field">
        <span>Heat trail</span>
        <select id="trailMinutes">
          <option value="1">1 minute</option>
          <option value="5" selected>5 minutes</option>
          <option value="15">15 minutes</option>
          <option value="60">1 hour</option>
        </select>
      </label>

      <details class="advanced">
        <summary>Custom range</summary>
        <div class="advanced-range">
          <label class="field">
            <span>From</span>
            <input id="rangeStart" type="datetime-local" step="1">
          </label>
          <label class="field">
            <span>To</span>
            <input id="rangeEnd" type="datetime-local" step="1">
          </label>
          <button id="applyRange">Apply</button>
        </div>
      </details>

      <span id="mode" class="mode">LIVE</span>
    </div>

    <div class="timeline-row">
      <span id="firstLog">First log —</span>
      <input id="timeline" type="range" min="0" max="1" value="1" step="0.5">
      <span id="replayClock">Loading history…</span>
      <span id="lastLog">Latest log —</span>
    </div>
  </section>

  <main>
    <section id="metrics" class="metrics"></section>

    <section class="panel summary-panel">
      <div class="panel-head">
        <div>
          <h2>Vehicle summary</h2>
          <span class="sub">Current name, map position, speed, and movement state</span>
        </div>
        <span class="tag">MAP FRAME</span>
      </div>
      <div id="summaryRows" class="summary-grid">
        <div class="empty">Waiting for vehicle data…</div>
      </div>
    </section>

    <div class="content-grid">
      <section class="panel map-panel">
        <div class="panel-head">
          <div>
            <h2>Warehouse traffic map</h2>
            <span class="sub">Landscape display · positions remain in the ROS map frame</span>
          </div>

          <div class="map-tools">
            <label><input id="pathLayer" type="checkbox"> Selected path</label>
            <label><input id="vehicleLayer" type="checkbox" checked> Positions</label>
            <label><input id="densityLayer" type="checkbox" checked> Heat</label>
            <label><input id="stuckLayer" type="checkbox"> Stuck</label>
            <label><input id="jamLayer" type="checkbox"> Congestion</label>
            <label><input id="tagLayer" type="checkbox" checked> UWB tags</label>
            <label class="state-filter">
              Vehicle state
              <select id="stateFilter">
                <option value="all">All states</option>
                <option value="moving">Moving</option>
                <option value="turning">Turning normally</option>
                <option value="waiting_vehicle">Waiting for vehicle</option>
                <option value="blocked_obstacle">Blocked by obstacle</option>
                <option value="stalled">Commanded but not moving</option>
                <option value="stuck">Stuck</option>
                <option value="idle">Idle / intentional stop</option>
                <option value="planning">Planning route</option>
                <option value="localizing">Localizing</option>
                <option value="sensor_wait">Waiting for LiDAR</option>
              </select>
            </label>
            <label>
              Heat metric
              <select id="heatMetric">
                <option value="count">Occupancy time</option>
                <option value="vehicles">Unique vehicles</option>
                <option value="slow_samples">Slow time</option>
              </select>
            </label>
            <label class="heat-control">
              Less heat
              <input id="heatFilter" type="range" min="0" max="95" value="78">
            </label>
          </div>
        </div>

        <div class="map-wrap">
          <canvas id="map" width="1200" height="720"></canvas>
          <div id="mapTooltip" class="tooltip"></div>
        </div>

        <div class="map-foot">
          <div class="legend">
            <span><i class="dot path"></i>vehicle path</span>
            <span><i class="dot low"></i>low traffic</span>
            <span><i class="dot high"></i>high traffic</span>
            <span><i class="dot stuck"></i>stuck</span>
            <span><i class="dot congestion"></i>congestion</span>
            <span><i class="dot vehicle"></i>position</span>
            <span><i class="dot uwb"></i>UWB tag</span>
          </div>
          <div class="state-legend" aria-label="Vehicle state legend">
            <span><i class="state-dot moving"></i>moving</span>
            <span><i class="state-dot turning"></i>turning</span>
            <span><i class="state-dot waiting"></i>waiting</span>
            <span><i class="state-dot blocked"></i>blocked / stuck</span>
            <span><i class="state-dot idle"></i>idle / system</span>
          </div>
          <span id="mapFocus" class="map-focus">Select a hotspot to locate it</span>
          <span id="range" class="range">Loading…</span>
        </div>
      </section>

      <aside class="side-column">
        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>2D LiDAR localization</h2>
              <span class="sub">AMCL estimate compared with Gazebo truth</span>
            </div>
            <span class="tag">NO IMU</span>
          </div>
          <div id="localization" class="localization-panel">
            <div class="empty">Waiting for localization samples…</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>UWB localization validation</h2>
              <span class="sub">Time-aligned UWB and AMCL comparison</span>
            </div>
            <span class="tag">CHECK ONLY</span>
          </div>
          <div id="uwbValidation" class="uwb-validation">
            <div class="empty">Waiting for UWB validation…</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>Traffic insights</h2>
              <span class="sub">What needs attention in this time range</span>
            </div>
          </div>
          <div id="analytics" class="analytics">
            <div class="empty">Waiting for history data…</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>Top hotspots</h2>
              <span class="sub">Highest event counts in this range</span>
            </div>
          </div>
          <div id="hotspots" class="hotspots">
            <div class="empty">No hotspots found.</div>
          </div>
        </section>
      </aside>
    </div>
  </main>
`;const n=i=>document.querySelector(i),f=new tt(n("#map")),a={data:null,bounds:null,cursor:null,auto:!0,loading:!1,playing:!1,playbackEnd:null,playbackStart:null,lastTick:0,debounce:null,selectedHotspot:null,selectedVehicle:null},V={samples:0,latest:[],density:[],tracks:[],stuck:[],congestion:[],start:new Date().toISOString(),end:new Date().toISOString(),analytics:{},localization:{summary:{samples:0},vehicles:[]},uwb_validation:{live:!0,summary:{},vehicles:[]}};function y(i){return new Date(i.getTime()-i.getTimezoneOffset()*6e4).toISOString().slice(0,19)}function T(i){n("#selectedTime").value=y(new Date(i*1e3))}function $(i){i!==null&&(n("#timeline").value=i,n("#replayClock").textContent=new Date(i*1e3).toLocaleString())}function D(i){return a.bounds?Math.max(a.bounds.first,Math.min(a.bounds.last,i)):i}function I(){return{paths:n("#pathLayer").checked,vehicles:n("#vehicleLayer").checked,heat:n("#densityLayer").checked,heatMetric:n("#heatMetric").value,stuck:n("#stuckLayer").checked,congestion:n("#jamLayer").checked,tags:n("#tagLayer").checked,stateFilter:n("#stateFilter").value,heatFilter:Number(n("#heatFilter").value)/100}}function k(){a.data&&f.draw(a.data,I())}function W(i){var t;if(a.data=i,G(n("#metrics"),i),J(n("#summaryRows"),i.latest,((t=i.localization)==null?void 0:t.vehicles)||[]),X(n("#localization"),i.localization),K(n("#uwbValidation"),i.uwb_validation),a.selectedVehicle){const s=[...document.querySelectorAll("#summaryRows [data-vehicle]")].find(e=>e.dataset.vehicle===a.selectedVehicle);s&&s.classList.add("selected")}if(Q(n("#analytics"),i.analytics),Z(n("#hotspots"),i),a.selectedHotspot){const s=[...document.querySelectorAll("#hotspots [data-hotspot]")].find(e=>Math.abs(Number(e.dataset.x)-a.selectedHotspot.x)<.001&&Math.abs(Number(e.dataset.y)-a.selectedHotspot.y)<.001&&e.dataset.type===a.selectedHotspot.type);s&&s.classList.add("selected")}n("#range").textContent=i.samples?`${new Date(i.start).toLocaleString()} — ${new Date(i.end).toLocaleString()}`:"Waiting for ROS traffic history",k()}async function N(i){if(!a.loading){a.loading=!0;try{W(await q(i)),_(!0,`Updated ${new Date().toLocaleTimeString()}`)}catch(t){_(!1,`Monitor offline · ${t.message}`)}finally{a.loading=!1}}}async function P(i=!1){try{const t=await U();if(t.empty){n("#replayClock").textContent="No recorded history";return}const s=a.bounds===null;a.bounds=t,n("#timeline").min=t.first,n("#timeline").max=t.last,n("#selectedTime").min=y(new Date(t.first*1e3)),n("#selectedTime").max=y(new Date(t.last*1e3)),n("#firstLog").textContent=`First ${new Date(t.first*1e3).toLocaleString()}`,n("#lastLog").textContent=`Latest ${new Date(t.last*1e3).toLocaleString()}`,(i||s||!n("#selectedTime").value)&&(a.cursor=t.last,T(Math.max(t.first,t.last-300)),n("#rangeStart").value=y(new Date(t.first*1e3)),n("#rangeEnd").value=y(new Date(t.last*1e3))),(a.cursor===null||a.auto)&&(a.cursor=t.last),$(a.cursor)}catch{n("#replayClock").textContent="History unavailable"}}function v(i="PAUSED"){a.playing=!1,a.lastTick=0,n("#playButton").textContent="▶ Play to latest",n("#playButton").className="",i&&F(i)}function b(i){if(!a.bounds)return;a.auto=!1,a.cursor=D(i),$(a.cursor);const t=Number(n("#trailMinutes").value)*60,s=a.playing&&a.playbackStart!==null?a.playbackStart:Math.max(a.bounds.first,a.cursor-t),e=Math.min(a.cursor-.001,s);N({start:new Date(e*1e3).toISOString(),end:new Date(a.cursor*1e3).toISOString()})}function S(){v(null),a.auto=!0,a.playbackStart=null,F("LIVE"),a.bounds&&(a.cursor=a.bounds.last,$(a.cursor)),N({hours:Number(n("#trailMinutes").value)/60})}function st(){v("HISTORY");const i=n("#selectedTime").value;i&&b(new Date(i).getTime()/1e3)}function it(){if(a.playing){v();return}if(!a.bounds)return;a.auto=!1;const i=new Date(n("#selectedTime").value).getTime()/1e3;a.cursor=D(Number.isFinite(i)?i:a.bounds.first),a.playbackStart=a.cursor,a.playbackEnd=a.bounds.last,a.playing=!0,a.lastTick=performance.now(),F("REPLAY"),n("#playButton").textContent="❚❚ Pause replay",n("#playButton").className="playing",b(a.cursor)}function at(){if(!a.playing)return;const i=performance.now();if(a.loading){a.lastTick=i;return}const t=Math.min(2,(i-a.lastTick)/1e3);a.lastTick=i,a.cursor=Math.min(a.playbackEnd,a.cursor+t*Number(n("#playSpeed").value)),T(a.cursor),b(a.cursor),a.cursor>=a.playbackEnd&&v("HISTORY")}function ot(){const i=n("#rangeStart").value,t=n("#rangeEnd").value;!i||!t||(v("HISTORY"),a.auto=!1,N({start:new Date(i).toISOString(),end:new Date(t).toISOString()}))}n("#liveButton").addEventListener("click",S);n("#jumpButton").addEventListener("click",st);n("#playButton").addEventListener("click",it);n("#applyRange").addEventListener("click",ot);n("#stateFilter").addEventListener("change",k);function B(i){var s,e;a.selectedVehicle=i.dataset.vehicle,a.selectedHotspot=null,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(o=>{o.classList.toggle("selected",o===i)}),document.querySelectorAll("#hotspots [data-hotspot]").forEach(o=>o.classList.remove("selected")),n("#pathLayer").checked=!0,f.focusVehicle(a.selectedVehicle);const t=(e=(s=a.data)==null?void 0:s.latest)==null?void 0:e.find(o=>o.vehicle_id===a.selectedVehicle);n("#mapFocus").textContent=t?`${a.selectedVehicle} path · x ${t.x.toFixed(1)} · y ${t.y.toFixed(1)} · ${t.speed.toFixed(2)} m/s`:`${a.selectedVehicle} path`,n(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})}n("#summaryRows").addEventListener("click",i=>{const t=i.target.closest("[data-vehicle]");t&&B(t)});n("#summaryRows").addEventListener("keydown",i=>{if(i.key!=="Enter"&&i.key!==" ")return;const t=i.target.closest("[data-vehicle]");t&&(i.preventDefault(),B(t))});n("#hotspots").addEventListener("click",i=>{const t=i.target.closest("[data-hotspot]");if(!t)return;a.selectedVehicle=null,n("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(e=>e.classList.remove("selected")),a.selectedHotspot={x:Number(t.dataset.x),y:Number(t.dataset.y),type:t.dataset.type,events:Number(t.dataset.events),first_started:Number(t.dataset.first)||null,last_ended:Number(t.dataset.last)||null},document.querySelectorAll("#hotspots [data-hotspot]").forEach(e=>{e.classList.toggle("selected",e===t)}),f.focusAt(a.selectedHotspot);const s=a.selectedHotspot.first_started?`${new Date(a.selectedHotspot.first_started*1e3).toLocaleString()} → ${new Date((a.selectedHotspot.last_ended||a.selectedHotspot.first_started)*1e3).toLocaleString()}`:"time unavailable";n("#mapFocus").textContent=`${a.selectedHotspot.type} · x ${a.selectedHotspot.x.toFixed(1)} · y ${a.selectedHotspot.y.toFixed(1)} · ${a.selectedHotspot.events} event(s) · ${s}`,n(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})});function O(i){var t,s;if(i.dataset.insight==="stuck")a.selectedVehicle=null,n("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(e=>e.classList.remove("selected")),a.selectedHotspot={x:Number(i.dataset.x),y:Number(i.dataset.y),type:"Stuck",events:Number(i.dataset.events),first_started:Number(i.dataset.first)||null,last_ended:Number(i.dataset.last)||null},f.focusAt(a.selectedHotspot),n("#mapFocus").textContent=`Stuck · x ${a.selectedHotspot.x.toFixed(1)} · y ${a.selectedHotspot.y.toFixed(1)} · ${a.selectedHotspot.events} event(s)`;else{const e=i.dataset.vehicle,o=(s=(t=a.data)==null?void 0:t.analytics)==null?void 0:s.worst_path;a.selectedVehicle=e,a.selectedHotspot=null,n("#pathLayer").checked=!0,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(l=>{l.classList.toggle("selected",l.dataset.vehicle===e)}),document.querySelectorAll("#hotspots [data-hotspot]").forEach(l=>l.classList.remove("selected")),f.focusVehicle(e),n("#mapFocus").textContent=`${e} path · ${i.dataset.insight==="window"?"bad interval":"worst path"}${o?` · ${o.slow_seconds.toFixed(0)} s slow`:""}`}n(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})}n("#analytics").addEventListener("click",i=>{const t=i.target.closest("[data-insight]");t&&O(t)});n("#analytics").addEventListener("keydown",i=>{if(i.key!=="Enter"&&i.key!==" ")return;const t=i.target.closest("[data-insight]");t&&(i.preventDefault(),O(t))});["pathLayer","vehicleLayer","densityLayer","stuckLayer","jamLayer","tagLayer","heatMetric","heatFilter"].forEach(i=>n(`#${i}`).addEventListener("input",k));n("#trailMinutes").addEventListener("change",()=>a.auto?S():a.cursor!==null&&b(a.cursor));["selectedTime","rangeStart","rangeEnd"].forEach(i=>n(`#${i}`).addEventListener("focus",()=>{a.auto=!1,v("PAUSED")}));n("#timeline").addEventListener("input",i=>{a.auto=!1,v("HISTORY"),a.cursor=Number(i.target.value),T(a.cursor),$(a.cursor),clearTimeout(a.debounce),a.debounce=setTimeout(()=>b(a.cursor),120)});async function nt(){W(V);try{await f.load(await z()),k()}catch{await f.load(f.info,"/fallback-map.png"),f.draw(V,I()),_(!1,"Map preview · ROS monitor offline")}await P(!0),S()}nt();setInterval(at,400);let H=0;setInterval(()=>{a.auto&&S(),H+=1,H%5===0&&P()},2e3);
