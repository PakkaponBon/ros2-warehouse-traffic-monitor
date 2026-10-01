import"./modulepreload-polyfill-B5Qt9EMX.js";import{a as de,b as he,c as ue,d as pe}from"./api-DVuqMfkU.js";const me=[-25.3,-13.4,0],ve=.05,fe=939,ye=535,ge={origin:me,resolution:ve,width:fe,height:ye},v=s=>String(s??"—").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e]),be={idle:["Waiting for a job",-1],to_pickup:["Going to pickup",0],loading:["Loading cargo",1],to_dropoff:["Delivering cargo",2],unloading:["Unloading cargo",3]},xe={moving:"Moving",turning:"Turning",waiting_vehicle:"Giving way",blocked_obstacle:"Obstacle ahead",stalled:"Unable to move",stuck:"Stuck",loading:"Loading",unloading:"Unloading",localizing:"Locating vehicle",sensor_wait:"Waiting for sensor",planning:"Planning route",idle:"Idle"};function D(s){const[e,i]=be[s]||["Status unavailable",-1];return{label:e,step:i}}function T(s,e){var i,t;return((t=(i=s==null?void 0:s.stations)==null?void 0:i.find(o=>o.id===e))==null?void 0:t.label)||e||"—"}function we(s,e=!0){return!e||!(s!=null&&s.online)?null:{vehicles:s.vehicles.length,active:s.vehicles.filter(i=>i.task_id&&i.phase!=="idle").length,completed:s.vehicles.reduce((i,t)=>i+Number(t.completed_jobs||0),0),queued:s.pending_jobs??null}}function ke(s,e,i){const t=we(e,i);s.innerHTML=[["Forklifts online",t==null?void 0:t.vehicles,"Live delivery fleet",""],["Active deliveries",t==null?void 0:t.active,"Pickup, loading, delivery & unloading","teal"],["Deliveries completed",t==null?void 0:t.completed,"Since this fleet session started","teal"],["Jobs queued",t==null?void 0:t.queued,"Waiting for an available forklift","orange"]].map(([o,l,r,d])=>`<article class="metric ${d}">
    <span>${o}</span><strong>${l==null?"—":l.toLocaleString()}</strong>
    <small>${t?r:"Waiting for live fleet updates"}</small>
  </article>`).join("")}function Y(s){return`<span class="cargo-badge ${s.carrying?"loaded":""}">${s.carrying?"Carrying cargo":"Empty"}</span>`}function Z(s){const{label:e,step:i}=D(s.phase);return`<div class="delivery-progress" aria-label="${v(e)}">${["Pickup","Load","Deliver","Unload"].map((t,o)=>`<span class="${o<i?"done":o===i?"current":""}" ${o===i?'aria-current="step"':""}><i aria-hidden="true"></i>${t}</span>`).join("")}</div>`}function $e(s,e,i,t){s.innerHTML=i.vehicles.map(o=>{const l=e.find(u=>u.vehicle_id===o.vehicle_id),r=Number.isFinite(l==null?void 0:l.speed)?`${l.speed.toFixed(2)} m/s`:"Speed unavailable",d=D(o.phase),c=xe[o.motion_state]||"Status unavailable",h=["blocked_obstacle","stalled","stuck"].includes(o.motion_state);return`<article class="vehicle-card vehicle-action delivery-vehicle ${t===o.vehicle_id?"selected":""}" data-vehicle="${v(o.vehicle_id)}" tabindex="0" role="button" aria-label="Locate ${v(o.vehicle_id)} on the map">
      <div class="vehicle-card-head"><strong><i class="status-dot ${h?"blocked":""}"></i>${v(o.vehicle_id.replace("vehicle_","Forklift "))}</strong><b class="speed">${r}</b></div>
      <div class="delivery-vehicle-route"><span>${v(T(i,o.pickup))}</span><b aria-hidden="true">→</b><span>${v(T(i,o.dropoff))}</span></div>
      ${Z(o)}
      <div class="delivery-vehicle-foot"><small>${v(d.label)}</small>${Y(o)}</div>
      <small class="delivery-motion ${h?"blocked":""}">${c} · ${Number(o.completed_jobs||0)} delivered</small>
      ${l?`<div class="vehicle-position">Position <b>x ${l.x.toFixed(2)} m</b><b>y ${l.y.toFixed(2)} m</b></div>`:""}
    </article>`}).join("")||'<div class="empty">Waiting for vehicles to join the fleet.</div>'}function Se(s,e,i){if(!i||!(e!=null&&e.online)){s.innerHTML='<tr><td colspan="6" class="empty">Waiting for live delivery updates.</td></tr>';return}s.innerHTML=e.vehicles.map(t=>`<tr>
    <td><button type="button" class="text-button" data-delivery-vehicle="${v(t.vehicle_id)}">${v(t.vehicle_id.replace("vehicle_","Forklift "))} ↗</button></td>
    <td><span class="delivery-job-id">${v(t.task_id)}</span></td>
    <td><div class="delivery-job-route"><span>${v(T(e,t.pickup))}</span><span>→ ${v(T(e,t.dropoff))}</span></div></td>
    <td>${Z(t)}<small>${v(D(t.phase).label)}</small></td>
    <td>${Y(t)}</td><td>${Number(t.completed_jobs||0).toLocaleString()}</td>
  </tr>`).join("")||'<tr><td colspan="6" class="empty">No delivery jobs have been assigned yet.</td></tr>'}function Le(s,e){s.innerHTML=((e==null?void 0:e.stations)||[]).map((i,t)=>{const o=e.online?e.vehicles.filter(r=>r.task_id&&(r.pickup===i.id||r.dropoff===i.id)):[],l=o.some(r=>r.phase==="loading"&&r.pickup===i.id||r.phase==="unloading"&&r.dropoff===i.id);return`<article class="delivery-station"><span class="station-number">${String(t+1).padStart(2,"0")}</span><div><h3>${v(i.label)}</h3><p>${e.online?l?"Loading / unloading":o.length?`${o.length} assigned ${o.length===1?"delivery":"deliveries"}`:"Available":"Status unavailable"}</p></div><i class="station-availability ${e.online?l?"busy":"":"unknown"}" aria-hidden="true"></i></article>`}).join("")||'<div class="empty">Docking points will appear when the fleet connects.</div>'}const f=s=>String(s).replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e]),Ne=s=>s.vehicle_id==="my_robot"?`${f(s.vehicle_id)} <span class="tag">AMR</span>`:f(s.vehicle_id),B={moving:["Moving","moving"],side_task:["Travelling to side task","moving"],returning_route:["Returning to normal route","moving"],side_work:["Performing side work","waiting"],loading:["Loading cargo","waiting"],unloading:["Unloading cargo","waiting"],task_planning:["Planning side-task route","idle"],turning:["Turning normally","turning"],waiting_vehicle:["Waiting for vehicle","waiting"],blocked_obstacle:["Blocked by obstacle","blocked"],stalled:["Commanded but not moving","blocked"],stuck:["Stuck","blocked"],idle:["Idle / intentional stop","idle"],planning:["Planning next route","idle"],localizing:["Waiting for localization","idle"],sensor_wait:["Waiting for LiDAR","idle"],unknown:["State unavailable","idle"]};function X(s){const e=s.speed>=.05?"moving":"unknown",i=s.motion_state||e,[t,o]=B[i]||B.unknown;return{state:i,label:t,className:o}}function Ce(s,e){const i=e.latest.filter(t=>X(t).className==="moving").length;s.innerHTML=[["vehicles",e.latest.length,"Vehicles tracked","","At the end of this window"],["moving",i,"Moving","teal","At the end of this window"],["stuck",e.stuck.length,"Stuck locations","orange","In this traffic window"],["congestion",e.congestion.length,"Congestion areas","red","In this traffic window"]].map(t=>`<article class="metric ${t[3]}"><span>${t[2]}</span><strong>${t[1]}</strong><small>${t[4]}</small></article>`).join("")}function _e(s,e,i=[]){if(!e.length){s.innerHTML='<div class="empty">No fresh vehicle positions at the end of this range.</div>';return}s.innerHTML=e.map(t=>{const o=X(t),l=i.find(r=>r.vehicle_id===t.vehicle_id);return`<article class="vehicle-card vehicle-action" data-vehicle="${f(t.vehicle_id)}" role="button" tabindex="0" title="Show ${f(t.vehicle_id)} path on the map">
      <div class="vehicle-card-head"><strong><i class="status-dot ${o.className}"></i>${Ne(t)}</strong>
        <b class="speed">${t.speed.toFixed(2)} m/s</b></div>
      <div class="vehicle-position">Position <b>x ${t.x.toFixed(2)} m</b><b>y ${t.y.toFixed(2)} m</b></div>
      ${l?`<div class="localization-error">LiDAR AMCL error <b>${l.latest_error.toFixed(2)} m</b></div>`:""}
      <small class="motion-state ${o.className}">● ${o.label}</small>
    </article>`}).join("")}function Me(s,e){const i=e==null?void 0:e.summary,t=(e==null?void 0:e.vehicles)||[];if(!(i!=null&&i.samples)){s.innerHTML='<div class="empty">Waiting for AMCL and Gazebo comparison samples…</div>';return}const o=i.mean_yaw_error*180/Math.PI;s.innerHTML=`
    <div class="localization-overview">
      <div><strong>${i.mean_error.toFixed(2)} m</strong><small>Mean error</small></div>
      <div><strong>${i.rms_error.toFixed(2)} m</strong><small>RMS error</small></div>
      <div><strong>${i.max_error.toFixed(2)} m</strong><small>Maximum</small></div>
      <div><strong>${o.toFixed(1)}°</strong><small>Mean yaw error</small></div>
    </div>
    <div class="localization-list">${t.map(l=>`
      <div class="localization-row">
        <span><b>${f(l.vehicle_id)}</b><small>${l.samples} comparisons</small></span>
        <span><strong>${l.mean_error.toFixed(2)} m</strong><small>latest ${l.latest_error.toFixed(2)} m</small></span>
      </div>`).join("")}</div>`}function Te(s,e){const i=e==null?void 0:e.most_stuck_location,t=e==null?void 0:e.worst_path,o=(l,r)=>l?`${new Date(l*1e3).toLocaleString()} → ${new Date((r||l)*1e3).toLocaleString()}`:"No slow/stuck interval in this range";s.innerHTML=`
    <div class="insight-row ${i?"insight-action":""}" ${i?`data-insight="stuck" role="button" tabindex="0" data-x="${i.x}" data-y="${i.y}" data-events="${i.events}" data-first="${i.first_started||""}" data-last="${i.last_ended||""}"`:""}>
      <i class="insight-icon orange">!</i><div><b>Most frequent stop</b><small>${i?`x ${i.x.toFixed(2)} · y ${i.y.toFixed(2)} · ${i.events} event(s)`:"No stuck position recorded"}</small>${i?`<em>${o(i.first_started,i.last_ended)}</em>`:""}</div>
    </div>
    <div class="insight-row ${t?"insight-action":""}" ${t?`data-insight="path" role="button" tabindex="0" data-vehicle="${f(t.vehicle_id)}"`:""}>
      <i class="insight-icon red">↝</i><div><b>Route with most delays</b><small>${t?`${f(t.vehicle_id)} · ${t.reason}`:"No vehicle path recorded"}</small>${t?`<em>${t.distance_m.toFixed(1)} m travelled · ${t.slow_seconds.toFixed(0)} s slow</em>`:""}</div>
    </div>
    <div class="insight-row ${t?"insight-action":""}" ${t?`data-insight="window" role="button" tabindex="0" data-vehicle="${f(t.vehicle_id)}"`:""}>
      <i class="insight-icon blue">◷</i><div><b>When delays happened</b><small>${t?o(t.bad_when_start,t.bad_when_end):"No delay interval recorded"}</small>${t?`<em>Average speed ${t.average_speed.toFixed(2)} m/s</em>`:""}</div>
    </div>`}function P(s,e,i="count"){var S,j,W;if(!e){s.innerHTML='<div class="empty">Click a colored heat spot on the map to see its detailed summary.</div>';return}const t={count:["Position samples","samples"],vehicles:["Unique vehicles","vehicles"],slow_samples:["Slow samples","slow samples"]},[o,l]=t[i]||t.count,r=(j=(S=e.time_details)==null?void 0:S.peaks)==null?void 0:j[i],d=(W=e.time_details)==null?void 0:W.stuck,c=x=>x?`${new Date(x.start*1e3).toLocaleString()} → ${new Date(x.end*1e3).toLocaleString()}`:"No peak time available",h=(r==null?void 0:r.vehicle_ids)||[],u=((r==null?void 0:r.slow_vehicle_states)||[]).map(x=>`${f(x.vehicle_id)} (${x.states.map(ce=>f(ce.replaceAll("_"," "))).join(", ")})`),p=new Set((r==null?void 0:r.slow_vehicle_ids)||[]),y=h.filter(x=>!p.has(x)),b=r?Number(r[i]||0):"—",$=d!=null&&d.events?`${d.events} event(s), ${d.vehicles} vehicle(s)${d.peak?` · busiest ${c(d.peak)}`:""}`:"None in this selected time range";s.innerHTML=`<div class="heat-area-summary">
    <div class="heat-area-location"><b>Map area</b><span>x ${Number(e.x).toFixed(1)} m · y ${Number(e.y).toFixed(1)} m</span></div>
    <div class="heat-area-grid">
      <div><small>${o}</small><strong>${Number(e[i]||0)}</strong><span>whole selected range</span></div>
      <div><small>Average speed</small><strong>${Number(e.average_speed||0).toFixed(2)} m/s</strong><span>in this area</span></div>
      <div><small>Busiest period</small><strong>${b}</strong><span>${l}</span></div>
      <div><small>Slow at busiest time</small><strong>${r?Number(r.slow_samples||0):"—"}</strong><span>samples</span></div>
    </div>
    <dl class="heat-area-details">
      <div><dt>Busiest time</dt><dd>${c(r)}</dd></div>
      <div><dt>Vehicles there</dt><dd>${h.length?h.map(f).join(", "):"None recorded"}</dd></div>
      <div><dt>Slow or waiting</dt><dd>${u.length?u.join(", "):"None recorded"}</dd></div>
      <div><dt>Moving normally</dt><dd>${y.length?y.map(f).join(", "):"None recorded"}</dd></div>
      <div><dt>Confirmed stuck</dt><dd>${$}</dd></div>
    </dl>
  </div>`}function Ee(s,e){const i=[...e.congestion.map(t=>({...t,type:"Congestion",color:"var(--red)"})),...e.stuck.map(t=>({...t,type:"Stuck",color:"var(--orange)"}))].sort((t,o)=>o.events-t.events).slice(0,6);s.innerHTML=i.length?i.map(t=>`<button type="button" class="hotspot-row" data-hotspot
    data-x="${t.x}" data-y="${t.y}" data-type="${t.type}"
    data-events="${t.events}" data-first="${t.first_started||""}" data-last="${t.last_ended||""}"
    title="Show ${t.type.toLowerCase()} location on the map">
    <span><b style="color:${t.color}">${t.type}</b><small>x ${t.x.toFixed(1)} · y ${t.y.toFixed(1)}</small></span>
    <span class="hotspot-count"><strong>${t.events}×</strong><small>View map</small></span>
  </button>`).join(""):'<div class="empty">No stuck or congestion events.</div>'}function Ae(s,e){const i=(e==null?void 0:e.buckets)||[];if(!i.length){s.innerHTML='<div class="empty">No stuck vehicles in this time range.</div>';return}const t=e.bucket_seconds||60,o=t<3600?`${t/60} minute${t===60?"":"s"}`:`${t/3600} hour${t===3600?"":"s"}`;s.innerHTML=`
    <p class="timeline-note">Busiest stuck location per ${o}; newest first.</p>
    <div class="stuck-time-list">${[...i].reverse().map(l=>{const r=l.hotspot,d=new Date(l.start*1e3).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),c=r.vehicle_ids.map(f).join(", ");return`<button type="button" class="stuck-time-row" data-stuck-time
        data-x="${r.x}" data-y="${r.y}"
        data-time="${l.start}" data-count="${r.vehicles}"
        title="Show this stuck location on the map">
        <span><b>${d}</b><small>x ${r.x.toFixed(1)} · y ${r.y.toFixed(1)}</small></span>
        <span><strong>${r.vehicles}</strong><small>at hotspot · ${l.total_vehicles} total</small></span>
        <em>${c}</em>
      </button>`}).join("")}</div>`}function V(s,e){const i=document.querySelector("#connection");i.classList.toggle("error",!s),i.querySelector("span").textContent=e}function R(s){const e=document.querySelector("#mode");e.textContent=s,e.className=`mode ${s.toLowerCase()}`}const G={count:{label:"Traffic activity",unit:"samples",description:"Recorded position samples per area. Normal turns are excluded. Sample counts are not elapsed time.",empty:"No traffic samples in this time window.",ranking:"Most active areas"},vehicles:{label:"Vehicle coverage",unit:"vehicles",description:"Distinct vehicles recorded in each area, excluding normal turns.",empty:"No vehicle coverage recorded in this time window.",ranking:"Most visited areas"},slow_samples:{label:"Waits & blockages",unit:"slow samples",description:"Recorded waiting, blocked, stalled, or stuck readings; also low-speed readings with an unknown state. These are samples, not seconds.",empty:"No waits or blockages recorded in this time window.",ranking:"View top delay areas"}},L=["#3b82c4","#28a8aa","#efbb4b","#db5141"],Fe=`linear-gradient(90deg, ${L.join(", ")})`;function J(s){const e=Math.max(0,Math.min(1,s))*(L.length-1),i=Math.min(L.length-2,Math.floor(e)),t=e-i,o=d=>[1,3,5].map(c=>parseInt(d.slice(c,c+2),16)),l=o(L[i]),r=o(L[i+1]);return l.map((d,c)=>Math.round(d+(r[c]-d)*t))}function He(s=[],e="count",i=0){const t=s.filter(u=>Number.isFinite(Number(u.x))&&Number.isFinite(Number(u.y))&&Number.isFinite(Number(u[e]))&&Number(u[e])>0).slice().sort((u,p)=>Number(p[e])-Number(u[e])||Number(u.x)-Number(p.x)||Number(u.y)-Number(p.y)),o=t.length?Number(t.at(-1)[e]):0,l=t.length?Number(t[0][e]):0,r=Number.isFinite(i)?Math.max(0,Math.min(.95,i)):0,d=Math.max(1,Math.ceil(t.length*(1-r))),c=t.length?Number(t[d-1][e]):0,h=u=>l===o?.5:Math.max(0,Math.min(1,(Math.log1p(u)-Math.log1p(o))/(Math.log1p(l)-Math.log1p(o))));return{min:o,max:l,threshold:c,areas:t,visible:t.filter(u=>Number(u[e])>=c),fraction:h}}const q=["#8d6bff","#00a7d8","#ef7d50","#21a47b","#d45fc0","#789637","#d99924","#4a75dc","#d35c69"];function Ve(s,e){if(![Number(s),Number(e)].every(Number.isFinite))return"time unavailable";const i=new Date(Number(s)*1e3),t=new Date(Number(e)*1e3),o=i.toLocaleDateString()===t.toLocaleDateString(),l={hour:"2-digit",minute:"2-digit"};return o?`${i.toLocaleDateString()} ${i.toLocaleTimeString([],l)}–${t.toLocaleTimeString([],l)}`:`${i.toLocaleString([],l)}–${t.toLocaleString([],l)}`}function De(s,e="count"){var r,d,c;const i=Number(s[e]||0),t=e==="vehicles"?`${i} unique vehicles`:e==="slow_samples"?`${i} slow samples`:`${i} position samples`,o=[`Area x ${Number(s.x).toFixed(1)}, y ${Number(s.y).toFixed(1)}`,`${t} · average speed ${Number(s.average_speed||0).toFixed(2)} m/s`],l=(d=(r=s.time_details)==null?void 0:r.peaks)==null?void 0:d[e];return l&&(o.push(`Busiest: ${Ve(l.start,l.end)}`),(c=l.vehicle_ids)!=null&&c.length&&o.push(`Vehicles: ${l.vehicle_ids.join(", ")}`)),o.push("Click for full details"),o.join(`
`)}class Pe{constructor(e){this.canvas=e,this.scale=1,this.x=0,this.y=0}unproject(e,i){return{x:(e-this.x)/this.scale,y:(i-this.y)/this.scale}}clamp(){this.x=Math.min(0,Math.max(this.canvas.width*(1-this.scale),this.x)),this.y=Math.min(0,Math.max(this.canvas.height*(1-this.scale),this.y))}zoom(e,i=this.canvas.width/2,t=this.canvas.height/2){const o=this.unproject(i,t);this.scale=Math.min(5,Math.max(1,this.scale*e)),this.x=i-o.x*this.scale,this.y=t-o.y*this.scale,this.clamp()}pan(e,i){this.x+=e,this.y+=i,this.clamp()}reset(){this.scale=1,this.x=0,this.y=0}}class Re{constructor(e){this.canvas=e,this.ctx=e.getContext("2d"),this.info={origin:[-18.6,-26.3],resolution:.05,width:607,height:1004},this.image=null,this.hits=[],this.focused=null,this.focusedVehicle=null,this.lastData=null,this.lastOptions=null,this.rotated=!1,this.onHeatSelect=null,this.onVehicleSelect=null,this.onEventSelect=null,this.onViewportChange=null,this.viewport=new Pe(e),this.drag=null,this.suppressClick=!1,this.tooltip=document.querySelector("#mapTooltip"),e.addEventListener("mousemove",t=>this.showTooltip(t)),e.addEventListener("click",t=>this.selectItem(t)),e.addEventListener("mouseleave",()=>{this.tooltip.style.display="none"}),e.addEventListener("pointerdown",t=>{!t.isPrimary||t.button!==0||(this.suppressClick=!1,this.viewport.scale!==1&&(this.drag={id:t.pointerId,x:t.clientX,y:t.clientY,moved:!1},this.suppressClick=!1,e.setPointerCapture(t.pointerId)))}),e.addEventListener("pointermove",t=>{if(!this.drag||this.drag.id!==t.pointerId)return;const o=t.clientX-this.drag.x,l=t.clientY-this.drag.y;if(!this.drag.moved&&Math.hypot(o,l)<4)return;this.drag.moved=!0;const r=e.getBoundingClientRect();this.viewport.pan(o*e.width/r.width,l*e.height/r.height),this.drag.x=t.clientX,this.drag.y=t.clientY,this.tooltip.style.display="none",this.refreshView()});const i=t=>{!this.drag||this.drag.id!==t.pointerId||(this.suppressClick=this.drag.moved,this.drag=null,e.hasPointerCapture(t.pointerId)&&e.releasePointerCapture(t.pointerId))};e.addEventListener("pointerup",i),e.addEventListener("pointercancel",i),e.addEventListener("lostpointercapture",i),e.addEventListener("wheel",t=>{if(!t.ctrlKey&&!t.metaKey)return;t.preventDefault();const o=e.getBoundingClientRect();this.zoomBy(t.deltaY<0?1.15:1/1.15,(t.clientX-o.left)*e.width/o.width,(t.clientY-o.top)*e.height/o.height)},{passive:!1}),e.addEventListener("keydown",t=>{if(t.key==="+"||t.key==="=")this.zoomBy(1.3);else if(t.key==="-")this.zoomBy(1/1.3);else if(t.key==="0")this.resetView();else if(t.key.startsWith("Arrow")&&this.viewport.scale>1){const o=e.width*.08;this.viewport.pan(t.key==="ArrowLeft"?o:t.key==="ArrowRight"?-o:0,t.key==="ArrowUp"?o:t.key==="ArrowDown"?-o:0),this.refreshView()}else return;t.preventDefault()}),this.resizeObserver=new ResizeObserver(()=>{e.getBoundingClientRect().width&&this.refreshView()}),this.resizeObserver.observe(e)}async load(e,i="/map.png"){this.info=e,this.rotated=this.height()>this.width()*1.1,this.canvas.width=this.rotated?1600:1200;const t=this.rotated?this.width()/this.height():this.height()/this.width();return this.canvas.height=Math.max(1,Math.round(this.canvas.width*t)),this.viewport.reset(),new Promise(o=>{const l=new Image;l.onload=()=>{this.image=l,o()},l.onerror=()=>o(),l.src=`${i}?${Date.now()}`})}width(){return this.info.width*this.info.resolution}height(){return this.info.height*this.info.resolution}project(e,i){const t=(e-this.info.origin[0])/this.width(),o=(i-this.info.origin[1])/this.height();return this.rotated?{x:o*this.canvas.width,y:t*this.canvas.height}:{x:t*this.canvas.width,y:(1-o)*this.canvas.height}}markerUnit(){const e=this.canvas.getBoundingClientRect().width||this.canvas.width;return this.canvas.width/e/this.viewport.scale}refreshView(){var e;this.tooltip.style.display="none",this.canvas.classList.toggle("is-zoomed",this.viewport.scale>1),this.lastData&&this.lastOptions&&this.draw(this.lastData,this.lastOptions),(e=this.onViewportChange)==null||e.call(this,this.viewport.scale)}zoomBy(e,i,t){this.viewport.zoom(e,i,t),this.refreshView()}resetView(){this.viewport.reset(),this.refreshView()}revealPoint(e){if(!e||this.viewport.scale===1)return;const i=this.project(Number(e.x),Number(e.y)),t=i.x*this.viewport.scale+this.viewport.x,o=i.y*this.viewport.scale+this.viewport.y,l=this.canvas.width*.06;t>=l&&t<=this.canvas.width-l&&o>=l&&o<=this.canvas.height-l||(this.viewport.x=this.canvas.width/2-i.x*this.viewport.scale,this.viewport.y=this.canvas.height/2-i.y*this.viewport.scale,this.viewport.clamp())}clearSelection(){this.focused=null,this.focusedVehicle=null,this.refreshView()}drawGrid(){var c;const{ctx:e,canvas:i}=this;if(e.fillStyle="#f1f5f3",e.fillRect(0,0,i.width,i.height),this.image&&(this.rotated?(e.save(),e.translate(i.width,0),e.rotate(Math.PI/2),e.drawImage(this.image,0,0,i.height,i.width),e.restore()):e.drawImage(this.image,0,0,i.width,i.height)),e.fillStyle="#ffffff18",e.fillRect(0,0,i.width,i.height),!((c=this.lastOptions)!=null&&c.grid))return;e.strokeStyle="#b8c7bf66",e.lineWidth=1,e.font="11px system-ui",e.fillStyle="#536875";const t=this.width()>35?5:4,o=Math.ceil(this.info.origin[0]/t)*t,l=this.info.origin[0]+this.width();for(let h=o;h<=l;h+=t){const u=this.project(h,this.info.origin[1]),p=this.project(h,this.info.origin[1]+this.height());e.beginPath(),e.moveTo(u.x,u.y),e.lineTo(p.x,p.y),e.stroke(),this.rotated?e.fillText(`${h.toFixed(0)} m`,7,u.y-4):e.fillText(`${h.toFixed(0)} m`,u.x+4,i.height-8)}const r=Math.ceil(this.info.origin[1]/t)*t,d=this.info.origin[1]+this.height();for(let h=r;h<=d;h+=t){const u=this.project(this.info.origin[0],h),p=this.project(this.info.origin[0]+this.width(),h);e.beginPath(),e.moveTo(u.x,u.y),e.lineTo(p.x,p.y),e.stroke(),this.rotated?e.fillText(`${h.toFixed(0)} m`,u.x+4,i.height-8):e.fillText(`${h.toFixed(0)} m`,7,u.y-4)}}drawHeat(e,i,t="count",o=.65){var r;(((r=this.heatCache)==null?void 0:r.density)!==e.density||this.heatCache.metric!==t||this.heatCache.filter!==i)&&(this.heatScale=He(e.density,t,i),this.heatCache={density:e.density,metric:t,filter:i});const l=Math.max(.2,Math.min(.9,o));[...this.heatScale.visible].reverse().forEach(d=>{const c=this.heatScale.fraction(Number(d[t])),h=16+12*c,{x:u,y:p}=this.project(d.x,d.y),y=J(c).join(", "),b=this.ctx.createRadialGradient(u,p,0,u,p,h);b.addColorStop(0,`rgba(${y}, ${l})`),b.addColorStop(.4,`rgba(${y}, ${l*.75})`),b.addColorStop(1,`rgba(${y}, 0)`),this.ctx.fillStyle=b,this.ctx.beginPath(),this.ctx.arc(u,p,h,0,Math.PI*2),this.ctx.fill(),this.hits.push({x:u,y:p,radius:h,priority:0,label:De(d,t),heatValue:d,heatMetric:t})})}trackColor(e){let i=0;for(const t of e)i=i*31+t.charCodeAt(0)>>>0;return q[i%q.length]}trackSegments(e){const i=[];let t=[],o=null;for(const l of e){const r={x:Number(l[0]),y:Number(l[1]),time:Number(l[2])};if(![r.x,r.y,r.time].every(Number.isFinite)){t.length>1&&i.push(t),t=[],o=null;continue}if(o){const d=r.time-o.time,c=Math.hypot(r.x-o.x,r.y-o.y),h=Math.max(2.5,d*2.2+.75);(d<=0||d>12||c>h)&&(t.length>1&&i.push(t),t=[])}t.push(r),o=r}return t.length>1&&i.push(t),i}traceSegment(e){this.ctx.beginPath(),e.forEach((i,t)=>{const o=this.project(i.x,i.y);t===0?this.ctx.moveTo(o.x,o.y):this.ctx.lineTo(o.x,o.y)})}drawPathArrows(e,i){let t=0;for(let o=1;o<e.length;o+=1){const l=this.project(e[o-1].x,e[o-1].y),r=this.project(e[o].x,e[o].y);if(t+=Math.hypot(r.x-l.x,r.y-l.y),t<90)continue;t=0;const d=Math.atan2(r.y-l.y,r.x-l.x);this.ctx.save(),this.ctx.translate(r.x,r.y),this.ctx.rotate(d),this.ctx.fillStyle=i,this.ctx.strokeStyle="#071521",this.ctx.lineWidth=2,this.ctx.beginPath(),this.ctx.moveTo(8,0),this.ctx.lineTo(-5,-5),this.ctx.lineTo(-2,0),this.ctx.lineTo(-5,5),this.ctx.closePath(),this.ctx.fill(),this.ctx.stroke(),this.ctx.restore()}}drawPaths(e){this.focusedVehicle&&(e.tracks||[]).forEach(i=>{if(i.points.length<2||this.focusedVehicle&&i.vehicle_id!==this.focusedVehicle)return;const t=this.trackColor(i.vehicle_id),o=this.trackSegments(i.points);this.ctx.save(),this.ctx.lineCap="round",this.ctx.lineJoin="round";for(const l of o)this.traceSegment(l),this.ctx.strokeStyle="#ffffffdd",this.ctx.lineWidth=5*this.markerUnit(),this.ctx.stroke(),this.traceSegment(l),this.ctx.strokeStyle=t,this.ctx.lineWidth=2.5*this.markerUnit(),this.ctx.shadowColor=t,this.ctx.shadowBlur=0,this.ctx.stroke(),this.ctx.shadowBlur=0,this.drawPathArrows(l,t);this.ctx.restore()})}circle(e,i,t,o,l,r){i*=this.markerUnit()*.7;const{x:d,y:c}=this.project(e.x,e.y);this.ctx.fillStyle=t,this.ctx.beginPath(),this.ctx.arc(d,c,i,0,Math.PI*2),this.ctx.fill(),l&&(this.ctx.strokeStyle=l,this.ctx.lineWidth=2,this.ctx.stroke()),this.hits.push({x:d,y:c,radius:Math.max(i,12),priority:2,label:o,eventValue:e,eventType:r})}drawVehicle(e){var u,p,y,b;const{x:i,y:t}=this.project(e.x,e.y),o=e.motion_state||(e.speed<.05?"unknown":"moving"),l={moving:"#208366",side_task:"#208366",returning_route:"#208366",side_work:"#c28c30",loading:"#c28c30",unloading:"#c28c30",task_planning:"#91a7b9",turning:"#208366",waiting_vehicle:"#c28c30",blocked_obstacle:"#ff6856",stalled:"#ff5263",stuck:"#cb5b51",idle:"#91a7b9",planning:"#91a7b9",localizing:"#91a7b9",sensor_wait:"#91a7b9",unknown:"#91a7b9"},r=l[o]||l.unknown,d=this.markerUnit(),c=e.vehicle_id===this.focusedVehicle;this.ctx.save(),this.ctx.translate(i,t),this.ctx.scale(d,d),this.ctx.fillStyle="#ffffff",this.ctx.shadowColor="#23413630",this.ctx.shadowBlur=5,this.ctx.beginPath(),this.ctx.arc(0,0,c?10:8,0,Math.PI*2),this.ctx.fill(),this.ctx.shadowBlur=0,this.ctx.fillStyle=r,this.ctx.beginPath(),this.ctx.arc(0,0,c?6.5:5.5,0,Math.PI*2),this.ctx.fill();const h=(y=(p=(u=this.lastOptions)==null?void 0:u.delivery)==null?void 0:p.vehicles)==null?void 0:y.find($=>$.vehicle_id===e.vehicle_id);if(h!=null&&h.carrying&&(this.ctx.fillStyle="#568bc1",this.ctx.strokeStyle="#ffffff",this.ctx.lineWidth=1.5,this.ctx.fillRect(5,4,7,7),this.ctx.strokeRect(5,4,7,7)),((b=this.lastOptions)==null?void 0:b.labels)!==!1||c){const $=e.vehicle_id==="my_robot"?"AMR":e.vehicle_id.replace("vehicle_","V").replace("forklift_","F");this.ctx.font="600 11px system-ui";const S=this.ctx.measureText($).width+14;this.ctx.fillStyle=c?"#176f56":"#fffffff2",this.ctx.beginPath(),this.ctx.roundRect(-S/2,-30,S,19,5),this.ctx.fill(),this.ctx.fillStyle=c?"#ffffff":"#334d41",this.ctx.textAlign="center",this.ctx.fillText($,0,-17)}this.ctx.restore(),this.hits.push({x:i,y:t,radius:15*d,priority:3,vehicleId:e.vehicle_id,label:`${e.vehicle_id} · ${o.replaceAll("_"," ")} · ${e.speed.toFixed(2)} m/s
Click to see this vehicle’s route`})}drawUwbTags(){(this.info.uwb_tags||[]).forEach(e=>{const{x:i,y:t}=this.project(Number(e.x),Number(e.y));this.ctx.save(),this.ctx.translate(i,t),this.ctx.rotate(Math.PI/4),this.ctx.globalAlpha=e.enabled===!1?.35:1,this.ctx.fillStyle="#f04df2",this.ctx.shadowColor="#f04df2",this.ctx.shadowBlur=10,this.ctx.fillRect(-7,-7,14,14),this.ctx.shadowBlur=0,this.ctx.strokeStyle="#53145f",this.ctx.lineWidth=2,this.ctx.strokeRect(-7,-7,14,14),this.ctx.restore(),this.ctx.font="bold 10px system-ui",this.ctx.fillStyle="#6e187c",this.ctx.textAlign="center",this.ctx.fillText(e.id,i,t-13),this.ctx.textAlign="start",this.hits.push({x:i,y:t,radius:14,priority:3,label:`UWB tag ${e.id} · ${e.enabled===!1?"disabled":"enabled"} · battery ${Number(e.battery_pct??100).toFixed(0)}% · x ${Number(e.x).toFixed(1)}, y ${Number(e.y).toFixed(1)}, z ${Number(e.z).toFixed(1)} m`})})}drawStations(e){(e.dockingPoints||[]).forEach((i,t)=>{var c,h;if(!Number.isFinite(i.x)||!Number.isFinite(i.y))return;const{x:o,y:l}=this.project(i.x,i.y),r=this.markerUnit(),d=(h=(c=e.delivery)==null?void 0:c.vehicles)==null?void 0:h.some(u=>u.phase==="loading"&&u.pickup===i.id||u.phase==="unloading"&&u.dropoff===i.id);this.ctx.save(),this.ctx.translate(o,l),this.ctx.scale(r,r),this.ctx.fillStyle=d?"#fff3dc":"#ffffffee",this.ctx.strokeStyle=d?"#be8d32":"#6eaa88",this.ctx.lineWidth=1.3,this.ctx.beginPath(),this.ctx.roundRect(-10,-9,20,18,4),this.ctx.fill(),this.ctx.stroke(),this.ctx.font="600 9px system-ui",this.ctx.textAlign="center",this.ctx.fillStyle=d?"#99671c":"#347356",this.ctx.fillText(String(t+1).padStart(2,"0"),0,3),this.ctx.restore(),this.hits.push({x:o,y:l,radius:13*r,priority:2,label:`${String(t+1).padStart(2,"0")} · ${i.label}
Pickup & drop-off point${d?" · loading / unloading":""}`})})}draw(e,i){this.lastData=e,this.lastOptions=i,this.hits=[],this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height),this.ctx.save(),this.ctx.translate(this.viewport.x,this.viewport.y),this.ctx.scale(this.viewport.scale,this.viewport.scale),this.drawGrid(),i.heat&&this.drawHeat(e,i.heatFilter,i.heatMetric,i.heatOpacity),i.paths&&this.drawPaths(e),i.stations&&this.drawStations(i),i.stuck&&e.stuck.slice(0,12).forEach(t=>this.circle(t,8+Math.min(10,Math.log2(t.events+1)*2),"#ffbf47cc",`${t.events} stuck event(s) · ${Math.round(t.duration)} seconds`,"#fff0bd","Stuck")),i.congestion&&e.congestion.slice(0,12).forEach(t=>this.circle(t,10+Math.min(14,t.max_vehicles*2),"#ff5263b8",`${t.events} congestion event(s) · up to ${t.max_vehicles} vehicles`,"#ff9ba5","Congestion")),i.vehicles&&(i.stateFilter==="all"?e.latest:e.latest.filter(o=>(o.motion_state||(o.speed<.05?"unknown":"moving"))===i.stateFilter)).forEach(o=>this.drawVehicle(o)),i.tags&&this.drawUwbTags(),this.drawFocus(),this.drawVehicleFocus(e),this.ctx.restore()}focusAt(e){this.focused=e,this.focusedVehicle=null,this.revealPoint(e),this.lastData&&this.lastOptions&&this.draw(this.lastData,this.lastOptions)}focusVehicle(e){var i,t;this.focused=null,this.focusedVehicle=e,this.revealPoint((t=(i=this.lastData)==null?void 0:i.latest)==null?void 0:t.find(o=>o.vehicle_id===e)),this.lastData&&this.lastOptions&&this.draw(this.lastData,this.lastOptions)}setHeatSelectionHandler(e){this.onHeatSelect=typeof e=="function"?e:null}drawFocus(){if(!this.focused||!Number.isFinite(Number(this.focused.x))||!Number.isFinite(Number(this.focused.y)))return;const{x:e,y:i}=this.project(Number(this.focused.x),Number(this.focused.y)),t=this.focused.type==="Congestion"?"#cb5b51":this.focused.type==="Heat area"?"#3777b0":"#c28c30",o=this.focused.type==="Heat area"?"Selected heat area":`${this.focused.type} · ${this.focused.events} event(s)`,l=this.markerUnit();this.ctx.save(),this.ctx.strokeStyle=t,this.ctx.lineWidth=2*l,this.ctx.beginPath(),this.ctx.arc(e,i,15*l,0,Math.PI*2),this.ctx.stroke(),this.ctx.setLineDash([3*l,4*l]),this.ctx.beginPath(),this.ctx.arc(e,i,21*l,0,Math.PI*2),this.ctx.stroke(),this.ctx.restore(),this.hits.push({x:e,y:i,radius:22*l,priority:1,label:`${o} · x ${Number(this.focused.x).toFixed(2)}, y ${Number(this.focused.y).toFixed(2)}`})}drawVehicleFocus(e){var c;if(!this.focusedVehicle)return;const i=(e.latest||[]).find(h=>h.vehicle_id===this.focusedVehicle),t=(e.tracks||[]).find(h=>h.vehicle_id===this.focusedVehicle),o=i||((c=t==null?void 0:t.points)!=null&&c.length?{x:t.points.at(-1)[0],y:t.points.at(-1)[1]}:null);if(!o)return;const{x:l,y:r}=this.project(Number(o.x),Number(o.y)),d=this.markerUnit();this.ctx.save(),this.ctx.strokeStyle="#176f56",this.ctx.lineWidth=2*d,this.ctx.beginPath(),this.ctx.arc(l,r,13*d,0,Math.PI*2),this.ctx.stroke(),this.ctx.restore(),this.hits.push({x:l,y:r,radius:16*d,priority:4,vehicleId:this.focusedVehicle,label:`${this.focusedVehicle} · selected route`})}hitAt(e,i=!1){const t=this.canvas.getBoundingClientRect(),o=(e.clientX-t.left)*this.canvas.width/t.width,l=(e.clientY-t.top)*this.canvas.height/t.height,{x:r,y:d}=this.viewport.unproject(o,l);return this.hits.filter(c=>!i||c.heatValue).map(c=>({...c,distance:Math.hypot(c.x-r,c.y-d)})).filter(c=>c.distance<=c.radius).sort((c,h)=>Number(h.priority||0)-Number(c.priority||0)||c.distance-h.distance)[0]}selectItem(e){if(this.suppressClick){this.suppressClick=!1;return}const i=this.hitAt(e);i!=null&&i.vehicleId&&this.onVehicleSelect?this.onVehicleSelect(i.vehicleId):i!=null&&i.eventValue&&this.onEventSelect?this.onEventSelect(i.eventValue,i.eventType):this.selectHeat(e),this.tooltip.style.display="none"}selectHeat(e){const i=this.hitAt(e,!0);!i||!this.onHeatSelect||(this.onHeatSelect(i.heatValue,i.heatMetric),this.tooltip.style.display="none")}showTooltip(e){var h;if((h=this.drag)!=null&&h.moved)return;const i=this.hitAt(e);if(!i){this.tooltip.style.display="none";return}this.tooltip.textContent=i.label,this.tooltip.style.display="block";const t=this.canvas.parentElement,o=t.getBoundingClientRect(),l=e.clientX-o.left+14,r=e.clientY-o.top+14,d=Math.max(6,Math.min(l,t.clientWidth-this.tooltip.offsetWidth-6)),c=Math.max(6,Math.min(r,t.clientHeight-this.tooltip.offsetHeight-6));this.tooltip.style.left=`${d}px`,this.tooltip.style.top=`${c}px`}}const Ie=document.querySelector("#app");document.body.classList.add("dashboard");Ie.innerHTML=`
  <a class="skip-link" href="#workspace">Skip to workspace</a>
  <aside class="app-sidebar">
    <a class="brand" href="/" aria-label="Warehouse Intelligence home">
      <span class="logo">W</span>
      <span>
        <strong>Warehouse</strong>
        <small>INTELLIGENCE</small>
      </span>
    </a>
    <div class="nav-caption">WORKSPACE</div>
    <nav class="workspace-nav" aria-label="Workspace">
      <button type="button" data-view="overview" aria-current="page">
        <span aria-hidden="true">◫</span>Overview</button>
      <button type="button" data-view="activity">
        <span aria-hidden="true">≋</span>Traffic history</button>
      <button type="button" data-view="deliveries">
        <span aria-hidden="true">↗</span>Delivery jobs</button>
      <button type="button" data-view="diagnostics">
        <span aria-hidden="true">⌁</span>Diagnostics</button>
    </nav>
    <div class="sidebar-bottom">
      <a href="/health.html">
        <span aria-hidden="true">♡</span> System health <span aria-hidden="true">↗</span>
      </a>
      <p>Warehouse operations<br>
        <span>Traffic & vehicle monitoring</span>
      </p>
    </div>
  </aside>
  <div class="app-workspace">
    <header class="workspace-topbar">
      <span>Operations <span class="breadcrumb">/ <b id="breadcrumb">Overview</b>
        </span>
      </span>
      <a class="mobile-health" href="/health.html">System health ↗</a>
      <div id="connection" class="connection" role="status">
        <i>
        </i>
        <span>Connecting…</span>
      </div>
    </header>
    <main id="workspace" tabindex="-1">
      <div class="page-heading">
        <div>
          <p class="eyebrow">WAREHOUSE OPERATIONS</p>
          <h1 id="pageTitle">Keep your floor moving.</h1>
          <p id="pageDescription">Follow your fleet, deliveries, and traffic in one place.</p>
        </div>
        <span id="mode" class="mode">LIVE</span>
      </div>
      <section class="time-controls" aria-label="Time controls">
        <div class="time-controls-main">
          <button id="liveButton" class="secondary">● Live now</button>
          <label class="time-window" for="trailMinutes">Traffic window<select id="trailMinutes">
              <option value="1">Last minute</option>
              <option value="5" selected>Last 5 minutes</option>
              <option value="15">Last 15 minutes</option>
              <option value="60">Last hour</option>
            </select>
          </label>
          <button id="replayToggle" class="text-button" aria-expanded="false" aria-controls="replayControls">Replay history <span aria-hidden="true">⌄</span>
          </button>
        </div>
        <div id="replayControls" class="replay-controls" hidden>
          <p class="control-hint">Choose a recorded time, then jump to it or play forward.</p>
          <div class="control-row">
            <label class="field">
              <span>Start time</span>
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
          </div>
          <div class="timeline-row">
            <span id="firstLog">First log —</span>
            <input id="timeline" aria-label="Recorded time" type="range" min="0" max="1" value="1" step="0.5">
            <span id="replayClock">Loading history…</span>
            <span id="lastLog">Latest log —</span>
          </div>
        </div>
      </section>
      <div id="dataNotice" class="data-notice" role="status" hidden>
      </div>
      <section data-workspace="overview" aria-label="Overview">
        <div class="delivery-summary-heading"><span class="eyebrow">LIVE OPERATIONS</span><span id="deliveryConnection" class="delivery-connection" role="status">Connecting to fleet…</span></div>
        <section id="deliveryMetrics" class="metrics delivery-metrics" aria-label="Live delivery summary"></section>
        <div class="overview-grid">
          <section class="panel map-panel">
            <div class="panel-head">
              <div>
                <h2>Warehouse map</h2>
                <span class="sub">Vehicle positions, docking points, and traffic</span>
              </div>
              <details class="layer-menu">
                <summary>Layers <span aria-hidden="true">⌄</span>
                </summary>
                <div class="map-tools">
                  <span class="menu-label">MAP APPEARANCE</span>
                  <label><input id="labelLayer" type="checkbox" checked> Vehicle names</label>
                  <label><input id="gridLayer" type="checkbox"> Coordinate grid</label>
                  <span class="menu-label">SHOW ON MAP</span>
                  <label>
                    <input id="vehicleLayer" type="checkbox" checked> Vehicle positions</label>
                  <label>
                    <input id="densityLayer" type="checkbox"> Traffic heatmap</label>
                  <label>
                    <input id="pathLayer" type="checkbox"> Selected vehicle’s path</label>
                  <label>
                    <input id="stuckLayer" type="checkbox"> Stuck locations</label>
                  <label>
                    <input id="jamLayer" type="checkbox"> Congestion</label>
                  <label><input id="stationLayer" type="checkbox" checked> Pickup &amp; drop-off points</label>
                  <label hidden><input id="tagLayer" type="checkbox"> Sensor tags</label>
                  <label class="state-filter">Vehicle state <select id="stateFilter">
                      <option value="all">All states</option>
                      <option value="moving">Moving</option>
                      <option value="loading">Loading cargo</option>
                      <option value="unloading">Unloading cargo</option>
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
                </div>
              </details>
            </div>
            <div class="map-viewbar">
              <div class="map-presets" role="group" aria-label="Map view">
                <button type="button" data-map-view="vehicles" aria-pressed="true">Vehicles</button>
                <button type="button" data-map-view="heat" aria-pressed="false">Traffic heat</button>
                <button type="button" data-map-view="issues" aria-pressed="false">Issues</button>
              </div>
              <span id="mapViewHint" class="map-view-hint">Current vehicle positions</span>
            </div>
            <section id="heatControls" class="heat-controls" aria-label="Traffic heat settings" hidden>
              <div class="heat-mode-note"><strong id="heatModeLabel">Waits & blockages</strong><span>Normal turning excluded</span></div>
              <details class="heat-settings"><summary>Adjust heatmap</summary>
              <div class="heat-control-fields">
                <label class="field"><span>Measure</span><select id="heatMetric">
                  <option value="count">Traffic activity</option>
                  <option value="vehicles">Vehicle coverage</option>
                  <option value="slow_samples" selected>Waits & blockages</option>
                </select></label>
                <label class="field"><span>Show areas</span><select id="heatFilter">
                  <option value="0">All recorded areas</option>
                  <option value="50">Busier half</option>
                  <option value="80">Busiest 20%</option>
                </select></label>
                <label class="field heat-opacity"><span>Overlay strength <output id="heatOpacityValue" for="heatOpacity">65%</output></span>
                  <input id="heatOpacity" type="range" min="20" max="90" value="65" step="5" aria-label="Heat overlay strength">
                </label>
              </div>
              <p id="heatMetricHelp" class="heat-metric-help"></p>
              </details>
            </section>
            <div class="map-wrap map-stage">
              <canvas id="map" width="1200" height="720" tabindex="0" role="img"
                aria-label="Interactive warehouse map. Select a vehicle on the map or in the fleet list. Use plus and minus to zoom, arrow keys to pan, and zero to fit the map." aria-describedby="mapNavigationHint"></canvas>
              <div id="mapTooltip" class="tooltip"></div>
              <div class="map-navigation" role="group" aria-label="Map navigation">
                <button id="mapZoomIn" type="button" aria-label="Zoom in" title="Zoom in (+)">+</button>
                <output id="mapZoomLevel" aria-label="Zoom level">100%</output>
                <button id="mapZoomOut" type="button" aria-label="Zoom out" title="Zoom out (-)" disabled>−</button>
                <button id="mapReset" type="button" title="Fit the full warehouse (0)">Fit</button>
              </div>
              <span id="mapNavigationHint" class="map-navigation-hint">Zoom in to explore · select a vehicle</span>
            </div>
            <div class="map-foot map-legend-row">
              <div id="vehicleLegend" class="legend" aria-label="Vehicle status colors">
                <span><i class="state-dot moving"></i>Moving</span>
                <span><i class="state-dot waiting"></i>Waiting</span>
                <span><i class="state-dot blocked"></i>Blocked</span>
                <span><i class="state-dot idle"></i>Idle / other</span>
                <span><i class="station-legend-dot"></i>Docking point</span>
                <span><i class="cargo-legend-dot"></i>Carrying cargo</span>
              </div>
              <span id="issuesLegend" class="legend" hidden><span><i class="dot stuck"></i>Stuck location</span><span><i class="dot congestion"></i>Congestion</span></span>
            </div>
            <section id="heatInsights" class="heat-insights" aria-label="Traffic heat summary" hidden>
              <div id="heatLegend" class="heat-scale" hidden>
                <div class="heat-scale-title"><strong id="heatScaleTitle">Traffic activity</strong><span id="heatAreaCount"></span></div>
                <div id="heatScaleBar" class="heat-scale-bar" aria-hidden="true"></div>
                <div class="heat-scale-values"><span id="heatScaleLow"></span><span id="heatScaleHigh"></span></div>
                <p id="heatScaleNote">Colors are relative to this time window.</p>
              </div>
              <details class="heat-ranking"><summary id="heatRankingTitle">Top areas</summary>
                <div id="heatAreas" class="heat-areas"></div>
              </details>
              <p id="heatEmptyNotice" class="heat-empty" role="status" hidden></p>
            </section>
            <div id="mapSelection" class="map-selection">
              <div><span id="mapSelectionLabel" class="selection-label">EXPLORE THE MAP</span><p id="mapFocus" class="map-focus">Select a vehicle to see its route. Choose Traffic heat to explore busy areas.</p></div>
              <button id="clearMapSelection" type="button" class="text-button" hidden>Clear selection</button>
            </div>
            <details id="areaPanel" class="map-area-details" hidden>
              <summary>Area traffic breakdown</summary>
              <div id="heatAreaSummary"></div>
            </details>
            <div class="map-range">
              <span id="range" class="range">Loading traffic…</span>
            </div>
          </section>
          <section class="panel summary-panel">
            <div class="panel-head">
              <div>
                <h2>Delivery fleet <span id="fleetCount" class="count-badge">0</span>
                </h2>
                <span class="sub">Select a vehicle to locate it</span>
              </div>
              <label class="compact-toggle">
                <input id="fleetDetails" type="checkbox">Details</label>
            </div>
            <div id="summaryRows" class="summary-grid">
              <div class="empty">Waiting for vehicle data…</div>
            </div>
          </section>
        </div>
        <section class="panel attention-panel">
          <div class="panel-head">
            <div>
              <h2>Traffic highlights</h2>
              <span class="sub">Patterns in the selected time window</span>
            </div>
            <button type="button" class="text-button" data-open-view="activity">View history →</button>
          </div>
          <div id="analytics" class="analytics">
            <div class="empty">Waiting for traffic data…</div>
          </div>
        </section>
      </section>
      <section data-workspace="activity" aria-label="Traffic history" hidden>
        <section id="metrics" class="metrics" aria-label="Traffic summary"></section>
        <div class="view-intro">
          <span class="intro-icon" aria-hidden="true">◷</span>
          <p>Explore slowdowns and recurring hotspots. Select an event to find it on the map, or use <b>Replay history</b> to review a recorded time.</p>
        </div>
        <div class="activity-grid">
          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Traffic hotspots</h2>
                <span class="sub">Locations with the most stuck or congestion events</span>
              </div>
            </div>
            <div id="hotspots" class="hotspots">
            </div>
          </section>
          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Stuck events over time</h2>
                <span class="sub">When vehicles were unable to move</span>
              </div>
            </div>
            <div id="stuckTimeline" class="stuck-timeline">
            </div>
          </section>
        </div>
      </section>
      <section data-workspace="deliveries" aria-label="Delivery jobs" hidden>
        <div class="delivery-summary-heading"><p class="control-hint">Automatic pickup and delivery across the warehouse.</p><span class="tag">LIVE JOBS</span></div>
        <section class="panel delivery-jobs-panel">
          <div class="panel-head"><div><h2>Current deliveries</h2><span class="sub">Select a forklift to find it on the map</span></div><span id="deliveryUpdated" class="sub">Waiting for fleet updates</span></div>
          <div class="delivery-table-wrap"><table class="delivery-table"><thead><tr><th>Forklift</th><th>Delivery</th><th>Pickup → Drop-off</th><th>Progress</th><th>Cargo</th><th>Completed</th></tr></thead><tbody id="deliveryJobs"></tbody></table></div>
        </section>
        <section class="panel delivery-stations-panel">
          <div class="panel-head"><div><h2>Pickup &amp; drop-off points</h2><span class="sub">Numbers match the docking points on the map</span></div><span id="stationCount" class="count-badge">—</span></div>
          <div id="deliveryStations" class="delivery-station-grid"></div>
        </section>
      </section>
      <section data-workspace="diagnostics" aria-label="Position diagnostics" hidden>
        <div class="view-intro">
          <span class="intro-icon" aria-hidden="true">⌁</span>
          <p>Technical position checks for troubleshooting. For connectivity and sensor availability, open <a href="/health.html">System health ↗</a>.</p>
        </div>
        <div class="activity-grid">
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
        </div>
      </section>
      <footer class="workspace-footer">
        <span>Warehouse Intelligence</span>
        <span>Position & traffic monitoring</span>
      </footer>
    </main>
  </div>
`;const a=s=>document.querySelector(s),m=new Re(a("#map")),n={data:null,bounds:null,cursor:null,auto:!0,loading:!1,playing:!1,playbackEnd:null,playbackStart:null,lastTick:0,debounce:null,selectedHotspot:null,selectedHeat:null,selectedVehicle:null,delivery:null,deliveryLoading:!1,deliveryConnected:!1},E={samples:0,latest:[],density:[],tracks:[],stuck:[],stuck_timeline:{bucket_seconds:60,buckets:[]},congestion:[],start:new Date().toISOString(),end:new Date().toISOString(),analytics:{},localization:{summary:{samples:0},vehicles:[]},uwb_validation:{live:!0,summary:{},vehicles:[]},localization_recovery:{live:!0,summary:{},vehicles:[]}};function N(s){return new Date(s.getTime()-s.getTimezoneOffset()*6e4).toISOString().slice(0,19)}function A(s){a("#selectedTime").value=N(new Date(s*1e3))}function F(s){s!==null&&(a("#timeline").value=s,a("#replayClock").textContent=new Date(s*1e3).toLocaleString())}function K(s){return n.bounds?Math.max(n.bounds.first,Math.min(n.bounds.last,s)):s}function Q(){var s,e;return{stations:a("#stationLayer").checked,dockingPoints:((s=n.delivery)==null?void 0:s.stations)||[],delivery:n.auto&&n.deliveryConnected&&((e=n.delivery)!=null&&e.online)?n.delivery:null,paths:a("#pathLayer").checked,grid:a("#gridLayer").checked,labels:a("#labelLayer").checked,vehicles:a("#vehicleLayer").checked,heat:a("#densityLayer").checked,heatMetric:a("#heatMetric").value,heatOpacity:Number(a("#heatOpacity").value)/100,stuck:a("#stuckLayer").checked,congestion:a("#jamLayer").checked,tags:a("#tagLayer").checked,stateFilter:a("#stateFilter").value,heatFilter:Number(a("#heatFilter").value)/100}}function g(){n.data&&(m.draw(n.data,Q()),ze())}function ee(s){var e;if(n.data=s,Ce(a("#metrics"),s),te(s),Me(a("#localization"),s.localization),n.selectedVehicle){const i=[...document.querySelectorAll("#summaryRows [data-vehicle]")].find(o=>o.dataset.vehicle===n.selectedVehicle);i&&i.classList.add("selected");const t=s.latest.find(o=>o.vehicle_id===n.selectedVehicle);a("#mapFocus").textContent=t?`${t.vehicle_id} · ${((e=t.motion_state)==null?void 0:e.replaceAll("_"," "))||"State unavailable"} · ${t.speed.toFixed(2)} m/s · x ${t.x.toFixed(1)}, y ${t.y.toFixed(1)}`:`${n.selectedVehicle} · No current position in this time window`}if(Te(a("#analytics"),s.analytics),n.selectedHeat){const i=s.density.find(t=>Math.abs(Number(t.x)-Number(n.selectedHeat.value.x))<.001&&Math.abs(Number(t.y)-Number(n.selectedHeat.value.y))<.001);i?(n.selectedHeat.value=i,P(a("#heatAreaSummary"),i,n.selectedHeat.metric)):le()}if(Ee(a("#hotspots"),s),Ae(a("#stuckTimeline"),s.stuck_timeline),n.selectedHotspot){const i=[...document.querySelectorAll("#hotspots [data-hotspot]")].find(t=>Math.abs(Number(t.dataset.x)-n.selectedHotspot.x)<.001&&Math.abs(Number(t.dataset.y)-n.selectedHotspot.y)<.001&&t.dataset.type===n.selectedHotspot.type);i&&i.classList.add("selected")}a("#range").textContent=s.samples?`${new Date(s.start).toLocaleString()} — ${new Date(s.end).toLocaleString()}`:"Waiting for ROS traffic history",g()}function C(){a("#areaPanel").hidden=!0,a("#areaPanel").open=!1,n.selectedHeat=null,P(a("#heatAreaSummary"),null)}function I(s,e){var o,l;a("#areaPanel").hidden=!1,n.selectedHeat={value:s,metric:e},n.selectedVehicle=null,n.selectedHotspot=null,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(r=>r.classList.remove("selected")),document.querySelectorAll("#hotspots [data-hotspot]").forEach(r=>r.classList.remove("selected")),a("#pathLayer").checked=!1,P(a("#heatAreaSummary"),s,e),m.focusAt({x:Number(s.x),y:Number(s.y),type:"Heat area",events:Number(s[e]||0)});const i=(l=(o=s.time_details)==null?void 0:o.peaks)==null?void 0:l[e],t=i?` · busiest ${new Date(i.start*1e3).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`:"";a("#mapFocus").textContent=`${Number(s[e]||0).toLocaleString()} ${G[e].unit} · x ${Number(s.x).toFixed(1)}, y ${Number(s.y).toFixed(1)}${t}`,g()}m.setHeatSelectionHandler(I);function te(s=n.data){var i,t,o,l,r,d;if(!s)return;const e=(t=(i=document.activeElement)==null?void 0:i.closest("#summaryRows [data-vehicle]"))==null?void 0:t.dataset.vehicle;n.auto&&n.deliveryConnected&&((o=n.delivery)!=null&&o.online)?(a("#fleetCount").textContent=n.delivery.vehicles.length,$e(a("#summaryRows"),s.latest,n.delivery,n.selectedVehicle)):(a("#fleetCount").textContent=s.latest.length,_e(a("#summaryRows"),s.latest,((l=s.localization)==null?void 0:l.vehicles)||[]),(r=[...a("#summaryRows").querySelectorAll("[data-vehicle]")].find(c=>c.dataset.vehicle===n.selectedVehicle))==null||r.classList.add("selected")),e&&((d=[...a("#summaryRows").querySelectorAll("[data-vehicle]")].find(c=>c.dataset.vehicle===e))==null||d.focus({preventScroll:!0}))}function ie(){var i,t,o,l;ke(a("#deliveryMetrics"),n.delivery,n.deliveryConnected),Se(a("#deliveryJobs"),n.delivery,n.deliveryConnected),Le(a("#deliveryStations"),n.delivery?{...n.delivery,online:n.deliveryConnected&&n.delivery.online}:null),a("#stationCount").textContent=((t=(i=n.delivery)==null?void 0:i.stations)==null?void 0:t.length)??"—";const s=n.deliveryConnected&&((o=n.delivery)==null?void 0:o.online);a("#deliveryConnection").classList.toggle("offline",!s),a("#deliveryConnection").textContent=s?"Fleet online · automatic deliveries":n.delivery?"Fleet updates unavailable":"Waiting for fleet";const e=(l=n.delivery)==null?void 0:l.observed_at;a("#deliveryUpdated").textContent=e?`Last update ${new Date(e*1e3).toLocaleTimeString()}`:"Waiting for fleet updates",te(),g()}async function se(){if(!n.deliveryLoading){n.deliveryLoading=!0;try{n.delivery=await he(),n.deliveryConnected=!0}catch{n.deliveryConnected=!1}finally{n.deliveryLoading=!1,ie()}}}a("#deliveryJobs").addEventListener("click",s=>{const e=s.target.closest("[data-delivery-vehicle]");e&&(n.auto||M(),H({dataset:{vehicle:e.dataset.deliveryVehicle}}))});async function O(s){if(!n.loading){n.loading=!0;try{ee(await pe(s)),V(!0,`Updated ${new Date().toLocaleTimeString()}`),a("#dataNotice").hidden=!0}catch{V(!1,"Monitor offline"),a("#dataNotice").hidden=!1,a("#dataNotice").textContent="Live updates are unavailable. Displayed data may be out of date. Reconnecting automatically…"}finally{n.loading=!1}}}async function ae(s=!1){try{const e=await ue();if(e.empty){a("#replayClock").textContent="No recorded history";return}const i=n.bounds===null;n.bounds=e,a("#timeline").min=e.first,a("#timeline").max=e.last,a("#selectedTime").min=N(new Date(e.first*1e3)),a("#selectedTime").max=N(new Date(e.last*1e3)),a("#firstLog").textContent=`First ${new Date(e.first*1e3).toLocaleString()}`,a("#lastLog").textContent=`Latest ${new Date(e.last*1e3).toLocaleString()}`,(s||i||!a("#selectedTime").value)&&(n.cursor=e.last,A(Math.max(e.first,e.last-300)),a("#rangeStart").value=N(new Date(e.first*1e3)),a("#rangeEnd").value=N(new Date(e.last*1e3))),(n.cursor===null||n.auto)&&(n.cursor=e.last),F(n.cursor)}catch{a("#replayClock").textContent="History unavailable"}}function w(s="PAUSED"){n.playing=!1,n.lastTick=0,a("#playButton").textContent="▶ Play to latest",a("#playButton").className="",s&&R(s)}function _(s){if(!n.bounds)return;n.auto=!1,n.cursor=K(s),F(n.cursor);const e=Number(a("#trailMinutes").value)*60,i=n.playing&&n.playbackStart!==null?n.playbackStart:Math.max(n.bounds.first,n.cursor-e),t=Math.min(n.cursor-.001,i);O({start:new Date(t*1e3).toISOString(),end:new Date(n.cursor*1e3).toISOString()})}function M(){w(null),n.auto=!0,n.playbackStart=null,R("LIVE"),n.bounds&&(n.cursor=n.bounds.last,F(n.cursor)),O({hours:Number(a("#trailMinutes").value)/60})}function Oe(){w("HISTORY");const s=a("#selectedTime").value;s&&_(new Date(s).getTime()/1e3)}function je(){if(n.playing){w();return}if(!n.bounds)return;n.auto=!1;const s=new Date(a("#selectedTime").value).getTime()/1e3;n.cursor=K(Number.isFinite(s)?s:n.bounds.first),n.playbackStart=n.cursor,n.playbackEnd=n.bounds.last,n.playing=!0,n.lastTick=performance.now(),R("REPLAY"),a("#playButton").textContent="❚❚ Pause replay",a("#playButton").className="playing",_(n.cursor)}function We(){if(!n.playing)return;const s=performance.now();if(n.loading){n.lastTick=s;return}const e=Math.min(2,(s-n.lastTick)/1e3);n.lastTick=s,n.cursor=Math.min(n.playbackEnd,n.cursor+e*Number(a("#playSpeed").value)),A(n.cursor),_(n.cursor),n.cursor>=n.playbackEnd&&w("HISTORY")}function Be(){const s=a("#rangeStart").value,e=a("#rangeEnd").value;!s||!e||(w("HISTORY"),n.auto=!1,O({start:new Date(s).toISOString(),end:new Date(e).toISOString()}))}a("#liveButton").addEventListener("click",M);a("#jumpButton").addEventListener("click",Oe);a("#playButton").addEventListener("click",je);a("#applyRange").addEventListener("click",Be);a("#stateFilter").addEventListener("change",g);function H(s,e=!0){var t,o;C(),n.selectedVehicle=s.dataset.vehicle,n.selectedHotspot=null,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(l=>{l.classList.toggle("selected",l===s)}),document.querySelectorAll("#hotspots [data-hotspot]").forEach(l=>l.classList.remove("selected")),a("#pathLayer").checked=!0,m.focusVehicle(n.selectedVehicle);const i=(o=(t=n.data)==null?void 0:t.latest)==null?void 0:o.find(l=>l.vehicle_id===n.selectedVehicle);a("#mapFocus").textContent=i?`${n.selectedVehicle} path · x ${i.x.toFixed(1)} · y ${i.y.toFixed(1)} · ${i.speed.toFixed(2)} m/s`:`${n.selectedVehicle} path`,k("overview"),g(),e&&a(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})}a("#summaryRows").addEventListener("click",s=>{const e=s.target.closest("[data-vehicle]");e&&H(e)});a("#summaryRows").addEventListener("keydown",s=>{if(s.key!=="Enter"&&s.key!==" ")return;const e=s.target.closest("[data-vehicle]");e&&(s.preventDefault(),H(e))});function ne(s,e=!0){C(),n.selectedVehicle=null,a("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(t=>t.classList.remove("selected")),n.selectedHotspot={x:Number(s.dataset.x),y:Number(s.dataset.y),type:s.dataset.type,events:Number(s.dataset.events),first_started:Number(s.dataset.first)||null,last_ended:Number(s.dataset.last)||null},document.querySelectorAll("#hotspots [data-hotspot]").forEach(t=>{t.classList.toggle("selected",t===s)}),m.focusAt(n.selectedHotspot);const i=n.selectedHotspot.first_started?`${new Date(n.selectedHotspot.first_started*1e3).toLocaleString()} → ${new Date((n.selectedHotspot.last_ended||n.selectedHotspot.first_started)*1e3).toLocaleString()}`:"time unavailable";a("#mapFocus").textContent=`${n.selectedHotspot.type} · x ${n.selectedHotspot.x.toFixed(1)} · y ${n.selectedHotspot.y.toFixed(1)} · ${n.selectedHotspot.events} event(s) · ${i}`,k("overview"),g(),e&&a(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})}a("#hotspots").addEventListener("click",s=>{const e=s.target.closest("[data-hotspot]");e&&ne(e)});a("#stuckTimeline").addEventListener("click",s=>{const e=s.target.closest("[data-stuck-time]");e&&(C(),n.selectedVehicle=null,a("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(i=>i.classList.remove("selected")),document.querySelectorAll("#hotspots [data-hotspot]").forEach(i=>i.classList.remove("selected")),n.selectedHotspot={x:Number(e.dataset.x),y:Number(e.dataset.y),type:"Stuck",events:Number(e.dataset.count),first_started:Number(e.dataset.time),last_ended:Number(e.dataset.time)},m.focusAt(n.selectedHotspot),A(Number(e.dataset.time)),a("#mapFocus").textContent=`Stuck at ${new Date(Number(e.dataset.time)*1e3).toLocaleTimeString()} · x ${n.selectedHotspot.x.toFixed(1)} · y ${n.selectedHotspot.y.toFixed(1)} · ${n.selectedHotspot.events} vehicle(s)`,k("overview"),g(),a(".map-panel").scrollIntoView({behavior:"smooth",block:"center"}))});function oe(s){var e,i;if(C(),s.dataset.insight==="stuck")n.selectedVehicle=null,a("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(t=>t.classList.remove("selected")),n.selectedHotspot={x:Number(s.dataset.x),y:Number(s.dataset.y),type:"Stuck",events:Number(s.dataset.events),first_started:Number(s.dataset.first)||null,last_ended:Number(s.dataset.last)||null},m.focusAt(n.selectedHotspot),a("#mapFocus").textContent=`Stuck · x ${n.selectedHotspot.x.toFixed(1)} · y ${n.selectedHotspot.y.toFixed(1)} · ${n.selectedHotspot.events} event(s)`;else{const t=s.dataset.vehicle,o=(i=(e=n.data)==null?void 0:e.analytics)==null?void 0:i.worst_path;n.selectedVehicle=t,n.selectedHotspot=null,a("#pathLayer").checked=!0,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(l=>{l.classList.toggle("selected",l.dataset.vehicle===t)}),document.querySelectorAll("#hotspots [data-hotspot]").forEach(l=>l.classList.remove("selected")),m.focusVehicle(t),a("#mapFocus").textContent=`${t} path · ${s.dataset.insight==="window"?"bad interval":"worst path"}${o?` · ${o.slow_seconds.toFixed(0)} s slow`:""}`}k("overview"),g(),a(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})}a("#analytics").addEventListener("click",s=>{const e=s.target.closest("[data-insight]");e&&oe(e)});a("#analytics").addEventListener("keydown",s=>{if(s.key!=="Enter"&&s.key!==" ")return;const e=s.target.closest("[data-insight]");e&&(s.preventDefault(),oe(e))});["labelLayer","gridLayer","pathLayer","vehicleLayer","densityLayer","stuckLayer","jamLayer","tagLayer","stationLayer","heatMetric","heatFilter","heatOpacity"].forEach(s=>a(`#${s}`).addEventListener("input",g));a("#heatMetric").addEventListener("change",()=>{n.selectedHeat&&I(n.selectedHeat.value,a("#heatMetric").value)});a("#heatAreas").addEventListener("click",s=>{var t;const e=s.target.closest("[data-heat-area]");if(!e)return;const i=(t=n.data)==null?void 0:t.density.find(o=>`${o.x},${o.y}`===e.dataset.heatArea);i&&(I(i,a("#heatMetric").value),a("#areaPanel").open=!0)});a("#trailMinutes").addEventListener("change",()=>n.auto?M():n.cursor!==null&&_(n.cursor));["selectedTime","rangeStart","rangeEnd"].forEach(s=>a(`#${s}`).addEventListener("focus",()=>{n.auto=!1,w("PAUSED")}));a("#timeline").addEventListener("input",s=>{n.auto=!1,w("HISTORY"),n.cursor=Number(s.target.value),A(n.cursor),F(n.cursor),clearTimeout(n.debounce),n.debounce=setTimeout(()=>_(n.cursor),120)});function qe(){var l,r,d;const s=a("#heatMetric").value,e=G[s],i=m.heatScale;if(!i)return;a("#heatMetricHelp").textContent=e.description,a("#heatModeLabel").textContent=e.label,a("#heatOpacityValue").textContent=`${a("#heatOpacity").value}%`,a("#heatLegend").hidden=!i.areas.length,a("#heatScaleTitle").textContent=e.label,a("#heatAreaCount").textContent=`${i.visible.length.toLocaleString()} of ${i.areas.length.toLocaleString()} areas shown`,a("#heatScaleBar").style.background=i.min===i.max?`rgb(${J(.5).join(",")})`:Fe,a("#heatScaleLow").textContent=`${i.min.toLocaleString()} ${e.unit}`,a("#heatScaleHigh").textContent=`${i.max.toLocaleString()} ${e.unit}`,a("#heatScaleNote").textContent=i.min===i.max?"All recorded areas have the same value.":"Relative intensity within this time window · colors stay consistent when filtering.",Number(a("#heatFilter").value)>0&&(a("#heatScaleNote").textContent+=` Showing ≥ ${i.threshold.toLocaleString()} ${e.unit}; ties are included.`),a("#heatRankingTitle").textContent=e.ranking,a(".heat-ranking").hidden=!i.visible.length,a("#heatEmptyNotice").hidden=!!i.visible.length,a("#heatEmptyNotice").textContent=n.data===E?"Waiting for traffic data from the monitor.":e.empty;const t=a("#heatAreas"),o=i.visible.length?i.visible.slice(0,3).map((c,h)=>{var p,y;const u=((p=n.selectedHeat)==null?void 0:p.value.x)===c.x&&((y=n.selectedHeat)==null?void 0:y.value.y)===c.y;return`<button type="button" class="heat-area-button" data-heat-area="${Number(c.x)},${Number(c.y)}" aria-pressed="${u}">
      <span class="heat-rank">${h+1}</span><span><strong>${Number(c[s]).toLocaleString()} <small>${e.unit}</small></strong><small>x ${Number(c.x).toFixed(1)} · y ${Number(c.y).toFixed(1)}</small></span><span aria-hidden="true">↗</span>
    </button>`}).join(""):`<p class="heat-empty">${n.data===E?"Waiting for traffic data from the monitor.":`${e.empty} Try another measure or a longer traffic window.`}</p>`;if(t.innerHTML!==o){const c=(r=(l=document.activeElement)==null?void 0:l.closest("[data-heat-area]"))==null?void 0:r.dataset.heatArea;t.innerHTML=o,c&&((d=[...t.querySelectorAll("[data-heat-area]")].find(h=>h.dataset.heatArea===c))==null||d.focus({preventScroll:!0}))}if(n.selectedHeat){const c=n.selectedHeat.value;a("#mapFocus").textContent=`${Number(c[s]||0).toLocaleString()} ${e.unit} · average speed ${Number(c.average_speed||0).toFixed(2)} m/s · x ${Number(c.x).toFixed(1)}, y ${Number(c.y).toFixed(1)}`,i.visible.includes(c)||(a("#mapFocus").textContent+=" · Outside the current heat filter")}}function ze(){const s=a("#densityLayer").checked,e=a("#stuckLayer").checked&&a("#jamLayer").checked,i=a("#vehicleLayer").checked,t=i&&!s&&!a("#stuckLayer").checked&&!a("#jamLayer").checked?"vehicles":i&&s&&!a("#stuckLayer").checked&&!a("#jamLayer").checked?"heat":i&&!s&&e?"issues":"custom";document.querySelectorAll("[data-map-view]").forEach(l=>{l.setAttribute("aria-pressed",String(l.dataset.mapView===t))}),a("#mapViewHint").textContent={vehicles:"Current vehicle positions",heat:"Traffic in the selected time window",issues:"Recorded stuck & congestion locations",custom:"Custom layer selection"}[t],a("#vehicleLegend").hidden=!i,a("#heatControls").hidden=!s,a("#heatInsights").hidden=!s,s&&qe(),a("#issuesLegend").hidden=!a("#stuckLayer").checked&&!a("#jamLayer").checked;const o=n.selectedVehicle||n.selectedHeat||n.selectedHotspot;a("#mapSelection").classList.toggle("has-selection",!!o),a("#clearMapSelection").hidden=!o,a("#mapSelectionLabel").textContent=n.selectedVehicle?"SELECTED VEHICLE":n.selectedHeat?"SELECTED AREA":n.selectedHotspot?"SELECTED EVENT":s?"EXPLORE TRAFFIC":"EXPLORE THE MAP",o||(a("#mapFocus").textContent=s?"Select a colored area or a ranked area above to see its activity, speed, and busiest time.":"Select a vehicle to see its route. Choose Traffic heat to explore busy areas."),re()}function le(){C(),n.selectedVehicle=null,n.selectedHotspot=null,a("#pathLayer").checked=!1,m.clearSelection(),document.querySelectorAll("#summaryRows .selected, #hotspots .selected").forEach(s=>s.classList.remove("selected")),a("#mapFocus").textContent="Select a vehicle to see its route. Choose Traffic heat to explore busy areas.",g()}function re(){a("#mapNavigationHint").textContent=m.viewport.scale>1?"Drag to move · Fit to see the full floor":a("#densityLayer").checked?"Select a colored area · zoom for a closer look":"Zoom in to explore · select a vehicle"}m.onViewportChange=s=>{a("#mapZoomLevel").textContent=`${Math.round(s*100)}%`,a("#mapZoomIn").disabled=s>=5,a("#mapZoomOut").disabled=s<=1,re()};m.onVehicleSelect=s=>{const e=[...a("#summaryRows").querySelectorAll("[data-vehicle]")].find(i=>i.dataset.vehicle===s);e&&H(e,!1)};m.onEventSelect=(s,e)=>{const i=[...a("#hotspots").querySelectorAll("[data-hotspot]")].find(t=>Number(t.dataset.x)===Number(s.x)&&Number(t.dataset.y)===Number(s.y)&&t.dataset.type===e);ne(i||{dataset:{x:s.x,y:s.y,type:e,events:s.events,first:s.first_started,last:s.last_ended}},!1)};a("#mapZoomIn").addEventListener("click",()=>m.zoomBy(1.3));a("#mapZoomOut").addEventListener("click",()=>m.zoomBy(1/1.3));a("#mapReset").addEventListener("click",()=>m.resetView());a("#clearMapSelection").addEventListener("click",le);document.querySelectorAll("[data-map-view]").forEach(s=>{s.addEventListener("click",()=>{const e=s.dataset.mapView;a("#vehicleLayer").checked=!0,a("#densityLayer").checked=e==="heat",a("#stuckLayer").checked=e==="issues",a("#jamLayer").checked=e==="issues",g()})});const z={overview:["Overview","Keep your floor moving.","Follow your fleet, deliveries, and traffic in one place."],activity:["Traffic history","Understand your traffic.","Find recurring slowdowns and explore recorded events."],deliveries:["Delivery jobs","Every delivery, in view.","Track pickups, cargo, and completed jobs across your fleet."],diagnostics:["Diagnostics","A closer look at positioning.","Compare sensor readings and investigate position accuracy."]};function k(s,e=!0){z[s]||(s="overview"),document.querySelectorAll("[data-workspace]").forEach(l=>{l.hidden=l.dataset.workspace!==s}),document.querySelectorAll("[data-view]").forEach(l=>{l.dataset.view===s?l.setAttribute("aria-current","page"):l.removeAttribute("aria-current")});const[i,t,o]=z[s];a("#breadcrumb").textContent=i,a("#pageTitle").textContent=t,a("#pageDescription").textContent=o,document.title=`${i} · Warehouse Intelligence`,e&&location.hash!==`#${s}`&&(location.hash=s)}document.querySelectorAll("[data-view], [data-open-view]").forEach(s=>{s.addEventListener("click",()=>k(s.dataset.view||s.dataset.openView))});window.addEventListener("hashchange",()=>{location.hash!=="#workspace"&&k(location.hash.slice(1),!1)});k(location.hash.slice(1),!1);a("#replayToggle").addEventListener("click",()=>{const s=a("#replayToggle").getAttribute("aria-expanded")!=="true";a("#replayToggle").setAttribute("aria-expanded",String(s)),a("#replayControls").hidden=!s});a("#fleetDetails").addEventListener("change",s=>{a("#summaryRows").classList.toggle("show-details",s.target.checked)});document.addEventListener("keydown",s=>{if(s.key==="Escape"){const e=a(".layer-menu");e.open&&(e.open=!1,e.querySelector("summary").focus())}});document.addEventListener("click",s=>{const e=a(".layer-menu");e.contains(s.target)||(e.open=!1)});async function Ue(){ee(E),ie(),a("#metrics").querySelectorAll(".metric strong").forEach(s=>{s.textContent="—"}),a("#metrics").querySelectorAll(".metric small").forEach(s=>{s.textContent="Waiting for traffic data"}),a("#fleetCount").textContent="—";try{const s=await de();await m.load(s),g()}catch{await m.load(ge,"/fallback-map.png"),m.draw(E,Q()),V(!1,"Map preview · ROS monitor offline")}await ae(!0),await se(),M()}Ue();setInterval(We,400);let U=0;setInterval(()=>{n.auto&&M(),se(),U+=1,U%5===0&&ae()},2e3);
