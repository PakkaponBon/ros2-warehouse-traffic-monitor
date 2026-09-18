import"./modulepreload-polyfill-B5Qt9EMX.js";import{a as X,b as nt,c as lt,d as rt,e as ct}from"./api-as0-rMUe.js";const v=i=>String(i).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),dt=i=>i.vehicle_id==="my_robot"?`${v(i.vehicle_id)} <span class="tag">AMR</span>`:v(i.vehicle_id),q={moving:["Moving","moving"],side_task:["Travelling to side task","moving"],returning_route:["Returning to normal route","moving"],side_work:["Performing side work","waiting"],task_planning:["Planning side-task route","idle"],turning:["Turning normally","turning"],waiting_vehicle:["Waiting for vehicle","waiting"],blocked_obstacle:["Blocked by obstacle","blocked"],stalled:["Commanded but not moving","blocked"],stuck:["Stuck","blocked"],idle:["Idle / intentional stop","idle"],planning:["Planning next route","idle"],localizing:["Waiting for localization","idle"],sensor_wait:["Waiting for LiDAR","idle"],unknown:["State unavailable","idle"]};function Z(i){const t=i.speed>=.05?"moving":"unknown",s=i.motion_state||t,[e,n]=q[s]||q.unknown;return{state:s,label:e,className:n}}function ht(i,t){const s=t.latest.filter(e=>Z(e).className==="moving").length;i.innerHTML=[["vehicles",t.latest.length,"Vehicles tracked","","At the end of this window"],["moving",s,"Moving","teal","At the end of this window"],["stuck",t.stuck.length,"Stuck locations","orange","In this traffic window"],["congestion",t.congestion.length,"Congestion areas","red","In this traffic window"]].map(e=>`<article class="metric ${e[3]}"><span>${e[2]}</span><strong>${e[1]}</strong><small>${e[4]}</small></article>`).join("")}function ut(i,t,s=[]){if(!t.length){i.innerHTML='<div class="empty">No fresh vehicle positions at the end of this range.</div>';return}i.innerHTML=t.map(e=>{const n=Z(e),o=s.find(r=>r.vehicle_id===e.vehicle_id);return`<article class="vehicle-card vehicle-action" data-vehicle="${v(e.vehicle_id)}" role="button" tabindex="0" title="Show ${v(e.vehicle_id)} path on the map">
      <div class="vehicle-card-head"><strong><i class="status-dot ${n.className}"></i>${dt(e)}</strong>
        <b class="speed">${e.speed.toFixed(2)} m/s</b></div>
      <div class="vehicle-position">Position <b>x ${e.x.toFixed(2)} m</b><b>y ${e.y.toFixed(2)} m</b></div>
      ${o?`<div class="localization-error">LiDAR AMCL error <b>${o.latest_error.toFixed(2)} m</b></div>`:""}
      <small class="motion-state ${n.className}">● ${n.label}</small>
    </article>`}).join("")}function pt(i,t){const s=t==null?void 0:t.summary,e=(t==null?void 0:t.vehicles)||[];if(!(s!=null&&s.samples)){i.innerHTML='<div class="empty">Waiting for AMCL and Gazebo comparison samples…</div>';return}const n=s.mean_yaw_error*180/Math.PI;i.innerHTML=`
    <div class="localization-overview">
      <div><strong>${s.mean_error.toFixed(2)} m</strong><small>Mean error</small></div>
      <div><strong>${s.rms_error.toFixed(2)} m</strong><small>RMS error</small></div>
      <div><strong>${s.max_error.toFixed(2)} m</strong><small>Maximum</small></div>
      <div><strong>${n.toFixed(1)}°</strong><small>Mean yaw error</small></div>
    </div>
    <div class="localization-list">${e.map(o=>`
      <div class="localization-row">
        <span><b>${v(o.vehicle_id)}</b><small>${o.samples} comparisons</small></span>
        <span><strong>${o.mean_error.toFixed(2)} m</strong><small>latest ${o.latest_error.toFixed(2)} m</small></span>
      </div>`).join("")}</div>`}function mt(i,t,s={}){const e=(t==null?void 0:t.vehicles)||[],n=(t==null?void 0:t.summary)||{};if(!e.length){i.innerHTML=t!=null&&t.historical?'<div class="empty">No recorded UWB validation in this time range.</div>':'<div class="empty">Waiting for live UWB validation…</div>';return}const o={confirmed:["Confirmed","confirmed"],caution:["Caution","caution"],disagreement:["Disagreement","disagreement"],uwb_unavailable:["UWB unavailable","unavailable"],waiting_amcl:["Waiting for AMCL","unavailable"],unsynchronized:["Time mismatch","unavailable"]},r=(n.uwb_unavailable||0)+(n.waiting_amcl||0)+(n.unsynchronized||0),d=t.as_of?new Date(t.as_of).toLocaleString():null,c=(s==null?void 0:s.vehicles)||[],h=new Map(c.map(p=>[p.vehicle_id,p])),u=(s==null?void 0:s.summary)||{},m=c.length?`<div class="recovery-summary ${u.interlocked?"active":""}">
        <b>Motion interlock</b>
        <span>${u.ready||0} ready · ${u.interlocked||0} stopped/recovering</span>
      </div>`:"";i.innerHTML=`
    ${m}
    <div class="uwb-overview">
      <div><strong>${n.confirmed||0}</strong><small>Confirmed</small></div>
      <div><strong>${n.caution||0}</strong><small>Caution</small></div>
      <div><strong>${n.disagreement||0}</strong><small>Disagree</small></div>
      <div><strong>${r}</strong><small>Not compared</small></div>
    </div>
    <div class="uwb-list">${e.map(p=>{var M;const[b,R]=o[p.state]||["Unknown","unavailable"],C=Number.isFinite(p.error_m)?`${p.error_m.toFixed(2)} m difference`:p.state==="unsynchronized"&&Number.isFinite(p.measurement_skew_s)?`${p.measurement_skew_s.toFixed(2)} s time mismatch`:((M=p.uwb_reason)==null?void 0:M.replaceAll("_"," "))||"No comparison",_=p.raw_state&&p.raw_state!==p.state?` · checking ${p.raw_state.replaceAll("_"," ")}`:"",k=h.get(p.vehicle_id),y=k?` · interlock ${k.state.replaceAll("_"," ")}`:"";return`<div class="uwb-row">
        <span><b>${v(p.vehicle_id)}</b><small>${p.visible_tag_count||0} tags visible · ${v(C)}${v(_)}${v(y)}</small></span>
        <strong class="uwb-state ${R}">${b}</strong>
      </div>`}).join("")}</div>
    <p class="uwb-note">${t.live?"Live comparison":`Recorded comparison${d?` at ${d}`:""}`}. AMCL remains the position source; UWB is confirmation only.</p>`}function ft(i,t){const s=t==null?void 0:t.most_stuck_location,e=t==null?void 0:t.worst_path,n=(o,r)=>o?`${new Date(o*1e3).toLocaleString()} → ${new Date((r||o)*1e3).toLocaleString()}`:"No slow/stuck interval in this range";i.innerHTML=`
    <div class="insight-row ${s?"insight-action":""}" ${s?`data-insight="stuck" role="button" tabindex="0" data-x="${s.x}" data-y="${s.y}" data-events="${s.events}" data-first="${s.first_started||""}" data-last="${s.last_ended||""}"`:""}>
      <i class="insight-icon orange">!</i><div><b>Most frequent stop</b><small>${s?`x ${s.x.toFixed(2)} · y ${s.y.toFixed(2)} · ${s.events} event(s)`:"No stuck position recorded"}</small>${s?`<em>${n(s.first_started,s.last_ended)}</em>`:""}</div>
    </div>
    <div class="insight-row ${e?"insight-action":""}" ${e?`data-insight="path" role="button" tabindex="0" data-vehicle="${v(e.vehicle_id)}"`:""}>
      <i class="insight-icon red">↝</i><div><b>Route with most delays</b><small>${e?`${v(e.vehicle_id)} · ${e.reason}`:"No vehicle path recorded"}</small>${e?`<em>${e.distance_m.toFixed(1)} m travelled · ${e.slow_seconds.toFixed(0)} s slow</em>`:""}</div>
    </div>
    <div class="insight-row ${e?"insight-action":""}" ${e?`data-insight="window" role="button" tabindex="0" data-vehicle="${v(e.vehicle_id)}"`:""}>
      <i class="insight-icon blue">◷</i><div><b>When delays happened</b><small>${e?n(e.bad_when_start,e.bad_when_end):"No delay interval recorded"}</small>${e?`<em>Average speed ${e.average_speed.toFixed(2)} m/s</em>`:""}</div>
    </div>`}function P(i,t,s="count"){var C,_,k;if(!t){i.innerHTML='<div class="empty">Click a colored heat spot on the map to see its detailed summary.</div>';return}const e={count:["Position samples","samples"],vehicles:["Unique vehicles","vehicles"],slow_samples:["Slow samples","slow samples"]},[n,o]=e[s]||e.count,r=(_=(C=t.time_details)==null?void 0:C.peaks)==null?void 0:_[s],d=(k=t.time_details)==null?void 0:k.stuck,c=y=>y?`${new Date(y.start*1e3).toLocaleString()} → ${new Date(y.end*1e3).toLocaleString()}`:"No peak time available",h=(r==null?void 0:r.vehicle_ids)||[],u=((r==null?void 0:r.slow_vehicle_states)||[]).map(y=>`${v(y.vehicle_id)} (${y.states.map(M=>v(M.replaceAll("_"," "))).join(", ")})`),m=new Set((r==null?void 0:r.slow_vehicle_ids)||[]),p=h.filter(y=>!m.has(y)),b=r?Number(r[s]||0):"—",R=d!=null&&d.events?`${d.events} event(s), ${d.vehicles} vehicle(s)${d.peak?` · busiest ${c(d.peak)}`:""}`:"None in this selected time range";i.innerHTML=`<div class="heat-area-summary">
    <div class="heat-area-location"><b>Map area</b><span>x ${Number(t.x).toFixed(1)} m · y ${Number(t.y).toFixed(1)} m</span></div>
    <div class="heat-area-grid">
      <div><small>${n}</small><strong>${Number(t[s]||0)}</strong><span>whole selected range</span></div>
      <div><small>Average speed</small><strong>${Number(t.average_speed||0).toFixed(2)} m/s</strong><span>in this area</span></div>
      <div><small>Busiest period</small><strong>${b}</strong><span>${o}</span></div>
      <div><small>Slow at busiest time</small><strong>${r?Number(r.slow_samples||0):"—"}</strong><span>samples</span></div>
    </div>
    <dl class="heat-area-details">
      <div><dt>Busiest time</dt><dd>${c(r)}</dd></div>
      <div><dt>Vehicles there</dt><dd>${h.length?h.map(v).join(", "):"None recorded"}</dd></div>
      <div><dt>Slow or waiting</dt><dd>${u.length?u.join(", "):"None recorded"}</dd></div>
      <div><dt>Moving normally</dt><dd>${p.length?p.map(v).join(", "):"None recorded"}</dd></div>
      <div><dt>Confirmed stuck</dt><dd>${R}</dd></div>
    </dl>
  </div>`}function vt(i,t){const s=[...t.congestion.map(e=>({...e,type:"Congestion",color:"var(--red)"})),...t.stuck.map(e=>({...e,type:"Stuck",color:"var(--orange)"}))].sort((e,n)=>n.events-e.events).slice(0,6);i.innerHTML=s.length?s.map(e=>`<button type="button" class="hotspot-row" data-hotspot
    data-x="${e.x}" data-y="${e.y}" data-type="${e.type}"
    data-events="${e.events}" data-first="${e.first_started||""}" data-last="${e.last_ended||""}"
    title="Show ${e.type.toLowerCase()} location on the map">
    <span><b style="color:${e.color}">${e.type}</b><small>x ${e.x.toFixed(1)} · y ${e.y.toFixed(1)}</small></span>
    <span class="hotspot-count"><strong>${e.events}×</strong><small>View map</small></span>
  </button>`).join(""):'<div class="empty">No stuck or congestion events.</div>'}function gt(i,t){const s=(t==null?void 0:t.buckets)||[];if(!s.length){i.innerHTML='<div class="empty">No stuck vehicles in this time range.</div>';return}const e=t.bucket_seconds||60,n=e<3600?`${e/60} minute${e===60?"":"s"}`:`${e/3600} hour${e===3600?"":"s"}`;i.innerHTML=`
    <p class="timeline-note">Busiest stuck location per ${n}; newest first.</p>
    <div class="stuck-time-list">${[...s].reverse().map(o=>{const r=o.hotspot,d=new Date(o.start*1e3).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),c=r.vehicle_ids.map(v).join(", ");return`<button type="button" class="stuck-time-row" data-stuck-time
        data-x="${r.x}" data-y="${r.y}"
        data-time="${o.start}" data-count="${r.vehicles}"
        title="Show this stuck location on the map">
        <span><b>${d}</b><small>x ${r.x.toFixed(1)} · y ${r.y.toFixed(1)}</small></span>
        <span><strong>${r.vehicles}</strong><small>at hotspot · ${o.total_vehicles} total</small></span>
        <em>${c}</em>
      </button>`}).join("")}</div>`}function D(i,t){const s=document.querySelector("#connection");s.classList.toggle("error",!i),s.querySelector("span").textContent=t}function O(i){const t=document.querySelector("#mode");t.textContent=i,t.className=`mode ${i.toLowerCase()}`}const G={count:{label:"Traffic activity",unit:"samples",description:"Recorded position samples per area. More samples indicate more activity, not elapsed time.",empty:"No traffic samples in this time window.",ranking:"Most active areas"},vehicles:{label:"Vehicle coverage",unit:"vehicles",description:"Distinct vehicles recorded in each area during this time window.",empty:"No vehicle coverage recorded in this time window.",ranking:"Most visited areas"},slow_samples:{label:"Slow & waiting activity",unit:"slow samples",description:"Recorded waiting, blocked, stalled, or stuck readings; also low-speed readings with an unknown state. These are samples, not seconds.",empty:"No slow or waiting samples in this time window.",ranking:"Areas with most slow readings"}},S=["#3b82c4","#28a8aa","#efbb4b","#db5141"],yt=`linear-gradient(90deg, ${S.join(", ")})`;function K(i){const t=Math.max(0,Math.min(1,i))*(S.length-1),s=Math.min(S.length-2,Math.floor(t)),e=t-s,n=d=>[1,3,5].map(c=>parseInt(d.slice(c,c+2),16)),o=n(S[s]),r=n(S[s+1]);return o.map((d,c)=>Math.round(d+(r[c]-d)*e))}function bt(i=[],t="count",s=0){const e=i.filter(u=>Number.isFinite(Number(u.x))&&Number.isFinite(Number(u.y))&&Number.isFinite(Number(u[t]))&&Number(u[t])>0).slice().sort((u,m)=>Number(m[t])-Number(u[t])||Number(u.x)-Number(m.x)||Number(u.y)-Number(m.y)),n=e.length?Number(e.at(-1)[t]):0,o=e.length?Number(e[0][t]):0,r=Number.isFinite(s)?Math.max(0,Math.min(.95,s)):0,d=Math.max(1,Math.ceil(e.length*(1-r))),c=e.length?Number(e[d-1][t]):0,h=u=>o===n?.5:Math.max(0,Math.min(1,(Math.log1p(u)-Math.log1p(n))/(Math.log1p(o)-Math.log1p(n))));return{min:n,max:o,threshold:c,areas:e,visible:e.filter(u=>Number(u[t])>=c),fraction:h}}const z=["#8d6bff","#00a7d8","#ef7d50","#21a47b","#d45fc0","#789637","#d99924","#4a75dc","#d35c69"];function wt(i,t){if(![Number(i),Number(t)].every(Number.isFinite))return"time unavailable";const s=new Date(Number(i)*1e3),e=new Date(Number(t)*1e3),n=s.toLocaleDateString()===e.toLocaleDateString(),o={hour:"2-digit",minute:"2-digit"};return n?`${s.toLocaleDateString()} ${s.toLocaleTimeString([],o)}–${e.toLocaleTimeString([],o)}`:`${s.toLocaleString([],o)}–${e.toLocaleString([],o)}`}function xt(i,t="count"){var r,d,c;const s=Number(i[t]||0),e=t==="vehicles"?`${s} unique vehicles`:t==="slow_samples"?`${s} slow samples`:`${s} position samples`,n=[`Area x ${Number(i.x).toFixed(1)}, y ${Number(i.y).toFixed(1)}`,`${e} · average speed ${Number(i.average_speed||0).toFixed(2)} m/s`],o=(d=(r=i.time_details)==null?void 0:r.peaks)==null?void 0:d[t];return o&&(n.push(`Busiest: ${wt(o.start,o.end)}`),(c=o.vehicle_ids)!=null&&c.length&&n.push(`Vehicles: ${o.vehicle_ids.join(", ")}`)),n.push("Click for full details"),n.join(`
`)}class kt{constructor(t){this.canvas=t,this.scale=1,this.x=0,this.y=0}unproject(t,s){return{x:(t-this.x)/this.scale,y:(s-this.y)/this.scale}}clamp(){this.x=Math.min(0,Math.max(this.canvas.width*(1-this.scale),this.x)),this.y=Math.min(0,Math.max(this.canvas.height*(1-this.scale),this.y))}zoom(t,s=this.canvas.width/2,e=this.canvas.height/2){const n=this.unproject(s,e);this.scale=Math.min(5,Math.max(1,this.scale*t)),this.x=s-n.x*this.scale,this.y=e-n.y*this.scale,this.clamp()}pan(t,s){this.x+=t,this.y+=s,this.clamp()}reset(){this.scale=1,this.x=0,this.y=0}}class St{constructor(t){this.canvas=t,this.ctx=t.getContext("2d"),this.info={origin:[-18.6,-26.3],resolution:.05,width:607,height:1004},this.image=null,this.hits=[],this.focused=null,this.focusedVehicle=null,this.lastData=null,this.lastOptions=null,this.rotated=!1,this.onHeatSelect=null,this.onVehicleSelect=null,this.onEventSelect=null,this.onViewportChange=null,this.viewport=new kt(t),this.drag=null,this.suppressClick=!1,this.tooltip=document.querySelector("#mapTooltip"),t.addEventListener("mousemove",e=>this.showTooltip(e)),t.addEventListener("click",e=>this.selectItem(e)),t.addEventListener("mouseleave",()=>{this.tooltip.style.display="none"}),t.addEventListener("pointerdown",e=>{!e.isPrimary||e.button!==0||(this.suppressClick=!1,this.viewport.scale!==1&&(this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:!1},this.suppressClick=!1,t.setPointerCapture(e.pointerId)))}),t.addEventListener("pointermove",e=>{if(!this.drag||this.drag.id!==e.pointerId)return;const n=e.clientX-this.drag.x,o=e.clientY-this.drag.y;if(!this.drag.moved&&Math.hypot(n,o)<4)return;this.drag.moved=!0;const r=t.getBoundingClientRect();this.viewport.pan(n*t.width/r.width,o*t.height/r.height),this.drag.x=e.clientX,this.drag.y=e.clientY,this.tooltip.style.display="none",this.refreshView()});const s=e=>{!this.drag||this.drag.id!==e.pointerId||(this.suppressClick=this.drag.moved,this.drag=null,t.hasPointerCapture(e.pointerId)&&t.releasePointerCapture(e.pointerId))};t.addEventListener("pointerup",s),t.addEventListener("pointercancel",s),t.addEventListener("lostpointercapture",s),t.addEventListener("wheel",e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const n=t.getBoundingClientRect();this.zoomBy(e.deltaY<0?1.15:1/1.15,(e.clientX-n.left)*t.width/n.width,(e.clientY-n.top)*t.height/n.height)},{passive:!1}),t.addEventListener("keydown",e=>{if(e.key==="+"||e.key==="=")this.zoomBy(1.3);else if(e.key==="-")this.zoomBy(1/1.3);else if(e.key==="0")this.resetView();else if(e.key.startsWith("Arrow")&&this.viewport.scale>1){const n=t.width*.08;this.viewport.pan(e.key==="ArrowLeft"?n:e.key==="ArrowRight"?-n:0,e.key==="ArrowUp"?n:e.key==="ArrowDown"?-n:0),this.refreshView()}else return;e.preventDefault()}),this.resizeObserver=new ResizeObserver(()=>{t.getBoundingClientRect().width&&this.refreshView()}),this.resizeObserver.observe(t)}async load(t,s="/map.png"){this.info=t,this.rotated=this.height()>this.width()*1.1,this.canvas.width=this.rotated?1600:1200;const e=this.rotated?this.width()/this.height():this.height()/this.width();return this.canvas.height=Math.max(1,Math.round(this.canvas.width*e)),this.viewport.reset(),new Promise(n=>{const o=new Image;o.onload=()=>{this.image=o,n()},o.onerror=()=>n(),o.src=`${s}?${Date.now()}`})}width(){return this.info.width*this.info.resolution}height(){return this.info.height*this.info.resolution}project(t,s){const e=(t-this.info.origin[0])/this.width(),n=(s-this.info.origin[1])/this.height();return this.rotated?{x:n*this.canvas.width,y:e*this.canvas.height}:{x:e*this.canvas.width,y:(1-n)*this.canvas.height}}markerUnit(){const t=this.canvas.getBoundingClientRect().width||this.canvas.width;return this.canvas.width/t/this.viewport.scale}refreshView(){var t;this.tooltip.style.display="none",this.canvas.classList.toggle("is-zoomed",this.viewport.scale>1),this.lastData&&this.lastOptions&&this.draw(this.lastData,this.lastOptions),(t=this.onViewportChange)==null||t.call(this,this.viewport.scale)}zoomBy(t,s,e){this.viewport.zoom(t,s,e),this.refreshView()}resetView(){this.viewport.reset(),this.refreshView()}revealPoint(t){if(!t||this.viewport.scale===1)return;const s=this.project(Number(t.x),Number(t.y)),e=s.x*this.viewport.scale+this.viewport.x,n=s.y*this.viewport.scale+this.viewport.y,o=this.canvas.width*.06;e>=o&&e<=this.canvas.width-o&&n>=o&&n<=this.canvas.height-o||(this.viewport.x=this.canvas.width/2-s.x*this.viewport.scale,this.viewport.y=this.canvas.height/2-s.y*this.viewport.scale,this.viewport.clamp())}clearSelection(){this.focused=null,this.focusedVehicle=null,this.refreshView()}drawGrid(){var c;const{ctx:t,canvas:s}=this;if(t.fillStyle="#f1f5f3",t.fillRect(0,0,s.width,s.height),this.image&&(this.rotated?(t.save(),t.translate(s.width,0),t.rotate(Math.PI/2),t.drawImage(this.image,0,0,s.height,s.width),t.restore()):t.drawImage(this.image,0,0,s.width,s.height)),t.fillStyle="#ffffff18",t.fillRect(0,0,s.width,s.height),!((c=this.lastOptions)!=null&&c.grid))return;t.strokeStyle="#b8c7bf66",t.lineWidth=1,t.font="11px system-ui",t.fillStyle="#536875";const e=this.width()>35?5:4,n=Math.ceil(this.info.origin[0]/e)*e,o=this.info.origin[0]+this.width();for(let h=n;h<=o;h+=e){const u=this.project(h,this.info.origin[1]),m=this.project(h,this.info.origin[1]+this.height());t.beginPath(),t.moveTo(u.x,u.y),t.lineTo(m.x,m.y),t.stroke(),this.rotated?t.fillText(`${h.toFixed(0)} m`,7,u.y-4):t.fillText(`${h.toFixed(0)} m`,u.x+4,s.height-8)}const r=Math.ceil(this.info.origin[1]/e)*e,d=this.info.origin[1]+this.height();for(let h=r;h<=d;h+=e){const u=this.project(this.info.origin[0],h),m=this.project(this.info.origin[0]+this.width(),h);t.beginPath(),t.moveTo(u.x,u.y),t.lineTo(m.x,m.y),t.stroke(),this.rotated?t.fillText(`${h.toFixed(0)} m`,u.x+4,s.height-8):t.fillText(`${h.toFixed(0)} m`,7,u.y-4)}}drawHeat(t,s,e="count",n=.65){var r;(((r=this.heatCache)==null?void 0:r.density)!==t.density||this.heatCache.metric!==e||this.heatCache.filter!==s)&&(this.heatScale=bt(t.density,e,s),this.heatCache={density:t.density,metric:e,filter:s});const o=Math.max(.2,Math.min(.9,n));[...this.heatScale.visible].reverse().forEach(d=>{const c=this.heatScale.fraction(Number(d[e])),h=16+12*c,{x:u,y:m}=this.project(d.x,d.y),p=K(c).join(", "),b=this.ctx.createRadialGradient(u,m,0,u,m,h);b.addColorStop(0,`rgba(${p}, ${o})`),b.addColorStop(.4,`rgba(${p}, ${o*.75})`),b.addColorStop(1,`rgba(${p}, 0)`),this.ctx.fillStyle=b,this.ctx.beginPath(),this.ctx.arc(u,m,h,0,Math.PI*2),this.ctx.fill(),this.hits.push({x:u,y:m,radius:h,priority:0,label:xt(d,e),heatValue:d,heatMetric:e})})}trackColor(t){let s=0;for(const e of t)s=s*31+e.charCodeAt(0)>>>0;return z[s%z.length]}trackSegments(t){const s=[];let e=[],n=null;for(const o of t){const r={x:Number(o[0]),y:Number(o[1]),time:Number(o[2])};if(![r.x,r.y,r.time].every(Number.isFinite)){e.length>1&&s.push(e),e=[],n=null;continue}if(n){const d=r.time-n.time,c=Math.hypot(r.x-n.x,r.y-n.y),h=Math.max(2.5,d*2.2+.75);(d<=0||d>12||c>h)&&(e.length>1&&s.push(e),e=[])}e.push(r),n=r}return e.length>1&&s.push(e),s}traceSegment(t){this.ctx.beginPath(),t.forEach((s,e)=>{const n=this.project(s.x,s.y);e===0?this.ctx.moveTo(n.x,n.y):this.ctx.lineTo(n.x,n.y)})}drawPathArrows(t,s){let e=0;for(let n=1;n<t.length;n+=1){const o=this.project(t[n-1].x,t[n-1].y),r=this.project(t[n].x,t[n].y);if(e+=Math.hypot(r.x-o.x,r.y-o.y),e<90)continue;e=0;const d=Math.atan2(r.y-o.y,r.x-o.x);this.ctx.save(),this.ctx.translate(r.x,r.y),this.ctx.rotate(d),this.ctx.fillStyle=s,this.ctx.strokeStyle="#071521",this.ctx.lineWidth=2,this.ctx.beginPath(),this.ctx.moveTo(8,0),this.ctx.lineTo(-5,-5),this.ctx.lineTo(-2,0),this.ctx.lineTo(-5,5),this.ctx.closePath(),this.ctx.fill(),this.ctx.stroke(),this.ctx.restore()}}drawPaths(t){this.focusedVehicle&&(t.tracks||[]).forEach(s=>{if(s.points.length<2||this.focusedVehicle&&s.vehicle_id!==this.focusedVehicle)return;const e=this.trackColor(s.vehicle_id),n=this.trackSegments(s.points);this.ctx.save(),this.ctx.lineCap="round",this.ctx.lineJoin="round";for(const o of n)this.traceSegment(o),this.ctx.strokeStyle="#ffffffdd",this.ctx.lineWidth=5*this.markerUnit(),this.ctx.stroke(),this.traceSegment(o),this.ctx.strokeStyle=e,this.ctx.lineWidth=2.5*this.markerUnit(),this.ctx.shadowColor=e,this.ctx.shadowBlur=0,this.ctx.stroke(),this.ctx.shadowBlur=0,this.drawPathArrows(o,e);this.ctx.restore()})}circle(t,s,e,n,o,r){s*=this.markerUnit()*.7;const{x:d,y:c}=this.project(t.x,t.y);this.ctx.fillStyle=e,this.ctx.beginPath(),this.ctx.arc(d,c,s,0,Math.PI*2),this.ctx.fill(),o&&(this.ctx.strokeStyle=o,this.ctx.lineWidth=2,this.ctx.stroke()),this.hits.push({x:d,y:c,radius:Math.max(s,12),priority:2,label:n,eventValue:t,eventType:r})}drawVehicle(t){var h;const{x:s,y:e}=this.project(t.x,t.y),n=t.motion_state||(t.speed<.05?"unknown":"moving"),o={moving:"#208366",side_task:"#208366",returning_route:"#208366",side_work:"#c28c30",task_planning:"#91a7b9",turning:"#3c84b5",waiting_vehicle:"#c28c30",blocked_obstacle:"#ff6856",stalled:"#ff5263",stuck:"#cb5b51",idle:"#91a7b9",planning:"#91a7b9",localizing:"#91a7b9",sensor_wait:"#91a7b9",unknown:"#91a7b9"},r=o[n]||o.unknown,d=this.markerUnit(),c=t.vehicle_id===this.focusedVehicle;if(this.ctx.save(),this.ctx.translate(s,e),this.ctx.scale(d,d),this.ctx.fillStyle="#ffffff",this.ctx.shadowColor="#23413630",this.ctx.shadowBlur=5,this.ctx.beginPath(),this.ctx.arc(0,0,c?10:8,0,Math.PI*2),this.ctx.fill(),this.ctx.shadowBlur=0,this.ctx.fillStyle=r,this.ctx.beginPath(),this.ctx.arc(0,0,c?6.5:5.5,0,Math.PI*2),this.ctx.fill(),((h=this.lastOptions)==null?void 0:h.labels)!==!1||c){const u=t.vehicle_id==="my_robot"?"AMR":t.vehicle_id.replace("vehicle_","V").replace("forklift_","F");this.ctx.font="600 11px system-ui";const m=this.ctx.measureText(u).width+14;this.ctx.fillStyle=c?"#176f56":"#fffffff2",this.ctx.beginPath(),this.ctx.roundRect(-m/2,-30,m,19,5),this.ctx.fill(),this.ctx.fillStyle=c?"#ffffff":"#334d41",this.ctx.textAlign="center",this.ctx.fillText(u,0,-17)}this.ctx.restore(),this.hits.push({x:s,y:e,radius:15*d,priority:3,vehicleId:t.vehicle_id,label:`${t.vehicle_id} · ${n.replaceAll("_"," ")} · ${t.speed.toFixed(2)} m/s
Click to see this vehicle’s route`})}drawUwbTags(){(this.info.uwb_tags||[]).forEach(t=>{const{x:s,y:e}=this.project(Number(t.x),Number(t.y));this.ctx.save(),this.ctx.translate(s,e),this.ctx.rotate(Math.PI/4),this.ctx.globalAlpha=t.enabled===!1?.35:1,this.ctx.fillStyle="#f04df2",this.ctx.shadowColor="#f04df2",this.ctx.shadowBlur=10,this.ctx.fillRect(-7,-7,14,14),this.ctx.shadowBlur=0,this.ctx.strokeStyle="#53145f",this.ctx.lineWidth=2,this.ctx.strokeRect(-7,-7,14,14),this.ctx.restore(),this.ctx.font="bold 10px system-ui",this.ctx.fillStyle="#6e187c",this.ctx.textAlign="center",this.ctx.fillText(t.id,s,e-13),this.ctx.textAlign="start",this.hits.push({x:s,y:e,radius:14,priority:3,label:`UWB tag ${t.id} · ${t.enabled===!1?"disabled":"enabled"} · battery ${Number(t.battery_pct??100).toFixed(0)}% · x ${Number(t.x).toFixed(1)}, y ${Number(t.y).toFixed(1)}, z ${Number(t.z).toFixed(1)} m`})})}draw(t,s){this.lastData=t,this.lastOptions=s,this.hits=[],this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height),this.ctx.save(),this.ctx.translate(this.viewport.x,this.viewport.y),this.ctx.scale(this.viewport.scale,this.viewport.scale),this.drawGrid(),s.heat&&this.drawHeat(t,s.heatFilter,s.heatMetric,s.heatOpacity),s.paths&&this.drawPaths(t),s.stuck&&t.stuck.slice(0,12).forEach(e=>this.circle(e,8+Math.min(10,Math.log2(e.events+1)*2),"#ffbf47cc",`${e.events} stuck event(s) · ${Math.round(e.duration)} seconds`,"#fff0bd","Stuck")),s.congestion&&t.congestion.slice(0,12).forEach(e=>this.circle(e,10+Math.min(14,e.max_vehicles*2),"#ff5263b8",`${e.events} congestion event(s) · up to ${e.max_vehicles} vehicles`,"#ff9ba5","Congestion")),s.vehicles&&(s.stateFilter==="all"?t.latest:t.latest.filter(n=>(n.motion_state||(n.speed<.05?"unknown":"moving"))===s.stateFilter)).forEach(n=>this.drawVehicle(n)),s.tags&&this.drawUwbTags(),this.drawFocus(),this.drawVehicleFocus(t),this.ctx.restore()}focusAt(t){this.focused=t,this.focusedVehicle=null,this.revealPoint(t),this.lastData&&this.lastOptions&&this.draw(this.lastData,this.lastOptions)}focusVehicle(t){var s,e;this.focused=null,this.focusedVehicle=t,this.revealPoint((e=(s=this.lastData)==null?void 0:s.latest)==null?void 0:e.find(n=>n.vehicle_id===t)),this.lastData&&this.lastOptions&&this.draw(this.lastData,this.lastOptions)}setHeatSelectionHandler(t){this.onHeatSelect=typeof t=="function"?t:null}drawFocus(){if(!this.focused||!Number.isFinite(Number(this.focused.x))||!Number.isFinite(Number(this.focused.y)))return;const{x:t,y:s}=this.project(Number(this.focused.x),Number(this.focused.y)),e=this.focused.type==="Congestion"?"#cb5b51":this.focused.type==="Heat area"?"#3777b0":"#c28c30",n=this.focused.type==="Heat area"?"Selected heat area":`${this.focused.type} · ${this.focused.events} event(s)`,o=this.markerUnit();this.ctx.save(),this.ctx.strokeStyle=e,this.ctx.lineWidth=2*o,this.ctx.beginPath(),this.ctx.arc(t,s,15*o,0,Math.PI*2),this.ctx.stroke(),this.ctx.setLineDash([3*o,4*o]),this.ctx.beginPath(),this.ctx.arc(t,s,21*o,0,Math.PI*2),this.ctx.stroke(),this.ctx.restore(),this.hits.push({x:t,y:s,radius:22*o,priority:1,label:`${n} · x ${Number(this.focused.x).toFixed(2)}, y ${Number(this.focused.y).toFixed(2)}`})}drawVehicleFocus(t){var c;if(!this.focusedVehicle)return;const s=(t.latest||[]).find(h=>h.vehicle_id===this.focusedVehicle),e=(t.tracks||[]).find(h=>h.vehicle_id===this.focusedVehicle),n=s||((c=e==null?void 0:e.points)!=null&&c.length?{x:e.points.at(-1)[0],y:e.points.at(-1)[1]}:null);if(!n)return;const{x:o,y:r}=this.project(Number(n.x),Number(n.y)),d=this.markerUnit();this.ctx.save(),this.ctx.strokeStyle="#176f56",this.ctx.lineWidth=2*d,this.ctx.beginPath(),this.ctx.arc(o,r,13*d,0,Math.PI*2),this.ctx.stroke(),this.ctx.restore(),this.hits.push({x:o,y:r,radius:16*d,priority:4,vehicleId:this.focusedVehicle,label:`${this.focusedVehicle} · selected route`})}hitAt(t,s=!1){const e=this.canvas.getBoundingClientRect(),n=(t.clientX-e.left)*this.canvas.width/e.width,o=(t.clientY-e.top)*this.canvas.height/e.height,{x:r,y:d}=this.viewport.unproject(n,o);return this.hits.filter(c=>!s||c.heatValue).map(c=>({...c,distance:Math.hypot(c.x-r,c.y-d)})).filter(c=>c.distance<=c.radius).sort((c,h)=>Number(h.priority||0)-Number(c.priority||0)||c.distance-h.distance)[0]}selectItem(t){if(this.suppressClick){this.suppressClick=!1;return}const s=this.hitAt(t);s!=null&&s.vehicleId&&this.onVehicleSelect?this.onVehicleSelect(s.vehicleId):s!=null&&s.eventValue&&this.onEventSelect?this.onEventSelect(s.eventValue,s.eventType):this.selectHeat(t),this.tooltip.style.display="none"}selectHeat(t){const s=this.hitAt(t,!0);!s||!this.onHeatSelect||(this.onHeatSelect(s.heatValue,s.heatMetric),this.tooltip.style.display="none")}showTooltip(t){var h;if((h=this.drag)!=null&&h.moved)return;const s=this.hitAt(t);if(!s){this.tooltip.style.display="none";return}this.tooltip.textContent=s.label,this.tooltip.style.display="block";const e=this.canvas.parentElement,n=e.getBoundingClientRect(),o=t.clientX-n.left+14,r=t.clientY-n.top+14,d=Math.max(6,Math.min(o,e.clientWidth-this.tooltip.offsetWidth-6)),c=Math.max(6,Math.min(r,e.clientHeight-this.tooltip.offsetHeight-6));this.tooltip.style.left=`${d}px`,this.tooltip.style.top=`${c}px`}}class $t{constructor(t,s){this.canvas=t,this.ctx=t.getContext("2d"),this.tooltip=s,this.info={origin:[-10,-10],resolution:1,width:20,height:20},this.image=null,this.rotated=!1,this.route=null,this.destination=null,this.destinationHandler=null,t.addEventListener("click",e=>{this.destinationHandler&&this.destinationHandler(this.eventToWorld(e))}),t.addEventListener("mousemove",e=>this.showCoordinates(e)),t.addEventListener("mouseleave",()=>{this.tooltip.style.display="none"})}width(){return this.info.width*this.info.resolution}height(){return this.info.height*this.info.resolution}project(t,s){const e=(t-this.info.origin[0])/this.width(),n=(s-this.info.origin[1])/this.height();return this.rotated?{x:n*this.canvas.width,y:e*this.canvas.height}:{x:e*this.canvas.width,y:(1-n)*this.canvas.height}}unproject(t,s){return this.rotated?{x:this.info.origin[0]+s/this.canvas.height*this.width(),y:this.info.origin[1]+t/this.canvas.width*this.height()}:{x:this.info.origin[0]+t/this.canvas.width*this.width(),y:this.info.origin[1]+(1-s/this.canvas.height)*this.height()}}eventToWorld(t){const s=this.canvas.getBoundingClientRect();return this.unproject((t.clientX-s.left)*this.canvas.width/s.width,(t.clientY-s.top)*this.canvas.height/s.height)}async load(t,s="/map.png"){this.info=t,this.rotated=this.height()>this.width()*1.1,this.canvas.width=this.rotated?1200:1e3;const e=this.rotated?this.width()/this.height():this.height()/this.width();return this.canvas.height=Math.max(1,Math.round(this.canvas.width*e)),new Promise(n=>{const o=new Image;o.onload=()=>{this.image=o,this.draw(),n()},o.onerror=()=>{this.draw(),n()},o.src=`${s}?${Date.now()}`})}onDestination(t){this.destinationHandler=t}setRoute(t){this.route=t,this.draw()}setDestination(t){this.destination=t,this.draw()}drawBase(){const{ctx:t,canvas:s}=this;t.fillStyle="#e9eef0",t.fillRect(0,0,s.width,s.height),this.image&&(this.rotated?(t.save(),t.translate(s.width,0),t.rotate(Math.PI/2),t.drawImage(this.image,0,0,s.height,s.width),t.restore()):t.drawImage(this.image,0,0,s.width,s.height)),t.fillStyle="#ffffff12",t.fillRect(0,0,s.width,s.height),t.strokeStyle="#43596a",t.lineWidth=7,t.strokeRect(4,4,s.width-8,s.height-8)}drawPolyline(t,s,e,n=!1){if(!t||t.length<2)return;const o=this.ctx;o.save(),o.strokeStyle=s,o.lineWidth=e,o.lineCap="round",o.lineJoin="round",o.setLineDash(n?[11,8]:[]),o.beginPath(),t.forEach(([r,d],c)=>{const h=this.project(r,d);c===0?o.moveTo(h.x,h.y):o.lineTo(h.x,h.y)}),o.stroke(),o.restore()}drawMarker(t,s,e){if(!t)return;const n=this.project(t.x,t.y),o=this.ctx;o.save(),o.fillStyle=s,o.shadowColor=s,o.shadowBlur=12,o.beginPath(),o.arc(n.x,n.y,10,0,Math.PI*2),o.fill(),o.shadowBlur=0,o.strokeStyle="#07111d",o.lineWidth=3,o.stroke(),o.font="bold 12px system-ui",o.fillStyle="#07111ddd",o.fillRect(n.x+12,n.y-13,o.measureText(e).width+10,18),o.fillStyle="#ffffff",o.fillText(e,n.x+17,n.y),o.restore()}draw(){if(this.drawBase(),!this.route){this.drawMarker(this.destination,"#b06cff","TASK");return}const t=this.ctx;for(const s of this.route.risk_cells||[]){const e=this.project(s.x,s.y),n=4+8*s.risk,o=t.createRadialGradient(e.x,e.y,0,e.x,e.y,n);o.addColorStop(0,`rgba(255, 82, 99, ${.12+s.risk*.48})`),o.addColorStop(1,"rgba(255, 82, 99, 0)"),t.fillStyle=o,t.beginPath(),t.arc(e.x,e.y,n,0,Math.PI*2),t.fill()}this.drawPolyline(this.route.baseline.points,"#70869a",4,!0),this.drawPolyline(this.route.suggested.points,"#25d0ae",6),this.drawMarker(this.route.start,"#3da4ff","START"),this.drawMarker(this.route.destination,"#b06cff","GOAL")}showCoordinates(t){const s=this.canvas.getBoundingClientRect(),e=this.eventToWorld(t);this.tooltip.textContent=`Set destination · x ${e.x.toFixed(2)}, y ${e.y.toFixed(2)}`,this.tooltip.style.display="block",this.tooltip.style.left=`${t.clientX-s.left+14}px`,this.tooltip.style.top=`${t.clientY-s.top+14}px`}}const Lt=document.querySelector("#app");document.body.classList.add("dashboard");Lt.innerHTML=`
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
      <button type="button" data-view="dispatch">
        <span aria-hidden="true">↗</span>Dispatch a task</button>
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
          <h1 id="pageTitle">Your warehouse, at a glance.</h1>
          <p id="pageDescription">See where your vehicles are and what needs attention.</p>
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
        <section id="metrics" class="metrics" aria-label="Traffic summary">
        </section>
        <div class="overview-grid">
          <section class="panel map-panel">
            <div class="panel-head">
              <div>
                <h2>Warehouse map</h2>
                <span class="sub">Explore your floor, vehicles, and traffic</span>
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
                  <label>
                    <input id="tagLayer" type="checkbox"> UWB sensor tags</label>
                  <label class="state-filter">Vehicle state <select id="stateFilter">
                      <option value="all">All states</option>
                      <option value="moving">Moving</option>
                      <option value="side_task">Travelling to side task</option>
                      <option value="returning_route">Returning to route</option>
                      <option value="side_work">Performing side work</option>
                      <option value="task_planning">Planning side task</option>
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
              <div class="heat-control-fields">
                <label class="field"><span>Measure</span><select id="heatMetric">
                  <option value="count">Traffic activity</option>
                  <option value="vehicles">Vehicle coverage</option>
                  <option value="slow_samples">Slow & waiting activity</option>
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
                <span><i class="state-dot turning"></i>Turning</span>
                <span><i class="state-dot waiting"></i>Waiting</span>
                <span><i class="state-dot blocked"></i>Blocked</span>
                <span><i class="state-dot idle"></i>Idle / other</span>
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
              <div class="heat-ranking-head"><strong id="heatRankingTitle">Most active areas</strong><span>Select an area to inspect it</span></div>
              <div id="heatAreas" class="heat-areas"></div>
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
                <h2>Your fleet <span id="fleetCount" class="count-badge">0</span>
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
      <section data-workspace="dispatch" aria-label="Task dispatch" hidden>
        <section class="panel route-panel task-panel">
          <div class="panel-head">
            <div>
              <h2>Dispatch a task</h2>
              <span class="sub">Choose a forklift and a destination. It returns to its route when the work is done.</span>
            </div>
            <span class="tag control">SIMULATION CONTROL</span>
          </div>
          <div class="route-layout">
            <form id="taskForm" class="route-controls">
              <label class="field">
                <span>Forklift</span>
                <select id="taskVehicle">
                  <option value="">Waiting for vehicles…</option>
                </select>
              </label>
              <div class="route-coordinate-row">
                <label class="field">
                  <span>Destination X (m)</span>
                  <input id="taskX" required type="number" step="0.01" placeholder="Click map">
                </label>
                <label class="field">
                  <span>Destination Y (m)</span>
                  <input id="taskY" required type="number" step="0.01" placeholder="Click map">
                </label>
              </div>
              <label class="field">
                <span>Work duration (seconds)</span>
                <input id="taskDuration" required type="number" min="0" max="3600" step="1" value="10">
              </label>
              <div class="task-actions">
                <button id="dispatchTaskButton" type="submit">Dispatch task</button>
                <button id="cancelTaskButton" type="button" class="secondary">Cancel task</button>
              </div>
              <p id="taskStatus" role="status" class="route-status">Select a forklift, then click a destination on the map.</p>
              <p class="route-safety">Simulation only. Choose an open aisle on the map. The forklift will travel there, complete the work, and return to its route.</p>
            </form>
            <div class="route-map-wrap">
              <canvas id="taskMap" width="1000" height="560">
              </canvas>
              <div id="taskTooltip" class="tooltip">
              </div>
              <div class="route-map-legend">
                <span>
                  <i class="task-goal-dot">
                  </i>selected side-work destination</span>
                <span>Click a collision-free aisle location</span>
              </div>
            </div>
            <div id="taskResult" class="route-result task-result">
              <h3>What happens next</h3>
              <ol>
                <li>Travel to the selected destination</li>
                <li>Remain there for the work duration</li>
                <li>Return to the saved route checkpoint</li>
                <li>Resume the normal route automatically</li>
              </ol>
              <div id="taskLiveStatus" role="status" class="task-live-status">No side-work status received yet.</div>
            </div>
          </div>
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
        </div>
      </section>
      <footer class="workspace-footer">
        <span>Warehouse Intelligence</span>
        <span>Position & traffic monitoring</span>
      </footer>
    </main>
  </div>
`;const a=i=>document.querySelector(i),f=new St(a("#map")),L=new $t(a("#taskMap"),a("#taskTooltip")),l={data:null,bounds:null,cursor:null,auto:!0,loading:!1,playing:!1,playbackEnd:null,playbackStart:null,lastTick:0,debounce:null,selectedHotspot:null,selectedHeat:null,selectedVehicle:null,taskLoading:!1,taskStatuses:[]},I={samples:0,latest:[],density:[],tracks:[],stuck:[],stuck_timeline:{bucket_seconds:60,buckets:[]},congestion:[],start:new Date().toISOString(),end:new Date().toISOString(),analytics:{},localization:{summary:{samples:0},vehicles:[]},uwb_validation:{live:!0,summary:{},vehicles:[]},localization_recovery:{live:!0,summary:{},vehicles:[]}};function $(i){return new Date(i.getTime()-i.getTimezoneOffset()*6e4).toISOString().slice(0,19)}function E(i){a("#selectedTime").value=$(new Date(i*1e3))}function A(i){i!==null&&(a("#timeline").value=i,a("#replayClock").textContent=new Date(i*1e3).toLocaleString())}function J(i){return l.bounds?Math.max(l.bounds.first,Math.min(l.bounds.last,i)):i}function Q(){return{paths:a("#pathLayer").checked,grid:a("#gridLayer").checked,labels:a("#labelLayer").checked,vehicles:a("#vehicleLayer").checked,heat:a("#densityLayer").checked,heatMetric:a("#heatMetric").value,heatOpacity:Number(a("#heatOpacity").value)/100,stuck:a("#stuckLayer").checked,congestion:a("#jamLayer").checked,tags:a("#tagLayer").checked,stateFilter:a("#stateFilter").value,heatFilter:Number(a("#heatFilter").value)/100}}function g(){l.data&&(f.draw(l.data,Q()),Ft())}function tt(i){var s,e,n,o,r;l.data=i,ht(a("#metrics"),i),a("#fleetCount").textContent=i.latest.length;const t=(e=(s=document.activeElement)==null?void 0:s.closest("#summaryRows [data-vehicle]"))==null?void 0:e.dataset.vehicle;if(ut(a("#summaryRows"),i.latest,((n=i.localization)==null?void 0:n.vehicles)||[]),t&&((o=[...a("#summaryRows").querySelectorAll("[data-vehicle]")].find(d=>d.dataset.vehicle===t))==null||o.focus({preventScroll:!0})),pt(a("#localization"),i.localization),mt(a("#uwbValidation"),i.uwb_validation,i.localization_recovery),l.selectedVehicle){const d=[...document.querySelectorAll("#summaryRows [data-vehicle]")].find(h=>h.dataset.vehicle===l.selectedVehicle);d&&d.classList.add("selected");const c=i.latest.find(h=>h.vehicle_id===l.selectedVehicle);a("#mapFocus").textContent=c?`${c.vehicle_id} · ${((r=c.motion_state)==null?void 0:r.replaceAll("_"," "))||"State unavailable"} · ${c.speed.toFixed(2)} m/s · x ${c.x.toFixed(1)}, y ${c.y.toFixed(1)}`:`${l.selectedVehicle} · No current position in this time window`}if(ft(a("#analytics"),i.analytics),l.selectedHeat){const d=i.density.find(c=>Math.abs(Number(c.x)-Number(l.selectedHeat.value.x))<.001&&Math.abs(Number(c.y)-Number(l.selectedHeat.value.y))<.001);d?(l.selectedHeat.value=d,P(a("#heatAreaSummary"),d,l.selectedHeat.metric)):at()}if(vt(a("#hotspots"),i),gt(a("#stuckTimeline"),i.stuck_timeline),Nt(i.latest),l.selectedHotspot){const d=[...document.querySelectorAll("#hotspots [data-hotspot]")].find(c=>Math.abs(Number(c.dataset.x)-l.selectedHotspot.x)<.001&&Math.abs(Number(c.dataset.y)-l.selectedHotspot.y)<.001&&c.dataset.type===l.selectedHotspot.type);d&&d.classList.add("selected")}a("#range").textContent=i.samples?`${new Date(i.start).toLocaleString()} — ${new Date(i.end).toLocaleString()}`:"Waiting for ROS traffic history",g()}function N(){a("#areaPanel").hidden=!0,a("#areaPanel").open=!1,l.selectedHeat=null,P(a("#heatAreaSummary"),null)}function B(i,t){var n,o;a("#areaPanel").hidden=!1,l.selectedHeat={value:i,metric:t},l.selectedVehicle=null,l.selectedHotspot=null,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(r=>r.classList.remove("selected")),document.querySelectorAll("#hotspots [data-hotspot]").forEach(r=>r.classList.remove("selected")),a("#pathLayer").checked=!1,P(a("#heatAreaSummary"),i,t),f.focusAt({x:Number(i.x),y:Number(i.y),type:"Heat area",events:Number(i[t]||0)});const s=(o=(n=i.time_details)==null?void 0:n.peaks)==null?void 0:o[t],e=s?` · busiest ${new Date(s.start*1e3).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`:"";a("#mapFocus").textContent=`${Number(i[t]||0).toLocaleString()} ${G[t].unit} · x ${Number(i.x).toFixed(1)}, y ${Number(i.y).toFixed(1)}${e}`,g()}f.setHeatSelectionHandler(B);function Nt(i){const t=a("#taskVehicle"),s=t.value;t.replaceChildren(...i.length?i.map(n=>new Option(n.vehicle_id,n.vehicle_id)):[new Option("No vehicles in this time range","")]);const e=l.selectedVehicle||s;i.some(n=>n.vehicle_id===e)&&(t.value=e)}async function W(i){if(!l.loading){l.loading=!0;try{tt(await ct(i)),D(!0,`Updated ${new Date().toLocaleTimeString()}`),a("#dataNotice").hidden=!0}catch{D(!1,"Monitor offline"),a("#dataNotice").hidden=!1,a("#dataNotice").textContent="Live updates are unavailable. Displayed data may be out of date. Reconnecting automatically…"}finally{l.loading=!1}}}async function et(i=!1){try{const t=await rt();if(t.empty){a("#replayClock").textContent="No recorded history";return}const s=l.bounds===null;l.bounds=t,a("#timeline").min=t.first,a("#timeline").max=t.last,a("#selectedTime").min=$(new Date(t.first*1e3)),a("#selectedTime").max=$(new Date(t.last*1e3)),a("#firstLog").textContent=`First ${new Date(t.first*1e3).toLocaleString()}`,a("#lastLog").textContent=`Latest ${new Date(t.last*1e3).toLocaleString()}`,(i||s||!a("#selectedTime").value)&&(l.cursor=t.last,E(Math.max(t.first,t.last-300)),a("#rangeStart").value=$(new Date(t.first*1e3)),a("#rangeEnd").value=$(new Date(t.last*1e3))),(l.cursor===null||l.auto)&&(l.cursor=t.last),A(l.cursor)}catch{a("#replayClock").textContent="History unavailable"}}function w(i="PAUSED"){l.playing=!1,l.lastTick=0,a("#playButton").textContent="▶ Play to latest",a("#playButton").className="",i&&O(i)}function T(i){if(!l.bounds)return;l.auto=!1,l.cursor=J(i),A(l.cursor);const t=Number(a("#trailMinutes").value)*60,s=l.playing&&l.playbackStart!==null?l.playbackStart:Math.max(l.bounds.first,l.cursor-t),e=Math.min(l.cursor-.001,s);W({start:new Date(e*1e3).toISOString(),end:new Date(l.cursor*1e3).toISOString()})}function F(){w(null),l.auto=!0,l.playbackStart=null,O("LIVE"),l.bounds&&(l.cursor=l.bounds.last,A(l.cursor)),W({hours:Number(a("#trailMinutes").value)/60})}function Tt(){w("HISTORY");const i=a("#selectedTime").value;i&&T(new Date(i).getTime()/1e3)}function Ct(){if(l.playing){w();return}if(!l.bounds)return;l.auto=!1;const i=new Date(a("#selectedTime").value).getTime()/1e3;l.cursor=J(Number.isFinite(i)?i:l.bounds.first),l.playbackStart=l.cursor,l.playbackEnd=l.bounds.last,l.playing=!0,l.lastTick=performance.now(),O("REPLAY"),a("#playButton").textContent="❚❚ Pause replay",a("#playButton").className="playing",T(l.cursor)}function _t(){if(!l.playing)return;const i=performance.now();if(l.loading){l.lastTick=i;return}const t=Math.min(2,(i-l.lastTick)/1e3);l.lastTick=i,l.cursor=Math.min(l.playbackEnd,l.cursor+t*Number(a("#playSpeed").value)),E(l.cursor),T(l.cursor),l.cursor>=l.playbackEnd&&w("HISTORY")}function Mt(){const i=a("#rangeStart").value,t=a("#rangeEnd").value;!i||!t||(w("HISTORY"),l.auto=!1,W({start:new Date(i).toISOString(),end:new Date(t).toISOString()}))}a("#liveButton").addEventListener("click",F);a("#jumpButton").addEventListener("click",Tt);a("#playButton").addEventListener("click",Ct);a("#applyRange").addEventListener("click",Mt);a("#stateFilter").addEventListener("change",g);function j(i,t=!0){var e,n;N(),l.selectedVehicle=i.dataset.vehicle,l.selectedHotspot=null,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(o=>{o.classList.toggle("selected",o===i)}),document.querySelectorAll("#hotspots [data-hotspot]").forEach(o=>o.classList.remove("selected")),a("#pathLayer").checked=!0,f.focusVehicle(l.selectedVehicle),[...a("#taskVehicle").options].some(o=>o.value===l.selectedVehicle)&&(a("#taskVehicle").value=l.selectedVehicle,V());const s=(n=(e=l.data)==null?void 0:e.latest)==null?void 0:n.find(o=>o.vehicle_id===l.selectedVehicle);a("#mapFocus").textContent=s?`${l.selectedVehicle} path · x ${s.x.toFixed(1)} · y ${s.y.toFixed(1)} · ${s.speed.toFixed(2)} m/s`:`${l.selectedVehicle} path`,x("overview"),g(),t&&a(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})}a("#summaryRows").addEventListener("click",i=>{const t=i.target.closest("[data-vehicle]");t&&j(t)});a("#summaryRows").addEventListener("keydown",i=>{if(i.key!=="Enter"&&i.key!==" ")return;const t=i.target.closest("[data-vehicle]");t&&(i.preventDefault(),j(t))});function st(i,t=!0){N(),l.selectedVehicle=null,a("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(e=>e.classList.remove("selected")),l.selectedHotspot={x:Number(i.dataset.x),y:Number(i.dataset.y),type:i.dataset.type,events:Number(i.dataset.events),first_started:Number(i.dataset.first)||null,last_ended:Number(i.dataset.last)||null},document.querySelectorAll("#hotspots [data-hotspot]").forEach(e=>{e.classList.toggle("selected",e===i)}),f.focusAt(l.selectedHotspot);const s=l.selectedHotspot.first_started?`${new Date(l.selectedHotspot.first_started*1e3).toLocaleString()} → ${new Date((l.selectedHotspot.last_ended||l.selectedHotspot.first_started)*1e3).toLocaleString()}`:"time unavailable";a("#mapFocus").textContent=`${l.selectedHotspot.type} · x ${l.selectedHotspot.x.toFixed(1)} · y ${l.selectedHotspot.y.toFixed(1)} · ${l.selectedHotspot.events} event(s) · ${s}`,x("overview"),g(),t&&a(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})}a("#hotspots").addEventListener("click",i=>{const t=i.target.closest("[data-hotspot]");t&&st(t)});a("#stuckTimeline").addEventListener("click",i=>{const t=i.target.closest("[data-stuck-time]");t&&(N(),l.selectedVehicle=null,a("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(s=>s.classList.remove("selected")),document.querySelectorAll("#hotspots [data-hotspot]").forEach(s=>s.classList.remove("selected")),l.selectedHotspot={x:Number(t.dataset.x),y:Number(t.dataset.y),type:"Stuck",events:Number(t.dataset.count),first_started:Number(t.dataset.time),last_ended:Number(t.dataset.time)},f.focusAt(l.selectedHotspot),E(Number(t.dataset.time)),a("#mapFocus").textContent=`Stuck at ${new Date(Number(t.dataset.time)*1e3).toLocaleTimeString()} · x ${l.selectedHotspot.x.toFixed(1)} · y ${l.selectedHotspot.y.toFixed(1)} · ${l.selectedHotspot.events} vehicle(s)`,x("overview"),g(),a(".map-panel").scrollIntoView({behavior:"smooth",block:"center"}))});function it(i){var t,s;if(N(),i.dataset.insight==="stuck")l.selectedVehicle=null,a("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(e=>e.classList.remove("selected")),l.selectedHotspot={x:Number(i.dataset.x),y:Number(i.dataset.y),type:"Stuck",events:Number(i.dataset.events),first_started:Number(i.dataset.first)||null,last_ended:Number(i.dataset.last)||null},f.focusAt(l.selectedHotspot),a("#mapFocus").textContent=`Stuck · x ${l.selectedHotspot.x.toFixed(1)} · y ${l.selectedHotspot.y.toFixed(1)} · ${l.selectedHotspot.events} event(s)`;else{const e=i.dataset.vehicle,n=(s=(t=l.data)==null?void 0:t.analytics)==null?void 0:s.worst_path;l.selectedVehicle=e,l.selectedHotspot=null,a("#pathLayer").checked=!0,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(o=>{o.classList.toggle("selected",o.dataset.vehicle===e)}),document.querySelectorAll("#hotspots [data-hotspot]").forEach(o=>o.classList.remove("selected")),f.focusVehicle(e),a("#mapFocus").textContent=`${e} path · ${i.dataset.insight==="window"?"bad interval":"worst path"}${n?` · ${n.slow_seconds.toFixed(0)} s slow`:""}`}x("overview"),g(),a(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})}a("#analytics").addEventListener("click",i=>{const t=i.target.closest("[data-insight]");t&&it(t)});a("#analytics").addEventListener("keydown",i=>{if(i.key!=="Enter"&&i.key!==" ")return;const t=i.target.closest("[data-insight]");t&&(i.preventDefault(),it(t))});["labelLayer","gridLayer","pathLayer","vehicleLayer","densityLayer","stuckLayer","jamLayer","tagLayer","heatMetric","heatFilter","heatOpacity"].forEach(i=>a(`#${i}`).addEventListener("input",g));a("#heatMetric").addEventListener("change",()=>{l.selectedHeat&&B(l.selectedHeat.value,a("#heatMetric").value)});a("#heatAreas").addEventListener("click",i=>{var e;const t=i.target.closest("[data-heat-area]");if(!t)return;const s=(e=l.data)==null?void 0:e.density.find(n=>`${n.x},${n.y}`===t.dataset.heatArea);s&&(B(s,a("#heatMetric").value),a("#areaPanel").open=!0)});a("#trailMinutes").addEventListener("change",()=>l.auto?F():l.cursor!==null&&T(l.cursor));["selectedTime","rangeStart","rangeEnd"].forEach(i=>a(`#${i}`).addEventListener("focus",()=>{l.auto=!1,w("PAUSED")}));a("#timeline").addEventListener("input",i=>{l.auto=!1,w("HISTORY"),l.cursor=Number(i.target.value),E(l.cursor),A(l.cursor),clearTimeout(l.debounce),l.debounce=setTimeout(()=>T(l.cursor),120)});function Et(i){if(!i)return"No side-work status received for this vehicle.";const t=i.task_id?`Task ${i.task_id}`:"Task",s=i.reason?` · ${i.reason.replaceAll("_"," ")}`:"";return`${t}: ${i.status.replaceAll("_"," ")}${s}`}function V(){const i=a("#taskVehicle").value,t=l.taskStatuses.find(s=>s.vehicle_id===i);a("#taskLiveStatus").textContent=Et(t)}async function H(){try{const i=await nt();l.taskStatuses=i.statuses,V(),i.enabled||(a("#taskStatus").className="route-status error",a("#taskStatus").textContent="Side-work controls are disabled in this launch.")}catch(i){a("#taskLiveStatus").textContent=`Task status unavailable: ${i.message}`}}L.onDestination(i=>{a("#taskX").value=i.x.toFixed(2),a("#taskY").value=i.y.toFixed(2),L.setDestination(i),a("#taskStatus").className="route-status",a("#taskStatus").textContent=`Task destination selected at x ${i.x.toFixed(2)}, y ${i.y.toFixed(2)}.`});a("#taskVehicle").addEventListener("change",V);a("#taskForm").addEventListener("submit",async i=>{if(i.preventDefault(),l.taskLoading)return;const t=a("#taskVehicle").value,s=Number(a("#taskX").value),e=Number(a("#taskY").value),n=Number(a("#taskDuration").value),o=a("#taskStatus");if(!t||!a("#taskX").value||!a("#taskY").value||!a("#taskDuration").value||!Number.isFinite(s)||!Number.isFinite(e)||!Number.isFinite(n)||n<0||n>3600){o.className="route-status error",o.textContent="Choose a forklift, destination, and work duration from 0–3600 seconds.";return}if(!l.auto){o.className="route-status error",o.textContent="Return to Live mode before dispatching a vehicle.";return}l.taskLoading=!0,a("#dispatchTaskButton").disabled=!0,a("#cancelTaskButton").disabled=!0,o.className="route-status loading",o.textContent=`Dispatching ${t}…`;try{const r=await X({vehicle_id:t,x:s,y:e,dwell_seconds:n});l.taskStatuses=r.statuses,o.className="route-status success",o.textContent=`${t}: task request sent. Waiting for the controller acknowledgement.`,V(),setTimeout(H,350)}catch(r){o.className="route-status error",o.textContent=r.message}finally{l.taskLoading=!1,a("#dispatchTaskButton").disabled=!1,a("#cancelTaskButton").disabled=!1}});a("#cancelTaskButton").addEventListener("click",async()=>{if(l.taskLoading)return;const i=a("#taskVehicle").value,t=a("#taskStatus");if(!i){t.className="route-status error",t.textContent="Choose a forklift to cancel its active task.";return}l.taskLoading=!0,a("#dispatchTaskButton").disabled=!0,a("#cancelTaskButton").disabled=!0;try{await X({action:"cancel",vehicle_id:i}),t.className="route-status success",t.textContent=`${i}: cancellation request sent.`,setTimeout(H,350)}catch(s){t.className="route-status error",t.textContent=s.message}finally{l.taskLoading=!1,a("#dispatchTaskButton").disabled=!1,a("#cancelTaskButton").disabled=!1}});function At(){var o,r,d;const i=a("#heatMetric").value,t=G[i],s=f.heatScale;if(!s)return;a("#heatMetricHelp").textContent=t.description,a("#heatOpacityValue").textContent=`${a("#heatOpacity").value}%`,a("#heatLegend").hidden=!s.areas.length,a("#heatScaleTitle").textContent=t.label,a("#heatAreaCount").textContent=`${s.visible.length.toLocaleString()} of ${s.areas.length.toLocaleString()} areas shown`,a("#heatScaleBar").style.background=s.min===s.max?`rgb(${K(.5).join(",")})`:yt,a("#heatScaleLow").textContent=`${s.min.toLocaleString()} ${t.unit}`,a("#heatScaleHigh").textContent=`${s.max.toLocaleString()} ${t.unit}`,a("#heatScaleNote").textContent=s.min===s.max?"All recorded areas have the same value.":"Relative intensity within this time window · colors stay consistent when filtering.",Number(a("#heatFilter").value)>0&&(a("#heatScaleNote").textContent+=` Showing ≥ ${s.threshold.toLocaleString()} ${t.unit}; ties are included.`),a("#heatRankingTitle").textContent=t.ranking;const e=a("#heatAreas"),n=s.visible.length?s.visible.slice(0,3).map((c,h)=>{var m,p;const u=((m=l.selectedHeat)==null?void 0:m.value.x)===c.x&&((p=l.selectedHeat)==null?void 0:p.value.y)===c.y;return`<button type="button" class="heat-area-button" data-heat-area="${Number(c.x)},${Number(c.y)}" aria-pressed="${u}">
      <span class="heat-rank">${h+1}</span><span><strong>${Number(c[i]).toLocaleString()} <small>${t.unit}</small></strong><small>x ${Number(c.x).toFixed(1)} · y ${Number(c.y).toFixed(1)}</small></span><span aria-hidden="true">↗</span>
    </button>`}).join(""):`<p class="heat-empty">${l.data===I?"Waiting for traffic data from the monitor.":`${t.empty} Try another measure or a longer traffic window.`}</p>`;if(e.innerHTML!==n){const c=(r=(o=document.activeElement)==null?void 0:o.closest("[data-heat-area]"))==null?void 0:r.dataset.heatArea;e.innerHTML=n,c&&((d=[...e.querySelectorAll("[data-heat-area]")].find(h=>h.dataset.heatArea===c))==null||d.focus({preventScroll:!0}))}if(l.selectedHeat){const c=l.selectedHeat.value;a("#mapFocus").textContent=`${Number(c[i]||0).toLocaleString()} ${t.unit} · average speed ${Number(c.average_speed||0).toFixed(2)} m/s · x ${Number(c.x).toFixed(1)}, y ${Number(c.y).toFixed(1)}`,s.visible.includes(c)||(a("#mapFocus").textContent+=" · Outside the current heat filter")}}function Ft(){const i=a("#densityLayer").checked,t=a("#stuckLayer").checked&&a("#jamLayer").checked,s=a("#vehicleLayer").checked,e=s&&!i&&!a("#stuckLayer").checked&&!a("#jamLayer").checked?"vehicles":s&&i&&!a("#stuckLayer").checked&&!a("#jamLayer").checked?"heat":s&&!i&&t?"issues":"custom";document.querySelectorAll("[data-map-view]").forEach(o=>{o.setAttribute("aria-pressed",String(o.dataset.mapView===e))}),a("#mapViewHint").textContent={vehicles:"Current vehicle positions",heat:"Traffic in the selected time window",issues:"Recorded stuck & congestion locations",custom:"Custom layer selection"}[e],a("#vehicleLegend").hidden=!s,a("#heatControls").hidden=!i,a("#heatInsights").hidden=!i,i&&At(),a("#issuesLegend").hidden=!a("#stuckLayer").checked&&!a("#jamLayer").checked;const n=l.selectedVehicle||l.selectedHeat||l.selectedHotspot;a("#mapSelection").classList.toggle("has-selection",!!n),a("#clearMapSelection").hidden=!n,a("#mapSelectionLabel").textContent=l.selectedVehicle?"SELECTED VEHICLE":l.selectedHeat?"SELECTED AREA":l.selectedHotspot?"SELECTED EVENT":i?"EXPLORE TRAFFIC":"EXPLORE THE MAP",n||(a("#mapFocus").textContent=i?"Select a colored area or a ranked area above to see its activity, speed, and busiest time.":"Select a vehicle to see its route. Choose Traffic heat to explore busy areas."),ot()}function at(){N(),l.selectedVehicle=null,l.selectedHotspot=null,a("#pathLayer").checked=!1,f.clearSelection(),document.querySelectorAll("#summaryRows .selected, #hotspots .selected").forEach(i=>i.classList.remove("selected")),a("#mapFocus").textContent="Select a vehicle to see its route. Choose Traffic heat to explore busy areas.",g()}function ot(){a("#mapNavigationHint").textContent=f.viewport.scale>1?"Drag to move · Fit to see the full floor":a("#densityLayer").checked?"Select a colored area · zoom for a closer look":"Zoom in to explore · select a vehicle"}f.onViewportChange=i=>{a("#mapZoomLevel").textContent=`${Math.round(i*100)}%`,a("#mapZoomIn").disabled=i>=5,a("#mapZoomOut").disabled=i<=1,ot()};f.onVehicleSelect=i=>{const t=[...a("#summaryRows").querySelectorAll("[data-vehicle]")].find(s=>s.dataset.vehicle===i);t&&j(t,!1)};f.onEventSelect=(i,t)=>{const s=[...a("#hotspots").querySelectorAll("[data-hotspot]")].find(e=>Number(e.dataset.x)===Number(i.x)&&Number(e.dataset.y)===Number(i.y)&&e.dataset.type===t);st(s||{dataset:{x:i.x,y:i.y,type:t,events:i.events,first:i.first_started,last:i.last_ended}},!1)};a("#mapZoomIn").addEventListener("click",()=>f.zoomBy(1.3));a("#mapZoomOut").addEventListener("click",()=>f.zoomBy(1/1.3));a("#mapReset").addEventListener("click",()=>f.resetView());a("#clearMapSelection").addEventListener("click",at);document.querySelectorAll("[data-map-view]").forEach(i=>{i.addEventListener("click",()=>{const t=i.dataset.mapView;a("#vehicleLayer").checked=!0,a("#densityLayer").checked=t==="heat",a("#stuckLayer").checked=t==="issues",a("#jamLayer").checked=t==="issues",g()})});const U={overview:["Overview","Your warehouse, at a glance.","See where your vehicles are and what needs attention."],activity:["Traffic history","Understand your traffic.","Find recurring slowdowns and explore recorded events."],dispatch:["Dispatch a task","Put your fleet to work.","Send a simulated forklift to a temporary job."],diagnostics:["Diagnostics","A closer look at positioning.","Compare sensor readings and investigate position accuracy."]};function x(i,t=!0){U[i]||(i="overview"),document.querySelectorAll("[data-workspace]").forEach(o=>{o.hidden=o.dataset.workspace!==i}),document.querySelectorAll("[data-view]").forEach(o=>{o.dataset.view===i?o.setAttribute("aria-current","page"):o.removeAttribute("aria-current")});const[s,e,n]=U[i];a("#breadcrumb").textContent=s,a("#pageTitle").textContent=e,a("#pageDescription").textContent=n,document.title=`${s} · Warehouse Intelligence`,t&&location.hash!==`#${i}`&&(location.hash=i)}document.querySelectorAll("[data-view], [data-open-view]").forEach(i=>{i.addEventListener("click",()=>x(i.dataset.view||i.dataset.openView))});window.addEventListener("hashchange",()=>{location.hash!=="#workspace"&&x(location.hash.slice(1),!1)});x(location.hash.slice(1),!1);a("#replayToggle").addEventListener("click",()=>{const i=a("#replayToggle").getAttribute("aria-expanded")!=="true";a("#replayToggle").setAttribute("aria-expanded",String(i)),a("#replayControls").hidden=!i});a("#fleetDetails").addEventListener("change",i=>{a("#summaryRows").classList.toggle("show-details",i.target.checked)});document.addEventListener("keydown",i=>{if(i.key==="Escape"){const t=a(".layer-menu");t.open&&(t.open=!1,t.querySelector("summary").focus())}});document.addEventListener("click",i=>{const t=a(".layer-menu");t.contains(i.target)||(t.open=!1)});async function Vt(){tt(I),a("#metrics").querySelectorAll(".metric strong").forEach(i=>{i.textContent="—"}),a("#metrics").querySelectorAll(".metric small").forEach(i=>{i.textContent="Waiting for traffic data"}),a("#fleetCount").textContent="—";try{const i=await lt();await Promise.all([f.load(i),L.load(i)]),g()}catch{await Promise.all([f.load(f.info,"/fallback-map.png"),L.load(L.info,"/fallback-map.png")]),f.draw(I,Q()),D(!1,"Map preview · ROS monitor offline")}await et(!0),await H(),F()}Vt();setInterval(_t,400);let Y=0;setInterval(()=>{l.auto&&F(),H(),Y+=1,Y%5===0&&et()},2e3);
