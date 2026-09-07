import"./modulepreload-polyfill-B5Qt9EMX.js";async function L(i,t={}){const e=await fetch(i,{cache:"no-store",...t}),s=await e.text();let a;try{a=s?JSON.parse(s):{}}catch{throw new Error(`API returned invalid JSON (${e.status})`)}if(!e.ok)throw new Error(a.error||e.statusText);return a}async function J(){const i=await L("/api/map");if(!Array.isArray(i.origin)||!i.width||!i.height||!i.resolution)throw new Error("Map metadata unavailable");return i}const K=()=>L("/api/bounds");async function Q(i){const t=await L(`/api/state?${new URLSearchParams(i)}`);if(!Array.isArray(t.latest)||!Array.isArray(t.density))throw new Error("Traffic history unavailable");return t}async function Z(i){var e,s;const t=await L("/api/routes/suggest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(i)});if(!t.advisory_only||!((e=t.baseline)!=null&&e.points)||!((s=t.suggested)!=null&&s.points))throw new Error("Route suggestion unavailable");return t}const m=i=>String(i).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),tt=i=>i.vehicle_id==="my_robot"?`${m(i.vehicle_id)} <span class="tag">AMR</span>`:m(i.vehicle_id),E={moving:["Moving","moving"],turning:["Turning normally","turning"],waiting_vehicle:["Waiting for vehicle","waiting"],blocked_obstacle:["Blocked by obstacle","blocked"],stalled:["Commanded but not moving","blocked"],stuck:["Stuck","blocked"],idle:["Idle / intentional stop","idle"],planning:["Planning next route","idle"],localizing:["Waiting for localization","idle"],sensor_wait:["Waiting for LiDAR","idle"],unknown:["State unavailable","idle"]};function B(i){const t=i.speed>=.05?"moving":"unknown",e=i.motion_state||t,[s,a]=E[e]||E.unknown;return{state:e,label:s,className:a}}function et(i,t){var o;const e=t.latest.filter(c=>B(c).state==="moving").length,s=(o=t.localization)==null?void 0:o.summary,a=s!=null&&s.samples?`${s.mean_error.toFixed(2)} m`:"—";i.innerHTML=[["samples",t.samples.toLocaleString(),"Position samples",""],["vehicles",t.latest.length,"Active vehicles","teal"],["moving",e,"Moving now","teal"],["stuck",t.stuck.length,"Stuck hotspots","orange"],["congestion",t.congestion.length,"Congestion hotspots","red"],["localization",a,"Mean AMCL error","teal"]].map(c=>`<article class="metric ${c[3]}"><strong>${c[1]}</strong><span>${c[2]}</span></article>`).join("")}function st(i,t,e=[]){if(!t.length){i.innerHTML='<div class="empty">No fresh vehicle positions at the end of this range.</div>';return}i.innerHTML=t.map(s=>{const a=B(s),o=e.find(c=>c.vehicle_id===s.vehicle_id);return`<article class="vehicle-card vehicle-action" data-vehicle="${m(s.vehicle_id)}" role="button" tabindex="0" title="Show ${m(s.vehicle_id)} path on the map">
      <div class="vehicle-card-head"><strong><i class="status-dot ${a.className}"></i>${tt(s)}</strong>
        <b class="speed">${s.speed.toFixed(2)} m/s</b></div>
      <div class="vehicle-position">Position <b>x ${s.x.toFixed(2)} m</b><b>y ${s.y.toFixed(2)} m</b></div>
      ${o?`<div class="localization-error">LiDAR AMCL error <b>${o.latest_error.toFixed(2)} m</b></div>`:""}
      <small class="motion-state ${a.className}">● ${a.label}</small>
    </article>`}).join("")}function it(i,t){const e=t==null?void 0:t.summary,s=(t==null?void 0:t.vehicles)||[];if(!(e!=null&&e.samples)){i.innerHTML='<div class="empty">Waiting for AMCL and Gazebo comparison samples…</div>';return}const a=e.mean_yaw_error*180/Math.PI;i.innerHTML=`
    <div class="localization-overview">
      <div><strong>${e.mean_error.toFixed(2)} m</strong><small>Mean error</small></div>
      <div><strong>${e.rms_error.toFixed(2)} m</strong><small>RMS error</small></div>
      <div><strong>${e.max_error.toFixed(2)} m</strong><small>Maximum</small></div>
      <div><strong>${a.toFixed(1)}°</strong><small>Mean yaw error</small></div>
    </div>
    <div class="localization-list">${s.map(o=>`
      <div class="localization-row">
        <span><b>${m(o.vehicle_id)}</b><small>${o.samples} comparisons</small></span>
        <span><strong>${o.mean_error.toFixed(2)} m</strong><small>latest ${o.latest_error.toFixed(2)} m</small></span>
      </div>`).join("")}</div>`}function at(i,t,e={}){const s=(t==null?void 0:t.vehicles)||[],a=(t==null?void 0:t.summary)||{};if(!s.length){i.innerHTML=t!=null&&t.historical?'<div class="empty">No recorded UWB validation in this time range.</div>':'<div class="empty">Waiting for live UWB validation…</div>';return}const o={confirmed:["Confirmed","confirmed"],caution:["Caution","caution"],disagreement:["Disagreement","disagreement"],uwb_unavailable:["UWB unavailable","unavailable"],waiting_amcl:["Waiting for AMCL","unavailable"],unsynchronized:["Time mismatch","unavailable"]},c=(a.uwb_unavailable||0)+(a.waiting_amcl||0)+(a.unsynchronized||0),h=t.as_of?new Date(t.as_of).toLocaleString():null,r=(e==null?void 0:e.vehicles)||[],d=new Map(r.map(u=>[u.vehicle_id,u])),p=(e==null?void 0:e.summary)||{},v=r.length?`<div class="recovery-summary ${p.interlocked?"active":""}">
        <b>Motion interlock</b>
        <span>${p.ready||0} ready · ${p.interlocked||0} stopped/recovering</span>
      </div>`:"";i.innerHTML=`
    ${v}
    <div class="uwb-overview">
      <div><strong>${a.confirmed||0}</strong><small>Confirmed</small></div>
      <div><strong>${a.caution||0}</strong><small>Caution</small></div>
      <div><strong>${a.disagreement||0}</strong><small>Disagree</small></div>
      <div><strong>${c}</strong><small>Not compared</small></div>
    </div>
    <div class="uwb-list">${s.map(u=>{var D;const[g,x]=o[u.state]||["Unknown","unavailable"],w=Number.isFinite(u.error_m)?`${u.error_m.toFixed(2)} m difference`:u.state==="unsynchronized"&&Number.isFinite(u.measurement_skew_s)?`${u.measurement_skew_s.toFixed(2)} s time mismatch`:((D=u.uwb_reason)==null?void 0:D.replaceAll("_"," "))||"No comparison",S=u.raw_state&&u.raw_state!==u.state?` · checking ${u.raw_state.replaceAll("_"," ")}`:"",A=d.get(u.vehicle_id),X=A?` · interlock ${A.state.replaceAll("_"," ")}`:"";return`<div class="uwb-row">
        <span><b>${m(u.vehicle_id)}</b><small>${u.visible_tag_count||0} tags visible · ${m(w)}${m(S)}${m(X)}</small></span>
        <strong class="uwb-state ${x}">${g}</strong>
      </div>`}).join("")}</div>
    <p class="uwb-note">${t.live?"Live comparison":`Recorded comparison${h?` at ${h}`:""}`}. AMCL remains the position source; UWB is confirmation only.</p>`}function ot(i,t){const e=t==null?void 0:t.most_stuck_location,s=t==null?void 0:t.worst_path,a=(o,c)=>o?`${new Date(o*1e3).toLocaleString()} → ${new Date((c||o)*1e3).toLocaleString()}`:"No slow/stuck interval in this range";i.innerHTML=`
    <div class="insight-row ${e?"insight-action":""}" ${e?`data-insight="stuck" role="button" tabindex="0" data-x="${e.x}" data-y="${e.y}" data-events="${e.events}" data-first="${e.first_started||""}" data-last="${e.last_ended||""}"`:""}>
      <i class="insight-icon orange">!</i><div><b>Most stuck position</b><small>${e?`x ${e.x.toFixed(2)} · y ${e.y.toFixed(2)} · ${e.events} event(s)`:"No stuck position recorded"}</small>${e?`<em>${a(e.first_started,e.last_ended)}</em>`:""}</div>
    </div>
    <div class="insight-row ${s?"insight-action":""}" ${s?`data-insight="path" role="button" tabindex="0" data-vehicle="${m(s.vehicle_id)}"`:""}>
      <i class="insight-icon red">↝</i><div><b>Worst vehicle path</b><small>${s?`${m(s.vehicle_id)} · ${s.reason}`:"No vehicle path recorded"}</small>${s?`<em>${s.distance_m.toFixed(1)} m travelled · ${s.slow_seconds.toFixed(0)} s slow</em>`:""}</div>
    </div>
    <div class="insight-row ${s?"insight-action":""}" ${s?`data-insight="window" role="button" tabindex="0" data-vehicle="${m(s.vehicle_id)}"`:""}>
      <i class="insight-icon blue">◷</i><div><b>Bad path window</b><small>${s?a(s.bad_when_start,s.bad_when_end):"No bad interval found"}</small>${s?`<em>Average speed ${s.average_speed.toFixed(2)} m/s</em>`:""}</div>
    </div>`}function nt(i,t){const e=[...t.congestion.map(s=>({...s,type:"Congestion",color:"var(--red)"})),...t.stuck.map(s=>({...s,type:"Stuck",color:"var(--orange)"}))].sort((s,a)=>a.events-s.events).slice(0,6);i.innerHTML=e.length?e.map(s=>`<button type="button" class="hotspot-row" data-hotspot
    data-x="${s.x}" data-y="${s.y}" data-type="${s.type}"
    data-events="${s.events}" data-first="${s.first_started||""}" data-last="${s.last_ended||""}"
    title="Show ${s.type.toLowerCase()} location on the map">
    <span><b style="color:${s.color}">${s.type}</b><small>x ${s.x.toFixed(1)} · y ${s.y.toFixed(1)}</small></span>
    <span class="hotspot-count"><strong>${s.events}×</strong><small>View map</small></span>
  </button>`).join(""):'<div class="empty">No stuck or congestion events.</div>'}function lt(i,t){const e=(t==null?void 0:t.buckets)||[];if(!e.length){i.innerHTML='<div class="empty">No stuck vehicles in this time range.</div>';return}const s=t.bucket_seconds||60,a=s<3600?`${s/60} minute${s===60?"":"s"}`:`${s/3600} hour${s===3600?"":"s"}`;i.innerHTML=`
    <p class="timeline-note">Busiest stuck location per ${a}; newest first.</p>
    <div class="stuck-time-list">${[...e].reverse().map(o=>{const c=o.hotspot,h=new Date(o.start*1e3).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),r=c.vehicle_ids.map(m).join(", ");return`<button type="button" class="stuck-time-row" data-stuck-time
        data-x="${c.x}" data-y="${c.y}"
        data-time="${o.start}" data-count="${c.vehicles}"
        title="Show this stuck location on the map">
        <span><b>${h}</b><small>x ${c.x.toFixed(1)} · y ${c.y.toFixed(1)}</small></span>
        <span><strong>${c.vehicles}</strong><small>at hotspot · ${o.total_vehicles} total</small></span>
        <em>${r}</em>
      </button>`}).join("")}</div>`}function I(i,t){if(!t){i.innerHTML='<div class="empty">Choose a forklift and click a destination on the route map.</div>';return}const e=o=>o>=60?`${(o/60).toFixed(1)} min`:`${o.toFixed(0)} sec`,s=t.suggested.distance_m-t.baseline.distance_m,a=t.destination.snapped?'<p class="route-warning">Destination was moved to the nearest collision-clear map cell.</p>':"";i.innerHTML=`
    <div class="route-result-grid">
      <div><small>Suggested distance</small><strong>${t.suggested.distance_m.toFixed(1)} m</strong><span>${s>.05?`+${s.toFixed(1)} m vs shortest`:"same as shortest"}</span></div>
      <div><small>Estimated time</small><strong>${e(t.suggested.eta_s)}</strong><span>at selected nominal speed</span></div>
      <div><small>Traffic risk</small><strong>${t.suggested.risk_score.toFixed(0)} / 100</strong><span>${t.risk_reduction.toFixed(1)} points lower</span></div>
      <div><small>Hotspots avoided</small><strong>${t.hotspots_avoided}</strong><span>from this history window</span></div>
    </div>
    <p class="route-explanation">${m(t.explanation)}</p>
    ${a}
    <p class="route-meta">Generated ${new Date(t.generated_at).toLocaleString()} using traffic from ${new Date(t.traffic_window.start).toLocaleString()} to ${new Date(t.traffic_window.end).toLocaleString()}.</p>`}function F(i,t){const e=document.querySelector("#connection");e.classList.toggle("error",!i),e.querySelector("span").textContent=t}function C(i){const t=document.querySelector("#mode");t.textContent=i,t.className=`mode ${i.toLowerCase()}`}const H=["#8d6bff","#00a7d8","#ef7d50","#21a47b","#d45fc0","#789637","#d99924","#4a75dc","#d35c69"];function V(i,t){if(![Number(i),Number(t)].every(Number.isFinite))return"time unavailable";const e=new Date(Number(i)*1e3),s=new Date(Number(t)*1e3),a=e.toLocaleDateString()===s.toLocaleDateString(),o={hour:"2-digit",minute:"2-digit"};return a?`${e.toLocaleDateString()} ${e.toLocaleTimeString([],o)}–${s.toLocaleTimeString([],o)}`:`${e.toLocaleString([],o)}–${s.toLocaleString([],o)}`}function ct(i,t="count"){var h,r,d,p;const e=Number(i[t]||0),s=t==="vehicles"?`${e} unique vehicle(s)`:t==="slow_samples"?`${e} slow sample(s)`:`${e} occupancy sample(s)`,a=[`Heat cell · x ${Number(i.x).toFixed(2)}, y ${Number(i.y).toFixed(2)}`,`${s} · average ${Number(i.average_speed||0).toFixed(2)} m/s`],o=(r=(h=i.time_details)==null?void 0:h.peaks)==null?void 0:r[t];o&&(a.push(`Busiest: ${V(o.start,o.end)}`),a.push(`At peak: ${o.count} samples · ${o.vehicles} vehicle(s) · ${o.slow_samples} slow`),(d=o.vehicle_ids)!=null&&d.length&&a.push(`Vehicles: ${o.vehicle_ids.join(", ")}`));const c=(p=i.time_details)==null?void 0:p.stuck;return c!=null&&c.events?(a.push(`Confirmed stuck: ${c.events} event(s) · ${c.vehicles} vehicle(s)`),c.peak&&a.push(`Most stuck: ${V(c.peak.start,c.peak.end)}`)):a.push("Confirmed stuck: none in this range"),a.join(`
`)}class rt{constructor(t){this.canvas=t,this.ctx=t.getContext("2d"),this.info={origin:[-18.6,-26.3],resolution:.05,width:607,height:1004},this.image=null,this.hits=[],this.focused=null,this.focusedVehicle=null,this.lastData=null,this.lastOptions=null,this.rotated=!1,this.tooltip=document.querySelector("#mapTooltip"),t.addEventListener("mousemove",e=>this.showTooltip(e)),t.addEventListener("mouseleave",()=>{this.tooltip.style.display="none"})}async load(t,e="/map.png"){this.info=t,this.rotated=this.height()>this.width()*1.1,this.canvas.width=this.rotated?1600:1200;const s=this.rotated?this.width()/this.height():this.height()/this.width();return this.canvas.height=Math.max(1,Math.round(this.canvas.width*s)),new Promise(a=>{const o=new Image;o.onload=()=>{this.image=o,a()},o.onerror=()=>a(),o.src=`${e}?${Date.now()}`})}width(){return this.info.width*this.info.resolution}height(){return this.info.height*this.info.resolution}project(t,e){const s=(t-this.info.origin[0])/this.width(),a=(e-this.info.origin[1])/this.height();return this.rotated?{x:a*this.canvas.width,y:s*this.canvas.height}:{x:s*this.canvas.width,y:(1-a)*this.canvas.height}}drawGrid(){const{ctx:t,canvas:e}=this;t.fillStyle="#e9eef0",t.fillRect(0,0,e.width,e.height),this.image&&(this.rotated?(t.save(),t.translate(e.width,0),t.rotate(Math.PI/2),t.drawImage(this.image,0,0,e.height,e.width),t.restore()):t.drawImage(this.image,0,0,e.width,e.height)),t.fillStyle="#ffffff18",t.fillRect(0,0,e.width,e.height),t.strokeStyle="#aebbc499",t.lineWidth=1,t.font="11px system-ui",t.fillStyle="#536875";const s=this.width()>35?5:4,a=Math.ceil(this.info.origin[0]/s)*s,o=this.info.origin[0]+this.width();for(let r=a;r<=o;r+=s){const d=this.project(r,this.info.origin[1]),p=this.project(r,this.info.origin[1]+this.height());t.beginPath(),t.moveTo(d.x,d.y),t.lineTo(p.x,p.y),t.stroke(),this.rotated?t.fillText(`${r.toFixed(0)} m`,7,d.y-4):t.fillText(`${r.toFixed(0)} m`,d.x+4,e.height-8)}const c=Math.ceil(this.info.origin[1]/s)*s,h=this.info.origin[1]+this.height();for(let r=c;r<=h;r+=s){const d=this.project(this.info.origin[0],r),p=this.project(this.info.origin[0]+this.width(),r);t.beginPath(),t.moveTo(d.x,d.y),t.lineTo(p.x,p.y),t.stroke(),this.rotated?t.fillText(`${r.toFixed(0)} m`,d.x+4,e.height-8):t.fillText(`${r.toFixed(0)} m`,7,d.y-4)}t.strokeStyle="#43596a",t.lineWidth=7,t.strokeRect(4,4,e.width-8,e.height-8)}drawHeat(t,e,s="count"){if(!t.density.length)return;const a=t.density.map(d=>Number(d[s]||0)).sort((d,p)=>d-p),o=a[Math.floor((a.length-1)*e)]||0,c=Math.max(o+1,a[Math.floor((a.length-1)*.95)]||1),h=Math.log1p(o),r=Math.max(.001,Math.log1p(c)-h);t.density.forEach(d=>{const p=Number(d[s]||0);if(p<o)return;const v=Math.max(0,Math.min(1,(Math.log1p(p)-h)/r)),u=12+16*v,{x:g,y:x}=this.project(d.x,d.y),w=this.ctx.createRadialGradient(g,x,0,g,x,u),S=Math.round(210*(1-v));w.addColorStop(0,`hsla(${S}, 90%, 53%, ${.15+.4*v})`),w.addColorStop(1,`hsla(${S}, 90%, 53%, 0)`),this.ctx.fillStyle=w,this.ctx.beginPath(),this.ctx.arc(g,x,u,0,Math.PI*2),this.ctx.fill(),this.hits.push({x:g,y:x,radius:u,priority:0,label:ct(d,s)})})}trackColor(t){let e=0;for(const s of t)e=e*31+s.charCodeAt(0)>>>0;return H[e%H.length]}trackSegments(t){const e=[];let s=[],a=null;for(const o of t){const c={x:Number(o[0]),y:Number(o[1]),time:Number(o[2])};if(![c.x,c.y,c.time].every(Number.isFinite)){s.length>1&&e.push(s),s=[],a=null;continue}if(a){const h=c.time-a.time,r=Math.hypot(c.x-a.x,c.y-a.y),d=Math.max(2.5,h*2.2+.75);(h<=0||h>12||r>d)&&(s.length>1&&e.push(s),s=[])}s.push(c),a=c}return s.length>1&&e.push(s),e}traceSegment(t){this.ctx.beginPath(),t.forEach((e,s)=>{const a=this.project(e.x,e.y);s===0?this.ctx.moveTo(a.x,a.y):this.ctx.lineTo(a.x,a.y)})}drawPathArrows(t,e){let s=0;for(let a=1;a<t.length;a+=1){const o=this.project(t[a-1].x,t[a-1].y),c=this.project(t[a].x,t[a].y);if(s+=Math.hypot(c.x-o.x,c.y-o.y),s<90)continue;s=0;const h=Math.atan2(c.y-o.y,c.x-o.x);this.ctx.save(),this.ctx.translate(c.x,c.y),this.ctx.rotate(h),this.ctx.fillStyle=e,this.ctx.strokeStyle="#071521",this.ctx.lineWidth=2,this.ctx.beginPath(),this.ctx.moveTo(8,0),this.ctx.lineTo(-5,-5),this.ctx.lineTo(-2,0),this.ctx.lineTo(-5,5),this.ctx.closePath(),this.ctx.fill(),this.ctx.stroke(),this.ctx.restore()}}drawPaths(t){this.focusedVehicle&&(t.tracks||[]).forEach(e=>{if(e.points.length<2||this.focusedVehicle&&e.vehicle_id!==this.focusedVehicle)return;const s=this.trackColor(e.vehicle_id),a=this.trackSegments(e.points);this.ctx.save(),this.ctx.lineCap="round",this.ctx.lineJoin="round";for(const o of a)this.traceSegment(o),this.ctx.strokeStyle="#071521cc",this.ctx.lineWidth=8,this.ctx.stroke(),this.traceSegment(o),this.ctx.strokeStyle=s,this.ctx.lineWidth=4.5,this.ctx.shadowColor=s,this.ctx.shadowBlur=5,this.ctx.stroke(),this.ctx.shadowBlur=0,this.drawPathArrows(o,s);this.ctx.restore()})}circle(t,e,s,a,o){const{x:c,y:h}=this.project(t.x,t.y);this.ctx.fillStyle=s,this.ctx.beginPath(),this.ctx.arc(c,h,e,0,Math.PI*2),this.ctx.fill(),o&&(this.ctx.strokeStyle=o,this.ctx.lineWidth=2,this.ctx.stroke()),this.hits.push({x:c,y:h,radius:Math.max(e,12),priority:2,label:a})}drawVehicle(t){const{x:e,y:s}=this.project(t.x,t.y),a=t.motion_state||(t.speed<.05?"unknown":"moving"),o={moving:"#25d0ae",turning:"#3da4ff",waiting_vehicle:"#ffbf47",blocked_obstacle:"#ff6856",stalled:"#ff5263",stuck:"#ff5263",idle:"#91a7b9",planning:"#91a7b9",localizing:"#91a7b9",sensor_wait:"#91a7b9",unknown:"#91a7b9"},c=t.vehicle_id==="my_robot"?"#ffffff":o[a]||o.unknown;this.ctx.shadowColor="#07111a",this.ctx.shadowBlur=8,this.ctx.fillStyle=c,this.ctx.beginPath(),this.ctx.arc(e,s,9,0,Math.PI*2),this.ctx.fill(),this.ctx.shadowBlur=0,this.ctx.strokeStyle="#132638",this.ctx.lineWidth=2,this.ctx.stroke();const h=t.vehicle_id.replace("vehicle_","V");this.ctx.font="bold 11px system-ui";const r=this.ctx.measureText(h).width+10;this.ctx.fillStyle="#0b1825e8",this.ctx.fillRect(e-r/2,s-29,r,16),this.ctx.fillStyle="#f2f7fa",this.ctx.textAlign="center",this.ctx.fillText(h,e,s-17),this.ctx.textAlign="start",this.hits.push({x:e,y:s,radius:13,priority:3,label:`${t.vehicle_id} · ${a.replaceAll("_"," ")} · ${t.speed.toFixed(2)} m/s · x ${t.x.toFixed(2)}, y ${t.y.toFixed(2)}`})}drawUwbTags(){(this.info.uwb_tags||[]).forEach(t=>{const{x:e,y:s}=this.project(Number(t.x),Number(t.y));this.ctx.save(),this.ctx.translate(e,s),this.ctx.rotate(Math.PI/4),this.ctx.globalAlpha=t.enabled===!1?.35:1,this.ctx.fillStyle="#f04df2",this.ctx.shadowColor="#f04df2",this.ctx.shadowBlur=10,this.ctx.fillRect(-7,-7,14,14),this.ctx.shadowBlur=0,this.ctx.strokeStyle="#53145f",this.ctx.lineWidth=2,this.ctx.strokeRect(-7,-7,14,14),this.ctx.restore(),this.ctx.font="bold 10px system-ui",this.ctx.fillStyle="#6e187c",this.ctx.textAlign="center",this.ctx.fillText(t.id,e,s-13),this.ctx.textAlign="start",this.hits.push({x:e,y:s,radius:14,priority:3,label:`UWB tag ${t.id} · ${t.enabled===!1?"disabled":"enabled"} · battery ${Number(t.battery_pct??100).toFixed(0)}% · x ${Number(t.x).toFixed(1)}, y ${Number(t.y).toFixed(1)}, z ${Number(t.z).toFixed(1)} m`})})}draw(t,e){this.lastData=t,this.lastOptions=e,this.hits=[],this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height),this.drawGrid(),e.heat&&this.drawHeat(t,e.heatFilter,e.heatMetric),e.paths&&this.drawPaths(t),e.stuck&&t.stuck.slice(0,12).forEach(s=>this.circle(s,8+Math.min(10,Math.log2(s.events+1)*2),"#ffbf47cc",`${s.events} stuck event(s) · ${Math.round(s.duration)} seconds`,"#fff0bd")),e.congestion&&t.congestion.slice(0,12).forEach(s=>this.circle(s,10+Math.min(14,s.max_vehicles*2),"#ff5263b8",`${s.events} congestion event(s) · up to ${s.max_vehicles} vehicles`,"#ff9ba5")),e.vehicles&&(e.stateFilter==="all"?t.latest:t.latest.filter(a=>(a.motion_state||(a.speed<.05?"unknown":"moving"))===e.stateFilter)).forEach(a=>this.drawVehicle(a)),e.tags&&this.drawUwbTags(),this.drawFocus(),this.drawVehicleFocus(t)}focusAt(t){this.focused=t,this.focusedVehicle=null,this.lastData&&this.lastOptions&&this.draw(this.lastData,this.lastOptions)}focusVehicle(t){this.focused=null,this.focusedVehicle=t,this.lastData&&this.lastOptions&&this.draw(this.lastData,this.lastOptions)}drawFocus(){if(!this.focused||!Number.isFinite(Number(this.focused.x))||!Number.isFinite(Number(this.focused.y)))return;const{x:t,y:e}=this.project(Number(this.focused.x),Number(this.focused.y)),s=this.focused.type==="Congestion"?"#ff5263":"#ffbf47",a=`${this.focused.type} · ${this.focused.events} event(s)`;this.ctx.save(),this.ctx.strokeStyle=s,this.ctx.lineWidth=3,this.ctx.shadowColor=s,this.ctx.shadowBlur=14,this.ctx.beginPath(),this.ctx.arc(t,e,20,0,Math.PI*2),this.ctx.stroke(),this.ctx.shadowBlur=0,this.ctx.beginPath(),this.ctx.moveTo(t-30,e),this.ctx.lineTo(t+30,e),this.ctx.moveTo(t,e-30),this.ctx.lineTo(t,e+30),this.ctx.stroke(),this.ctx.font="bold 11px system-ui";const o=this.ctx.measureText(a).width+14;this.ctx.fillStyle="#07111aeb",this.ctx.fillRect(t-o/2,e+27,o,18),this.ctx.fillStyle="#f2f7fa",this.ctx.textAlign="center",this.ctx.fillText(a,t,e+40),this.ctx.textAlign="start",this.ctx.restore(),this.hits.push({x:t,y:e,radius:32,priority:4,label:`${a} · x ${Number(this.focused.x).toFixed(2)}, y ${Number(this.focused.y).toFixed(2)}`})}drawVehicleFocus(t){var d;if(!this.focusedVehicle)return;const e=(t.latest||[]).find(p=>p.vehicle_id===this.focusedVehicle),s=(t.tracks||[]).find(p=>p.vehicle_id===this.focusedVehicle),a=e||((d=s==null?void 0:s.points)!=null&&d.length?{x:s.points.at(-1)[0],y:s.points.at(-1)[1]}:null);if(!a)return;const{x:o,y:c}=this.project(Number(a.x),Number(a.y));this.ctx.save(),this.ctx.strokeStyle="#b06cff",this.ctx.lineWidth=3,this.ctx.shadowColor="#b06cff",this.ctx.shadowBlur=16,this.ctx.beginPath(),this.ctx.arc(o,c,22,0,Math.PI*2),this.ctx.stroke(),this.ctx.shadowBlur=0,this.ctx.font="bold 11px system-ui";const h=`${this.focusedVehicle} path`,r=this.ctx.measureText(h).width+14;this.ctx.fillStyle="#07111aeb",this.ctx.fillRect(o-r/2,c+28,r,18),this.ctx.fillStyle="#f2f7fa",this.ctx.textAlign="center",this.ctx.fillText(h,o,c+41),this.ctx.textAlign="start",this.ctx.restore(),this.hits.push({x:o,y:c,radius:34,priority:4,label:`${h} · x ${Number(a.x).toFixed(2)}, y ${Number(a.y).toFixed(2)}`})}showTooltip(t){const e=this.canvas.getBoundingClientRect(),s=(t.clientX-e.left)*this.canvas.width/e.width,a=(t.clientY-e.top)*this.canvas.height/e.height,o=this.hits.map(u=>({...u,distance:Math.hypot(u.x-s,u.y-a)})).filter(u=>u.distance<=u.radius).sort((u,g)=>Number(g.priority||0)-Number(u.priority||0)||u.distance-g.distance)[0];if(!o){this.tooltip.style.display="none";return}this.tooltip.textContent=o.label,this.tooltip.style.display="block";const c=this.canvas.parentElement,h=c.getBoundingClientRect(),r=t.clientX-h.left+14,d=t.clientY-h.top+14,p=Math.max(6,Math.min(r,c.clientWidth-this.tooltip.offsetWidth-6)),v=Math.max(6,Math.min(d,c.clientHeight-this.tooltip.offsetHeight-6));this.tooltip.style.left=`${p}px`,this.tooltip.style.top=`${v}px`}}class dt{constructor(t,e){this.canvas=t,this.ctx=t.getContext("2d"),this.tooltip=e,this.info={origin:[-10,-10],resolution:1,width:20,height:20},this.image=null,this.rotated=!1,this.route=null,this.destinationHandler=null,t.addEventListener("click",s=>{this.destinationHandler&&this.destinationHandler(this.eventToWorld(s))}),t.addEventListener("mousemove",s=>this.showCoordinates(s)),t.addEventListener("mouseleave",()=>{this.tooltip.style.display="none"})}width(){return this.info.width*this.info.resolution}height(){return this.info.height*this.info.resolution}project(t,e){const s=(t-this.info.origin[0])/this.width(),a=(e-this.info.origin[1])/this.height();return this.rotated?{x:a*this.canvas.width,y:s*this.canvas.height}:{x:s*this.canvas.width,y:(1-a)*this.canvas.height}}unproject(t,e){return this.rotated?{x:this.info.origin[0]+e/this.canvas.height*this.width(),y:this.info.origin[1]+t/this.canvas.width*this.height()}:{x:this.info.origin[0]+t/this.canvas.width*this.width(),y:this.info.origin[1]+(1-e/this.canvas.height)*this.height()}}eventToWorld(t){const e=this.canvas.getBoundingClientRect();return this.unproject((t.clientX-e.left)*this.canvas.width/e.width,(t.clientY-e.top)*this.canvas.height/e.height)}async load(t,e="/map.png"){this.info=t,this.rotated=this.height()>this.width()*1.1,this.canvas.width=this.rotated?1200:1e3;const s=this.rotated?this.width()/this.height():this.height()/this.width();return this.canvas.height=Math.max(1,Math.round(this.canvas.width*s)),new Promise(a=>{const o=new Image;o.onload=()=>{this.image=o,this.draw(),a()},o.onerror=()=>{this.draw(),a()},o.src=`${e}?${Date.now()}`})}onDestination(t){this.destinationHandler=t}setRoute(t){this.route=t,this.draw()}drawBase(){const{ctx:t,canvas:e}=this;t.fillStyle="#e9eef0",t.fillRect(0,0,e.width,e.height),this.image&&(this.rotated?(t.save(),t.translate(e.width,0),t.rotate(Math.PI/2),t.drawImage(this.image,0,0,e.height,e.width),t.restore()):t.drawImage(this.image,0,0,e.width,e.height)),t.fillStyle="#ffffff12",t.fillRect(0,0,e.width,e.height),t.strokeStyle="#43596a",t.lineWidth=7,t.strokeRect(4,4,e.width-8,e.height-8)}drawPolyline(t,e,s,a=!1){if(!t||t.length<2)return;const o=this.ctx;o.save(),o.strokeStyle=e,o.lineWidth=s,o.lineCap="round",o.lineJoin="round",o.setLineDash(a?[11,8]:[]),o.beginPath(),t.forEach(([c,h],r)=>{const d=this.project(c,h);r===0?o.moveTo(d.x,d.y):o.lineTo(d.x,d.y)}),o.stroke(),o.restore()}drawMarker(t,e,s){if(!t)return;const a=this.project(t.x,t.y),o=this.ctx;o.save(),o.fillStyle=e,o.shadowColor=e,o.shadowBlur=12,o.beginPath(),o.arc(a.x,a.y,10,0,Math.PI*2),o.fill(),o.shadowBlur=0,o.strokeStyle="#07111d",o.lineWidth=3,o.stroke(),o.font="bold 12px system-ui",o.fillStyle="#07111ddd",o.fillRect(a.x+12,a.y-13,o.measureText(s).width+10,18),o.fillStyle="#ffffff",o.fillText(s,a.x+17,a.y),o.restore()}draw(){if(this.drawBase(),!this.route)return;const t=this.ctx;for(const e of this.route.risk_cells||[]){const s=this.project(e.x,e.y),a=4+8*e.risk,o=t.createRadialGradient(s.x,s.y,0,s.x,s.y,a);o.addColorStop(0,`rgba(255, 82, 99, ${.12+e.risk*.48})`),o.addColorStop(1,"rgba(255, 82, 99, 0)"),t.fillStyle=o,t.beginPath(),t.arc(s.x,s.y,a,0,Math.PI*2),t.fill()}this.drawPolyline(this.route.baseline.points,"#70869a",4,!0),this.drawPolyline(this.route.suggested.points,"#25d0ae",6),this.drawMarker(this.route.start,"#3da4ff","START"),this.drawMarker(this.route.destination,"#b06cff","GOAL")}showCoordinates(t){const e=this.canvas.getBoundingClientRect(),s=this.eventToWorld(t);this.tooltip.textContent=`Set destination · x ${s.x.toFixed(2)}, y ${s.y.toFixed(2)}`,this.tooltip.style.display="block",this.tooltip.style.left=`${t.clientX-e.left+14}px`,this.tooltip.style.top=`${t.clientY-e.top+14}px`}}const ht=document.querySelector("#app");ht.innerHTML=`
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
      <div class="primary-column">
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

      <section class="panel route-panel">
        <div class="panel-head">
          <div>
            <h2>Route suggestions</h2>
            <span class="sub">Compare the shortest path with a lower-traffic path for one forklift</span>
          </div>
          <span class="tag advisory">ADVISORY ONLY</span>
        </div>

        <div class="route-layout">
          <form id="routeForm" class="route-controls">
            <label class="field">
              <span>Forklift</span>
              <select id="routeVehicle"><option value="">Waiting for vehicles…</option></select>
            </label>
            <div class="route-coordinate-row">
              <label class="field">
                <span>Destination X (m)</span>
                <input id="routeX" type="number" step="0.01" placeholder="Click map">
              </label>
              <label class="field">
                <span>Destination Y (m)</span>
                <input id="routeY" type="number" step="0.01" placeholder="Click map">
              </label>
            </div>
            <label class="field">
              <span>Nominal speed</span>
              <select id="routeSpeed">
                <option value="0.6">0.6 m/s</option>
                <option value="0.8" selected>0.8 m/s</option>
                <option value="1.2">1.2 m/s</option>
              </select>
            </label>
            <button id="suggestRouteButton" type="submit">Suggest lower-risk route</button>
            <p id="routeStatus" class="route-status">Select a forklift, then click its destination on the mini-map.</p>
            <p class="route-safety">This tool never publishes <code>cmd_vel</code> or a Nav2 goal.</p>
          </form>

          <div class="route-map-wrap">
            <canvas id="routeMap" width="1000" height="560"></canvas>
            <div id="routeTooltip" class="tooltip"></div>
            <div class="route-map-legend">
              <span><i class="route-line baseline"></i>shortest</span>
              <span><i class="route-line suggested"></i>suggested</span>
              <span><i class="route-risk-dot"></i>traffic risk</span>
            </div>
          </div>

          <div id="routeResult" class="route-result">
            <div class="empty">Choose a forklift and click a destination on the route map.</div>
          </div>
        </div>
      </section>
      </div>

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

        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>Stuck by time</h2>
              <span class="sub">When, where, and how many vehicles were stuck</span>
            </div>
          </div>
          <div id="stuckTimeline" class="stuck-timeline">
            <div class="empty">No stuck vehicles in this time range.</div>
          </div>
        </section>
      </aside>
    </div>
  </main>
`;const l=i=>document.querySelector(i),f=new rt(l("#map")),b=new dt(l("#routeMap"),l("#routeTooltip")),n={data:null,bounds:null,cursor:null,auto:!0,loading:!1,playing:!1,playbackEnd:null,playbackStart:null,lastTick:0,debounce:null,selectedHotspot:null,selectedVehicle:null,route:null,routeLoading:!1},P={samples:0,latest:[],density:[],tracks:[],stuck:[],stuck_timeline:{bucket_seconds:60,buckets:[]},congestion:[],start:new Date().toISOString(),end:new Date().toISOString(),analytics:{},localization:{summary:{samples:0},vehicles:[]},uwb_validation:{live:!0,summary:{},vehicles:[]},localization_recovery:{live:!0,summary:{},vehicles:[]}};function $(i){return new Date(i.getTime()-i.getTimezoneOffset()*6e4).toISOString().slice(0,19)}function _(i){l("#selectedTime").value=$(new Date(i*1e3))}function M(i){i!==null&&(l("#timeline").value=i,l("#replayClock").textContent=new Date(i*1e3).toLocaleString())}function O(i){return n.bounds?Math.max(n.bounds.first,Math.min(n.bounds.last,i)):i}function j(){return{paths:l("#pathLayer").checked,vehicles:l("#vehicleLayer").checked,heat:l("#densityLayer").checked,heatMetric:l("#heatMetric").value,stuck:l("#stuckLayer").checked,congestion:l("#jamLayer").checked,tags:l("#tagLayer").checked,stateFilter:l("#stateFilter").value,heatFilter:Number(l("#heatFilter").value)/100}}function T(){n.data&&f.draw(n.data,j())}function z(i){var t;if(n.data=i,et(l("#metrics"),i),st(l("#summaryRows"),i.latest,((t=i.localization)==null?void 0:t.vehicles)||[]),it(l("#localization"),i.localization),at(l("#uwbValidation"),i.uwb_validation,i.localization_recovery),n.selectedVehicle){const e=[...document.querySelectorAll("#summaryRows [data-vehicle]")].find(s=>s.dataset.vehicle===n.selectedVehicle);e&&e.classList.add("selected")}if(ot(l("#analytics"),i.analytics),nt(l("#hotspots"),i),lt(l("#stuckTimeline"),i.stuck_timeline),ut(i.latest),n.selectedHotspot){const e=[...document.querySelectorAll("#hotspots [data-hotspot]")].find(s=>Math.abs(Number(s.dataset.x)-n.selectedHotspot.x)<.001&&Math.abs(Number(s.dataset.y)-n.selectedHotspot.y)<.001&&s.dataset.type===n.selectedHotspot.type);e&&e.classList.add("selected")}l("#range").textContent=i.samples?`${new Date(i.start).toLocaleString()} — ${new Date(i.end).toLocaleString()}`:"Waiting for ROS traffic history",T()}function ut(i){const t=l("#routeVehicle"),e=t.value;t.replaceChildren(...i.length?i.map(a=>new Option(a.vehicle_id,a.vehicle_id)):[new Option("No vehicles in this time range","")]);const s=n.selectedVehicle||e;i.some(a=>a.vehicle_id===s)&&(t.value=s)}async function R(i){if(!n.loading){n.loading=!0;try{z(await Q(i)),F(!0,`Updated ${new Date().toLocaleTimeString()}`)}catch(t){F(!1,`Monitor offline · ${t.message}`)}finally{n.loading=!1}}}async function q(i=!1){try{const t=await K();if(t.empty){l("#replayClock").textContent="No recorded history";return}const e=n.bounds===null;n.bounds=t,l("#timeline").min=t.first,l("#timeline").max=t.last,l("#selectedTime").min=$(new Date(t.first*1e3)),l("#selectedTime").max=$(new Date(t.last*1e3)),l("#firstLog").textContent=`First ${new Date(t.first*1e3).toLocaleString()}`,l("#lastLog").textContent=`Latest ${new Date(t.last*1e3).toLocaleString()}`,(i||e||!l("#selectedTime").value)&&(n.cursor=t.last,_(Math.max(t.first,t.last-300)),l("#rangeStart").value=$(new Date(t.first*1e3)),l("#rangeEnd").value=$(new Date(t.last*1e3))),(n.cursor===null||n.auto)&&(n.cursor=t.last),M(n.cursor)}catch{l("#replayClock").textContent="History unavailable"}}function y(i="PAUSED"){n.playing=!1,n.lastTick=0,l("#playButton").textContent="▶ Play to latest",l("#playButton").className="",i&&C(i)}function k(i){if(!n.bounds)return;n.auto=!1,n.cursor=O(i),M(n.cursor);const t=Number(l("#trailMinutes").value)*60,e=n.playing&&n.playbackStart!==null?n.playbackStart:Math.max(n.bounds.first,n.cursor-t),s=Math.min(n.cursor-.001,e);R({start:new Date(s*1e3).toISOString(),end:new Date(n.cursor*1e3).toISOString()})}function N(){y(null),n.auto=!0,n.playbackStart=null,C("LIVE"),n.bounds&&(n.cursor=n.bounds.last,M(n.cursor)),R({hours:Number(l("#trailMinutes").value)/60})}function pt(){y("HISTORY");const i=l("#selectedTime").value;i&&k(new Date(i).getTime()/1e3)}function mt(){if(n.playing){y();return}if(!n.bounds)return;n.auto=!1;const i=new Date(l("#selectedTime").value).getTime()/1e3;n.cursor=O(Number.isFinite(i)?i:n.bounds.first),n.playbackStart=n.cursor,n.playbackEnd=n.bounds.last,n.playing=!0,n.lastTick=performance.now(),C("REPLAY"),l("#playButton").textContent="❚❚ Pause replay",l("#playButton").className="playing",k(n.cursor)}function ft(){if(!n.playing)return;const i=performance.now();if(n.loading){n.lastTick=i;return}const t=Math.min(2,(i-n.lastTick)/1e3);n.lastTick=i,n.cursor=Math.min(n.playbackEnd,n.cursor+t*Number(l("#playSpeed").value)),_(n.cursor),k(n.cursor),n.cursor>=n.playbackEnd&&y("HISTORY")}function gt(){const i=l("#rangeStart").value,t=l("#rangeEnd").value;!i||!t||(y("HISTORY"),n.auto=!1,R({start:new Date(i).toISOString(),end:new Date(t).toISOString()}))}l("#liveButton").addEventListener("click",N);l("#jumpButton").addEventListener("click",pt);l("#playButton").addEventListener("click",mt);l("#applyRange").addEventListener("click",gt);l("#stateFilter").addEventListener("change",T);function U(i){var e,s;n.selectedVehicle=i.dataset.vehicle,n.selectedHotspot=null,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(a=>{a.classList.toggle("selected",a===i)}),document.querySelectorAll("#hotspots [data-hotspot]").forEach(a=>a.classList.remove("selected")),l("#pathLayer").checked=!0,f.focusVehicle(n.selectedVehicle),[...l("#routeVehicle").options].some(a=>a.value===n.selectedVehicle)&&(l("#routeVehicle").value=n.selectedVehicle);const t=(s=(e=n.data)==null?void 0:e.latest)==null?void 0:s.find(a=>a.vehicle_id===n.selectedVehicle);l("#mapFocus").textContent=t?`${n.selectedVehicle} path · x ${t.x.toFixed(1)} · y ${t.y.toFixed(1)} · ${t.speed.toFixed(2)} m/s`:`${n.selectedVehicle} path`,l(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})}l("#summaryRows").addEventListener("click",i=>{const t=i.target.closest("[data-vehicle]");t&&U(t)});l("#summaryRows").addEventListener("keydown",i=>{if(i.key!=="Enter"&&i.key!==" ")return;const t=i.target.closest("[data-vehicle]");t&&(i.preventDefault(),U(t))});l("#hotspots").addEventListener("click",i=>{const t=i.target.closest("[data-hotspot]");if(!t)return;n.selectedVehicle=null,l("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(s=>s.classList.remove("selected")),n.selectedHotspot={x:Number(t.dataset.x),y:Number(t.dataset.y),type:t.dataset.type,events:Number(t.dataset.events),first_started:Number(t.dataset.first)||null,last_ended:Number(t.dataset.last)||null},document.querySelectorAll("#hotspots [data-hotspot]").forEach(s=>{s.classList.toggle("selected",s===t)}),f.focusAt(n.selectedHotspot);const e=n.selectedHotspot.first_started?`${new Date(n.selectedHotspot.first_started*1e3).toLocaleString()} → ${new Date((n.selectedHotspot.last_ended||n.selectedHotspot.first_started)*1e3).toLocaleString()}`:"time unavailable";l("#mapFocus").textContent=`${n.selectedHotspot.type} · x ${n.selectedHotspot.x.toFixed(1)} · y ${n.selectedHotspot.y.toFixed(1)} · ${n.selectedHotspot.events} event(s) · ${e}`,l(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})});l("#stuckTimeline").addEventListener("click",i=>{const t=i.target.closest("[data-stuck-time]");t&&(n.selectedVehicle=null,l("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(e=>e.classList.remove("selected")),document.querySelectorAll("#hotspots [data-hotspot]").forEach(e=>e.classList.remove("selected")),n.selectedHotspot={x:Number(t.dataset.x),y:Number(t.dataset.y),type:"Stuck",events:Number(t.dataset.count),first_started:Number(t.dataset.time),last_ended:Number(t.dataset.time)},f.focusAt(n.selectedHotspot),_(Number(t.dataset.time)),l("#mapFocus").textContent=`Stuck at ${new Date(Number(t.dataset.time)*1e3).toLocaleTimeString()} · x ${n.selectedHotspot.x.toFixed(1)} · y ${n.selectedHotspot.y.toFixed(1)} · ${n.selectedHotspot.events} vehicle(s)`,l(".map-panel").scrollIntoView({behavior:"smooth",block:"center"}))});function Y(i){var t,e;if(i.dataset.insight==="stuck")n.selectedVehicle=null,l("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(s=>s.classList.remove("selected")),n.selectedHotspot={x:Number(i.dataset.x),y:Number(i.dataset.y),type:"Stuck",events:Number(i.dataset.events),first_started:Number(i.dataset.first)||null,last_ended:Number(i.dataset.last)||null},f.focusAt(n.selectedHotspot),l("#mapFocus").textContent=`Stuck · x ${n.selectedHotspot.x.toFixed(1)} · y ${n.selectedHotspot.y.toFixed(1)} · ${n.selectedHotspot.events} event(s)`;else{const s=i.dataset.vehicle,a=(e=(t=n.data)==null?void 0:t.analytics)==null?void 0:e.worst_path;n.selectedVehicle=s,n.selectedHotspot=null,l("#pathLayer").checked=!0,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(o=>{o.classList.toggle("selected",o.dataset.vehicle===s)}),document.querySelectorAll("#hotspots [data-hotspot]").forEach(o=>o.classList.remove("selected")),f.focusVehicle(s),l("#mapFocus").textContent=`${s} path · ${i.dataset.insight==="window"?"bad interval":"worst path"}${a?` · ${a.slow_seconds.toFixed(0)} s slow`:""}`}l(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})}l("#analytics").addEventListener("click",i=>{const t=i.target.closest("[data-insight]");t&&Y(t)});l("#analytics").addEventListener("keydown",i=>{if(i.key!=="Enter"&&i.key!==" ")return;const t=i.target.closest("[data-insight]");t&&(i.preventDefault(),Y(t))});["pathLayer","vehicleLayer","densityLayer","stuckLayer","jamLayer","tagLayer","heatMetric","heatFilter"].forEach(i=>l(`#${i}`).addEventListener("input",T));l("#trailMinutes").addEventListener("change",()=>n.auto?N():n.cursor!==null&&k(n.cursor));["selectedTime","rangeStart","rangeEnd"].forEach(i=>l(`#${i}`).addEventListener("focus",()=>{n.auto=!1,y("PAUSED")}));l("#timeline").addEventListener("input",i=>{n.auto=!1,y("HISTORY"),n.cursor=Number(i.target.value),_(n.cursor),M(n.cursor),clearTimeout(n.debounce),n.debounce=setTimeout(()=>k(n.cursor),120)});function G(){n.route=null,b.setRoute(null),I(l("#routeResult"),null)}b.onDestination(i=>{l("#routeX").value=i.x.toFixed(2),l("#routeY").value=i.y.toFixed(2),l("#routeStatus").className="route-status",l("#routeStatus").textContent=`Destination selected at x ${i.x.toFixed(2)}, y ${i.y.toFixed(2)}. Generate the suggestion when ready.`});l("#routeVehicle").addEventListener("change",G);l("#routeForm").addEventListener("submit",async i=>{var o;if(i.preventDefault(),n.routeLoading)return;const t=l("#routeVehicle").value,e=Number(l("#routeX").value),s=Number(l("#routeY").value),a=l("#routeStatus");if(!t||!Number.isFinite(e)||!Number.isFinite(s)){a.className="route-status error",a.textContent="Choose a forklift and set both destination coordinates.";return}if(!((o=n.data)!=null&&o.samples)){a.className="route-status error",a.textContent="No recorded traffic is available in this dashboard time range.";return}n.routeLoading=!0,l("#suggestRouteButton").disabled=!0,a.className="route-status loading",a.textContent="Calculating collision-clear alternatives…";try{n.route=await Z({vehicle_id:t,destination:{x:e,y:s},nominal_speed_mps:Number(l("#routeSpeed").value),start:n.data.start,end:n.data.end}),b.setRoute(n.route),I(l("#routeResult"),n.route),a.className="route-status success",a.textContent=`${t}: route ready. Green is the suggested path; dashed gray is the shortest path.`}catch(c){G(),a.className="route-status error",a.textContent=c.message}finally{n.routeLoading=!1,l("#suggestRouteButton").disabled=!1}});async function vt(){z(P);try{const i=await J();await Promise.all([f.load(i),b.load(i)]),T()}catch{await Promise.all([f.load(f.info,"/fallback-map.png"),b.load(b.info,"/fallback-map.png")]),f.draw(P,j()),F(!1,"Map preview · ROS monitor offline")}await q(!0),N()}vt();setInterval(ft,400);let W=0;setInterval(()=>{n.auto&&N(),W+=1,W%5===0&&q()},2e3);
