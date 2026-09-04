import"./modulepreload-polyfill-B5Qt9EMX.js";async function L(i,t={}){const e=await fetch(i,{cache:"no-store",...t}),s=await e.text();let a;try{a=s?JSON.parse(s):{}}catch{throw new Error(`API returned invalid JSON (${e.status})`)}if(!e.ok)throw new Error(a.error||e.statusText);return a}async function X(){const i=await L("/api/map");if(!Array.isArray(i.origin)||!i.width||!i.height||!i.resolution)throw new Error("Map metadata unavailable");return i}const J=()=>L("/api/bounds");async function K(i){const t=await L(`/api/state?${new URLSearchParams(i)}`);if(!Array.isArray(t.latest)||!Array.isArray(t.density))throw new Error("Traffic history unavailable");return t}async function Q(i){var e,s;const t=await L("/api/routes/suggest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(i)});if(!t.advisory_only||!((e=t.baseline)!=null&&e.points)||!((s=t.suggested)!=null&&s.points))throw new Error("Route suggestion unavailable");return t}const m=i=>String(i).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),Z=i=>i.vehicle_id==="my_robot"?`${m(i.vehicle_id)} <span class="tag">AMR</span>`:m(i.vehicle_id),V={moving:["Moving","moving"],turning:["Turning normally","turning"],waiting_vehicle:["Waiting for vehicle","waiting"],blocked_obstacle:["Blocked by obstacle","blocked"],stalled:["Commanded but not moving","blocked"],stuck:["Stuck","blocked"],idle:["Idle / intentional stop","idle"],planning:["Planning next route","idle"],localizing:["Waiting for localization","idle"],sensor_wait:["Waiting for LiDAR","idle"],unknown:["State unavailable","idle"]};function I(i){const t=i.speed>=.05?"moving":"unknown",e=i.motion_state||t,[s,a]=V[e]||V.unknown;return{state:e,label:s,className:a}}function tt(i,t){var n;const e=t.latest.filter(r=>I(r).state==="moving").length,s=(n=t.localization)==null?void 0:n.summary,a=s!=null&&s.samples?`${s.mean_error.toFixed(2)} m`:"—";i.innerHTML=[["samples",t.samples.toLocaleString(),"Position samples",""],["vehicles",t.latest.length,"Active vehicles","teal"],["moving",e,"Moving now","teal"],["stuck",t.stuck.length,"Stuck hotspots","orange"],["congestion",t.congestion.length,"Congestion hotspots","red"],["localization",a,"Mean AMCL error","teal"]].map(r=>`<article class="metric ${r[3]}"><strong>${r[1]}</strong><span>${r[2]}</span></article>`).join("")}function et(i,t,e=[]){if(!t.length){i.innerHTML='<div class="empty">No fresh vehicle positions at the end of this range.</div>';return}i.innerHTML=t.map(s=>{const a=I(s),n=e.find(r=>r.vehicle_id===s.vehicle_id);return`<article class="vehicle-card vehicle-action" data-vehicle="${m(s.vehicle_id)}" role="button" tabindex="0" title="Show ${m(s.vehicle_id)} path on the map">
      <div class="vehicle-card-head"><strong><i class="status-dot ${a.className}"></i>${Z(s)}</strong>
        <b class="speed">${s.speed.toFixed(2)} m/s</b></div>
      <div class="vehicle-position">Position <b>x ${s.x.toFixed(2)} m</b><b>y ${s.y.toFixed(2)} m</b></div>
      ${n?`<div class="localization-error">LiDAR AMCL error <b>${n.latest_error.toFixed(2)} m</b></div>`:""}
      <small class="motion-state ${a.className}">● ${a.label}</small>
    </article>`}).join("")}function st(i,t){const e=t==null?void 0:t.summary,s=(t==null?void 0:t.vehicles)||[];if(!(e!=null&&e.samples)){i.innerHTML='<div class="empty">Waiting for AMCL and Gazebo comparison samples…</div>';return}const a=e.mean_yaw_error*180/Math.PI;i.innerHTML=`
    <div class="localization-overview">
      <div><strong>${e.mean_error.toFixed(2)} m</strong><small>Mean error</small></div>
      <div><strong>${e.rms_error.toFixed(2)} m</strong><small>RMS error</small></div>
      <div><strong>${e.max_error.toFixed(2)} m</strong><small>Maximum</small></div>
      <div><strong>${a.toFixed(1)}°</strong><small>Mean yaw error</small></div>
    </div>
    <div class="localization-list">${s.map(n=>`
      <div class="localization-row">
        <span><b>${m(n.vehicle_id)}</b><small>${n.samples} comparisons</small></span>
        <span><strong>${n.mean_error.toFixed(2)} m</strong><small>latest ${n.latest_error.toFixed(2)} m</small></span>
      </div>`).join("")}</div>`}function it(i,t,e={}){const s=(t==null?void 0:t.vehicles)||[],a=(t==null?void 0:t.summary)||{};if(!s.length){i.innerHTML=t!=null&&t.historical?'<div class="empty">No recorded UWB validation in this time range.</div>':'<div class="empty">Waiting for live UWB validation…</div>';return}const n={confirmed:["Confirmed","confirmed"],caution:["Caution","caution"],disagreement:["Disagreement","disagreement"],uwb_unavailable:["UWB unavailable","unavailable"],waiting_amcl:["Waiting for AMCL","unavailable"],unsynchronized:["Time mismatch","unavailable"]},r=(a.uwb_unavailable||0)+(a.waiting_amcl||0)+(a.unsynchronized||0),h=t.as_of?new Date(t.as_of).toLocaleString():null,d=(e==null?void 0:e.vehicles)||[],c=new Map(d.map(p=>[p.vehicle_id,p])),u=(e==null?void 0:e.summary)||{},b=d.length?`<div class="recovery-summary ${u.interlocked?"active":""}">
        <b>Motion interlock</b>
        <span>${u.ready||0} ready · ${u.interlocked||0} stopped/recovering</span>
      </div>`:"";i.innerHTML=`
    ${b}
    <div class="uwb-overview">
      <div><strong>${a.confirmed||0}</strong><small>Confirmed</small></div>
      <div><strong>${a.caution||0}</strong><small>Caution</small></div>
      <div><strong>${a.disagreement||0}</strong><small>Disagree</small></div>
      <div><strong>${r}</strong><small>Not compared</small></div>
    </div>
    <div class="uwb-list">${s.map(p=>{var E;const[v,y]=n[p.state]||["Unknown","unavailable"],w=Number.isFinite(p.error_m)?`${p.error_m.toFixed(2)} m difference`:p.state==="unsynchronized"&&Number.isFinite(p.measurement_skew_s)?`${p.measurement_skew_s.toFixed(2)} s time mismatch`:((E=p.uwb_reason)==null?void 0:E.replaceAll("_"," "))||"No comparison",S=p.raw_state&&p.raw_state!==p.state?` · checking ${p.raw_state.replaceAll("_"," ")}`:"",_=c.get(p.vehicle_id),G=_?` · interlock ${_.state.replaceAll("_"," ")}`:"";return`<div class="uwb-row">
        <span><b>${m(p.vehicle_id)}</b><small>${p.visible_tag_count||0} tags visible · ${m(w)}${m(S)}${m(G)}</small></span>
        <strong class="uwb-state ${y}">${v}</strong>
      </div>`}).join("")}</div>
    <p class="uwb-note">${t.live?"Live comparison":`Recorded comparison${h?` at ${h}`:""}`}. AMCL remains the position source; UWB is confirmation only.</p>`}function at(i,t){const e=t==null?void 0:t.most_stuck_location,s=t==null?void 0:t.worst_path,a=(n,r)=>n?`${new Date(n*1e3).toLocaleString()} → ${new Date((r||n)*1e3).toLocaleString()}`:"No slow/stuck interval in this range";i.innerHTML=`
    <div class="insight-row ${e?"insight-action":""}" ${e?`data-insight="stuck" role="button" tabindex="0" data-x="${e.x}" data-y="${e.y}" data-events="${e.events}" data-first="${e.first_started||""}" data-last="${e.last_ended||""}"`:""}>
      <i class="insight-icon orange">!</i><div><b>Most stuck position</b><small>${e?`x ${e.x.toFixed(2)} · y ${e.y.toFixed(2)} · ${e.events} event(s)`:"No stuck position recorded"}</small>${e?`<em>${a(e.first_started,e.last_ended)}</em>`:""}</div>
    </div>
    <div class="insight-row ${s?"insight-action":""}" ${s?`data-insight="path" role="button" tabindex="0" data-vehicle="${m(s.vehicle_id)}"`:""}>
      <i class="insight-icon red">↝</i><div><b>Worst vehicle path</b><small>${s?`${m(s.vehicle_id)} · ${s.reason}`:"No vehicle path recorded"}</small>${s?`<em>${s.distance_m.toFixed(1)} m travelled · ${s.slow_seconds.toFixed(0)} s slow</em>`:""}</div>
    </div>
    <div class="insight-row ${s?"insight-action":""}" ${s?`data-insight="window" role="button" tabindex="0" data-vehicle="${m(s.vehicle_id)}"`:""}>
      <i class="insight-icon blue">◷</i><div><b>Bad path window</b><small>${s?a(s.bad_when_start,s.bad_when_end):"No bad interval found"}</small>${s?`<em>Average speed ${s.average_speed.toFixed(2)} m/s</em>`:""}</div>
    </div>`}function ot(i,t){const e=[...t.congestion.map(s=>({...s,type:"Congestion",color:"var(--red)"})),...t.stuck.map(s=>({...s,type:"Stuck",color:"var(--orange)"}))].sort((s,a)=>a.events-s.events).slice(0,6);i.innerHTML=e.length?e.map(s=>`<button type="button" class="hotspot-row" data-hotspot
    data-x="${s.x}" data-y="${s.y}" data-type="${s.type}"
    data-events="${s.events}" data-first="${s.first_started||""}" data-last="${s.last_ended||""}"
    title="Show ${s.type.toLowerCase()} location on the map">
    <span><b style="color:${s.color}">${s.type}</b><small>x ${s.x.toFixed(1)} · y ${s.y.toFixed(1)}</small></span>
    <span class="hotspot-count"><strong>${s.events}×</strong><small>View map</small></span>
  </button>`).join(""):'<div class="empty">No stuck or congestion events.</div>'}function W(i,t){if(!t){i.innerHTML='<div class="empty">Choose a forklift and click a destination on the route map.</div>';return}const e=n=>n>=60?`${(n/60).toFixed(1)} min`:`${n.toFixed(0)} sec`,s=t.suggested.distance_m-t.baseline.distance_m,a=t.destination.snapped?'<p class="route-warning">Destination was moved to the nearest collision-clear map cell.</p>':"";i.innerHTML=`
    <div class="route-result-grid">
      <div><small>Suggested distance</small><strong>${t.suggested.distance_m.toFixed(1)} m</strong><span>${s>.05?`+${s.toFixed(1)} m vs shortest`:"same as shortest"}</span></div>
      <div><small>Estimated time</small><strong>${e(t.suggested.eta_s)}</strong><span>at selected nominal speed</span></div>
      <div><small>Traffic risk</small><strong>${t.suggested.risk_score.toFixed(0)} / 100</strong><span>${t.risk_reduction.toFixed(1)} points lower</span></div>
      <div><small>Hotspots avoided</small><strong>${t.hotspots_avoided}</strong><span>from this history window</span></div>
    </div>
    <p class="route-explanation">${m(t.explanation)}</p>
    ${a}
    <p class="route-meta">Generated ${new Date(t.generated_at).toLocaleString()} using traffic from ${new Date(t.traffic_window.start).toLocaleString()} to ${new Date(t.traffic_window.end).toLocaleString()}.</p>`}function C(i,t){const e=document.querySelector("#connection");e.classList.toggle("error",!i),e.querySelector("span").textContent=t}function N(i){const t=document.querySelector("#mode");t.textContent=i,t.className=`mode ${i.toLowerCase()}`}const D=["#8d6bff","#00a7d8","#ef7d50","#21a47b","#d45fc0","#789637","#d99924","#4a75dc","#d35c69"];class nt{constructor(t){this.canvas=t,this.ctx=t.getContext("2d"),this.info={origin:[-18.6,-26.3],resolution:.05,width:607,height:1004},this.image=null,this.hits=[],this.focused=null,this.focusedVehicle=null,this.lastData=null,this.lastOptions=null,this.rotated=!1,this.tooltip=document.querySelector("#mapTooltip"),t.addEventListener("mousemove",e=>this.showTooltip(e)),t.addEventListener("mouseleave",()=>{this.tooltip.style.display="none"})}async load(t,e="/map.png"){this.info=t,this.rotated=this.height()>this.width()*1.1,this.canvas.width=this.rotated?1600:1200;const s=this.rotated?this.width()/this.height():this.height()/this.width();return this.canvas.height=Math.max(1,Math.round(this.canvas.width*s)),new Promise(a=>{const n=new Image;n.onload=()=>{this.image=n,a()},n.onerror=()=>a(),n.src=`${e}?${Date.now()}`})}width(){return this.info.width*this.info.resolution}height(){return this.info.height*this.info.resolution}project(t,e){const s=(t-this.info.origin[0])/this.width(),a=(e-this.info.origin[1])/this.height();return this.rotated?{x:a*this.canvas.width,y:s*this.canvas.height}:{x:s*this.canvas.width,y:(1-a)*this.canvas.height}}drawGrid(){const{ctx:t,canvas:e}=this;t.fillStyle="#e9eef0",t.fillRect(0,0,e.width,e.height),this.image&&(this.rotated?(t.save(),t.translate(e.width,0),t.rotate(Math.PI/2),t.drawImage(this.image,0,0,e.height,e.width),t.restore()):t.drawImage(this.image,0,0,e.width,e.height)),t.fillStyle="#ffffff18",t.fillRect(0,0,e.width,e.height),t.strokeStyle="#aebbc499",t.lineWidth=1,t.font="11px system-ui",t.fillStyle="#536875";const s=this.width()>35?5:4,a=Math.ceil(this.info.origin[0]/s)*s,n=this.info.origin[0]+this.width();for(let d=a;d<=n;d+=s){const c=this.project(d,this.info.origin[1]),u=this.project(d,this.info.origin[1]+this.height());t.beginPath(),t.moveTo(c.x,c.y),t.lineTo(u.x,u.y),t.stroke(),this.rotated?t.fillText(`${d.toFixed(0)} m`,7,c.y-4):t.fillText(`${d.toFixed(0)} m`,c.x+4,e.height-8)}const r=Math.ceil(this.info.origin[1]/s)*s,h=this.info.origin[1]+this.height();for(let d=r;d<=h;d+=s){const c=this.project(this.info.origin[0],d),u=this.project(this.info.origin[0]+this.width(),d);t.beginPath(),t.moveTo(c.x,c.y),t.lineTo(u.x,u.y),t.stroke(),this.rotated?t.fillText(`${d.toFixed(0)} m`,c.x+4,e.height-8):t.fillText(`${d.toFixed(0)} m`,7,c.y-4)}t.strokeStyle="#43596a",t.lineWidth=7,t.strokeRect(4,4,e.width-8,e.height-8)}drawHeat(t,e,s="count"){if(!t.density.length)return;const a=t.density.map(c=>Number(c[s]||0)).sort((c,u)=>c-u),n=a[Math.floor((a.length-1)*e)]||0,r=Math.max(n+1,a[Math.floor((a.length-1)*.95)]||1),h=Math.log1p(n),d=Math.max(.001,Math.log1p(r)-h);t.density.forEach(c=>{const u=Number(c[s]||0);if(u<n)return;const b=Math.max(0,Math.min(1,(Math.log1p(u)-h)/d)),p=12+16*b,{x:v,y}=this.project(c.x,c.y),w=this.ctx.createRadialGradient(v,y,0,v,y,p),S=Math.round(210*(1-b));w.addColorStop(0,`hsla(${S}, 90%, 53%, ${.15+.4*b})`),w.addColorStop(1,`hsla(${S}, 90%, 53%, 0)`),this.ctx.fillStyle=w,this.ctx.beginPath(),this.ctx.arc(v,y,p,0,Math.PI*2),this.ctx.fill();const _=s==="vehicles"?`${u} unique vehicle(s)`:s==="slow_samples"?`${u} slow sample(s)`:`${u} occupancy sample(s)`;this.hits.push({x:v,y,radius:p,label:`${_} · average ${Number(c.average_speed||0).toFixed(2)} m/s`})})}trackColor(t){let e=0;for(const s of t)e=e*31+s.charCodeAt(0)>>>0;return D[e%D.length]}trackSegments(t){const e=[];let s=[],a=null;for(const n of t){const r={x:Number(n[0]),y:Number(n[1]),time:Number(n[2])};if(![r.x,r.y,r.time].every(Number.isFinite)){s.length>1&&e.push(s),s=[],a=null;continue}if(a){const h=r.time-a.time,d=Math.hypot(r.x-a.x,r.y-a.y),c=Math.max(2.5,h*2.2+.75);(h<=0||h>12||d>c)&&(s.length>1&&e.push(s),s=[])}s.push(r),a=r}return s.length>1&&e.push(s),e}traceSegment(t){this.ctx.beginPath(),t.forEach((e,s)=>{const a=this.project(e.x,e.y);s===0?this.ctx.moveTo(a.x,a.y):this.ctx.lineTo(a.x,a.y)})}drawPathArrows(t,e){let s=0;for(let a=1;a<t.length;a+=1){const n=this.project(t[a-1].x,t[a-1].y),r=this.project(t[a].x,t[a].y);if(s+=Math.hypot(r.x-n.x,r.y-n.y),s<90)continue;s=0;const h=Math.atan2(r.y-n.y,r.x-n.x);this.ctx.save(),this.ctx.translate(r.x,r.y),this.ctx.rotate(h),this.ctx.fillStyle=e,this.ctx.strokeStyle="#071521",this.ctx.lineWidth=2,this.ctx.beginPath(),this.ctx.moveTo(8,0),this.ctx.lineTo(-5,-5),this.ctx.lineTo(-2,0),this.ctx.lineTo(-5,5),this.ctx.closePath(),this.ctx.fill(),this.ctx.stroke(),this.ctx.restore()}}drawPaths(t){this.focusedVehicle&&(t.tracks||[]).forEach(e=>{if(e.points.length<2||this.focusedVehicle&&e.vehicle_id!==this.focusedVehicle)return;const s=this.trackColor(e.vehicle_id),a=this.trackSegments(e.points);this.ctx.save(),this.ctx.lineCap="round",this.ctx.lineJoin="round";for(const n of a)this.traceSegment(n),this.ctx.strokeStyle="#071521cc",this.ctx.lineWidth=8,this.ctx.stroke(),this.traceSegment(n),this.ctx.strokeStyle=s,this.ctx.lineWidth=4.5,this.ctx.shadowColor=s,this.ctx.shadowBlur=5,this.ctx.stroke(),this.ctx.shadowBlur=0,this.drawPathArrows(n,s);this.ctx.restore()})}circle(t,e,s,a,n){const{x:r,y:h}=this.project(t.x,t.y);this.ctx.fillStyle=s,this.ctx.beginPath(),this.ctx.arc(r,h,e,0,Math.PI*2),this.ctx.fill(),n&&(this.ctx.strokeStyle=n,this.ctx.lineWidth=2,this.ctx.stroke()),this.hits.push({x:r,y:h,radius:Math.max(e,12),label:a})}drawVehicle(t){const{x:e,y:s}=this.project(t.x,t.y),a=t.motion_state||(t.speed<.05?"unknown":"moving"),n={moving:"#25d0ae",turning:"#3da4ff",waiting_vehicle:"#ffbf47",blocked_obstacle:"#ff6856",stalled:"#ff5263",stuck:"#ff5263",idle:"#91a7b9",planning:"#91a7b9",localizing:"#91a7b9",sensor_wait:"#91a7b9",unknown:"#91a7b9"},r=t.vehicle_id==="my_robot"?"#ffffff":n[a]||n.unknown;this.ctx.shadowColor="#07111a",this.ctx.shadowBlur=8,this.ctx.fillStyle=r,this.ctx.beginPath(),this.ctx.arc(e,s,9,0,Math.PI*2),this.ctx.fill(),this.ctx.shadowBlur=0,this.ctx.strokeStyle="#132638",this.ctx.lineWidth=2,this.ctx.stroke();const h=t.vehicle_id.replace("vehicle_","V");this.ctx.font="bold 11px system-ui";const d=this.ctx.measureText(h).width+10;this.ctx.fillStyle="#0b1825e8",this.ctx.fillRect(e-d/2,s-29,d,16),this.ctx.fillStyle="#f2f7fa",this.ctx.textAlign="center",this.ctx.fillText(h,e,s-17),this.ctx.textAlign="start",this.hits.push({x:e,y:s,radius:13,label:`${t.vehicle_id} · ${a.replaceAll("_"," ")} · ${t.speed.toFixed(2)} m/s · x ${t.x.toFixed(2)}, y ${t.y.toFixed(2)}`})}drawUwbTags(){(this.info.uwb_tags||[]).forEach(t=>{const{x:e,y:s}=this.project(Number(t.x),Number(t.y));this.ctx.save(),this.ctx.translate(e,s),this.ctx.rotate(Math.PI/4),this.ctx.globalAlpha=t.enabled===!1?.35:1,this.ctx.fillStyle="#f04df2",this.ctx.shadowColor="#f04df2",this.ctx.shadowBlur=10,this.ctx.fillRect(-7,-7,14,14),this.ctx.shadowBlur=0,this.ctx.strokeStyle="#53145f",this.ctx.lineWidth=2,this.ctx.strokeRect(-7,-7,14,14),this.ctx.restore(),this.ctx.font="bold 10px system-ui",this.ctx.fillStyle="#6e187c",this.ctx.textAlign="center",this.ctx.fillText(t.id,e,s-13),this.ctx.textAlign="start",this.hits.push({x:e,y:s,radius:14,label:`UWB tag ${t.id} · ${t.enabled===!1?"disabled":"enabled"} · battery ${Number(t.battery_pct??100).toFixed(0)}% · x ${Number(t.x).toFixed(1)}, y ${Number(t.y).toFixed(1)}, z ${Number(t.z).toFixed(1)} m`})})}draw(t,e){this.lastData=t,this.lastOptions=e,this.hits=[],this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height),this.drawGrid(),e.heat&&this.drawHeat(t,e.heatFilter,e.heatMetric),e.paths&&this.drawPaths(t),e.stuck&&t.stuck.slice(0,12).forEach(s=>this.circle(s,8+Math.min(10,Math.log2(s.events+1)*2),"#ffbf47cc",`${s.events} stuck event(s) · ${Math.round(s.duration)} seconds`,"#fff0bd")),e.congestion&&t.congestion.slice(0,12).forEach(s=>this.circle(s,10+Math.min(14,s.max_vehicles*2),"#ff5263b8",`${s.events} congestion event(s) · up to ${s.max_vehicles} vehicles`,"#ff9ba5")),e.vehicles&&(e.stateFilter==="all"?t.latest:t.latest.filter(a=>(a.motion_state||(a.speed<.05?"unknown":"moving"))===e.stateFilter)).forEach(a=>this.drawVehicle(a)),e.tags&&this.drawUwbTags(),this.drawFocus(),this.drawVehicleFocus(t)}focusAt(t){this.focused=t,this.focusedVehicle=null,this.lastData&&this.lastOptions&&this.draw(this.lastData,this.lastOptions)}focusVehicle(t){this.focused=null,this.focusedVehicle=t,this.lastData&&this.lastOptions&&this.draw(this.lastData,this.lastOptions)}drawFocus(){if(!this.focused||!Number.isFinite(Number(this.focused.x))||!Number.isFinite(Number(this.focused.y)))return;const{x:t,y:e}=this.project(Number(this.focused.x),Number(this.focused.y)),s=this.focused.type==="Congestion"?"#ff5263":"#ffbf47",a=`${this.focused.type} · ${this.focused.events} event(s)`;this.ctx.save(),this.ctx.strokeStyle=s,this.ctx.lineWidth=3,this.ctx.shadowColor=s,this.ctx.shadowBlur=14,this.ctx.beginPath(),this.ctx.arc(t,e,20,0,Math.PI*2),this.ctx.stroke(),this.ctx.shadowBlur=0,this.ctx.beginPath(),this.ctx.moveTo(t-30,e),this.ctx.lineTo(t+30,e),this.ctx.moveTo(t,e-30),this.ctx.lineTo(t,e+30),this.ctx.stroke(),this.ctx.font="bold 11px system-ui";const n=this.ctx.measureText(a).width+14;this.ctx.fillStyle="#07111aeb",this.ctx.fillRect(t-n/2,e+27,n,18),this.ctx.fillStyle="#f2f7fa",this.ctx.textAlign="center",this.ctx.fillText(a,t,e+40),this.ctx.textAlign="start",this.ctx.restore(),this.hits.push({x:t,y:e,radius:32,label:`${a} · x ${Number(this.focused.x).toFixed(2)}, y ${Number(this.focused.y).toFixed(2)}`})}drawVehicleFocus(t){var c;if(!this.focusedVehicle)return;const e=(t.latest||[]).find(u=>u.vehicle_id===this.focusedVehicle),s=(t.tracks||[]).find(u=>u.vehicle_id===this.focusedVehicle),a=e||((c=s==null?void 0:s.points)!=null&&c.length?{x:s.points.at(-1)[0],y:s.points.at(-1)[1]}:null);if(!a)return;const{x:n,y:r}=this.project(Number(a.x),Number(a.y));this.ctx.save(),this.ctx.strokeStyle="#b06cff",this.ctx.lineWidth=3,this.ctx.shadowColor="#b06cff",this.ctx.shadowBlur=16,this.ctx.beginPath(),this.ctx.arc(n,r,22,0,Math.PI*2),this.ctx.stroke(),this.ctx.shadowBlur=0,this.ctx.font="bold 11px system-ui";const h=`${this.focusedVehicle} path`,d=this.ctx.measureText(h).width+14;this.ctx.fillStyle="#07111aeb",this.ctx.fillRect(n-d/2,r+28,d,18),this.ctx.fillStyle="#f2f7fa",this.ctx.textAlign="center",this.ctx.fillText(h,n,r+41),this.ctx.textAlign="start",this.ctx.restore(),this.hits.push({x:n,y:r,radius:34,label:`${h} · x ${Number(a.x).toFixed(2)}, y ${Number(a.y).toFixed(2)}`})}showTooltip(t){const e=this.canvas.getBoundingClientRect(),s=(t.clientX-e.left)*this.canvas.width/e.width,a=(t.clientY-e.top)*this.canvas.height/e.height,n=this.hits.slice().reverse().find(r=>Math.hypot(r.x-s,r.y-a)<=r.radius);if(!n){this.tooltip.style.display="none";return}this.tooltip.textContent=n.label,this.tooltip.style.display="block",this.tooltip.style.left=`${t.clientX-e.left+14}px`,this.tooltip.style.top=`${t.clientY-e.top+14}px`}}class lt{constructor(t,e){this.canvas=t,this.ctx=t.getContext("2d"),this.tooltip=e,this.info={origin:[-10,-10],resolution:1,width:20,height:20},this.image=null,this.rotated=!1,this.route=null,this.destinationHandler=null,t.addEventListener("click",s=>{this.destinationHandler&&this.destinationHandler(this.eventToWorld(s))}),t.addEventListener("mousemove",s=>this.showCoordinates(s)),t.addEventListener("mouseleave",()=>{this.tooltip.style.display="none"})}width(){return this.info.width*this.info.resolution}height(){return this.info.height*this.info.resolution}project(t,e){const s=(t-this.info.origin[0])/this.width(),a=(e-this.info.origin[1])/this.height();return this.rotated?{x:a*this.canvas.width,y:s*this.canvas.height}:{x:s*this.canvas.width,y:(1-a)*this.canvas.height}}unproject(t,e){return this.rotated?{x:this.info.origin[0]+e/this.canvas.height*this.width(),y:this.info.origin[1]+t/this.canvas.width*this.height()}:{x:this.info.origin[0]+t/this.canvas.width*this.width(),y:this.info.origin[1]+(1-e/this.canvas.height)*this.height()}}eventToWorld(t){const e=this.canvas.getBoundingClientRect();return this.unproject((t.clientX-e.left)*this.canvas.width/e.width,(t.clientY-e.top)*this.canvas.height/e.height)}async load(t,e="/map.png"){this.info=t,this.rotated=this.height()>this.width()*1.1,this.canvas.width=this.rotated?1200:1e3;const s=this.rotated?this.width()/this.height():this.height()/this.width();return this.canvas.height=Math.max(1,Math.round(this.canvas.width*s)),new Promise(a=>{const n=new Image;n.onload=()=>{this.image=n,this.draw(),a()},n.onerror=()=>{this.draw(),a()},n.src=`${e}?${Date.now()}`})}onDestination(t){this.destinationHandler=t}setRoute(t){this.route=t,this.draw()}drawBase(){const{ctx:t,canvas:e}=this;t.fillStyle="#e9eef0",t.fillRect(0,0,e.width,e.height),this.image&&(this.rotated?(t.save(),t.translate(e.width,0),t.rotate(Math.PI/2),t.drawImage(this.image,0,0,e.height,e.width),t.restore()):t.drawImage(this.image,0,0,e.width,e.height)),t.fillStyle="#ffffff12",t.fillRect(0,0,e.width,e.height),t.strokeStyle="#43596a",t.lineWidth=7,t.strokeRect(4,4,e.width-8,e.height-8)}drawPolyline(t,e,s,a=!1){if(!t||t.length<2)return;const n=this.ctx;n.save(),n.strokeStyle=e,n.lineWidth=s,n.lineCap="round",n.lineJoin="round",n.setLineDash(a?[11,8]:[]),n.beginPath(),t.forEach(([r,h],d)=>{const c=this.project(r,h);d===0?n.moveTo(c.x,c.y):n.lineTo(c.x,c.y)}),n.stroke(),n.restore()}drawMarker(t,e,s){if(!t)return;const a=this.project(t.x,t.y),n=this.ctx;n.save(),n.fillStyle=e,n.shadowColor=e,n.shadowBlur=12,n.beginPath(),n.arc(a.x,a.y,10,0,Math.PI*2),n.fill(),n.shadowBlur=0,n.strokeStyle="#07111d",n.lineWidth=3,n.stroke(),n.font="bold 12px system-ui",n.fillStyle="#07111ddd",n.fillRect(a.x+12,a.y-13,n.measureText(s).width+10,18),n.fillStyle="#ffffff",n.fillText(s,a.x+17,a.y),n.restore()}draw(){if(this.drawBase(),!this.route)return;const t=this.ctx;for(const e of this.route.risk_cells||[]){const s=this.project(e.x,e.y),a=4+8*e.risk,n=t.createRadialGradient(s.x,s.y,0,s.x,s.y,a);n.addColorStop(0,`rgba(255, 82, 99, ${.12+e.risk*.48})`),n.addColorStop(1,"rgba(255, 82, 99, 0)"),t.fillStyle=n,t.beginPath(),t.arc(s.x,s.y,a,0,Math.PI*2),t.fill()}this.drawPolyline(this.route.baseline.points,"#70869a",4,!0),this.drawPolyline(this.route.suggested.points,"#25d0ae",6),this.drawMarker(this.route.start,"#3da4ff","START"),this.drawMarker(this.route.destination,"#b06cff","GOAL")}showCoordinates(t){const e=this.canvas.getBoundingClientRect(),s=this.eventToWorld(t);this.tooltip.textContent=`Set destination · x ${s.x.toFixed(2)}, y ${s.y.toFixed(2)}`,this.tooltip.style.display="block",this.tooltip.style.left=`${t.clientX-e.left+14}px`,this.tooltip.style.top=`${t.clientY-e.top+14}px`}}const rt=document.querySelector("#app");rt.innerHTML=`
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
      </aside>
    </div>
  </main>
`;const l=i=>document.querySelector(i),f=new nt(l("#map")),x=new lt(l("#routeMap"),l("#routeTooltip")),o={data:null,bounds:null,cursor:null,auto:!0,loading:!1,playing:!1,playbackEnd:null,playbackStart:null,lastTick:0,debounce:null,selectedHotspot:null,selectedVehicle:null,route:null,routeLoading:!1},H={samples:0,latest:[],density:[],tracks:[],stuck:[],congestion:[],start:new Date().toISOString(),end:new Date().toISOString(),analytics:{},localization:{summary:{samples:0},vehicles:[]},uwb_validation:{live:!0,summary:{},vehicles:[]},localization_recovery:{live:!0,summary:{},vehicles:[]}};function $(i){return new Date(i.getTime()-i.getTimezoneOffset()*6e4).toISOString().slice(0,19)}function R(i){l("#selectedTime").value=$(new Date(i*1e3))}function M(i){i!==null&&(l("#timeline").value=i,l("#replayClock").textContent=new Date(i*1e3).toLocaleString())}function B(i){return o.bounds?Math.max(o.bounds.first,Math.min(o.bounds.last,i)):i}function O(){return{paths:l("#pathLayer").checked,vehicles:l("#vehicleLayer").checked,heat:l("#densityLayer").checked,heatMetric:l("#heatMetric").value,stuck:l("#stuckLayer").checked,congestion:l("#jamLayer").checked,tags:l("#tagLayer").checked,stateFilter:l("#stateFilter").value,heatFilter:Number(l("#heatFilter").value)/100}}function T(){o.data&&f.draw(o.data,O())}function j(i){var t;if(o.data=i,tt(l("#metrics"),i),et(l("#summaryRows"),i.latest,((t=i.localization)==null?void 0:t.vehicles)||[]),st(l("#localization"),i.localization),it(l("#uwbValidation"),i.uwb_validation,i.localization_recovery),o.selectedVehicle){const e=[...document.querySelectorAll("#summaryRows [data-vehicle]")].find(s=>s.dataset.vehicle===o.selectedVehicle);e&&e.classList.add("selected")}if(at(l("#analytics"),i.analytics),ot(l("#hotspots"),i),ct(i.latest),o.selectedHotspot){const e=[...document.querySelectorAll("#hotspots [data-hotspot]")].find(s=>Math.abs(Number(s.dataset.x)-o.selectedHotspot.x)<.001&&Math.abs(Number(s.dataset.y)-o.selectedHotspot.y)<.001&&s.dataset.type===o.selectedHotspot.type);e&&e.classList.add("selected")}l("#range").textContent=i.samples?`${new Date(i.start).toLocaleString()} — ${new Date(i.end).toLocaleString()}`:"Waiting for ROS traffic history",T()}function ct(i){const t=l("#routeVehicle"),e=t.value;t.replaceChildren(...i.length?i.map(a=>new Option(a.vehicle_id,a.vehicle_id)):[new Option("No vehicles in this time range","")]);const s=o.selectedVehicle||e;i.some(a=>a.vehicle_id===s)&&(t.value=s)}async function A(i){if(!o.loading){o.loading=!0;try{j(await K(i)),C(!0,`Updated ${new Date().toLocaleTimeString()}`)}catch(t){C(!1,`Monitor offline · ${t.message}`)}finally{o.loading=!1}}}async function z(i=!1){try{const t=await J();if(t.empty){l("#replayClock").textContent="No recorded history";return}const e=o.bounds===null;o.bounds=t,l("#timeline").min=t.first,l("#timeline").max=t.last,l("#selectedTime").min=$(new Date(t.first*1e3)),l("#selectedTime").max=$(new Date(t.last*1e3)),l("#firstLog").textContent=`First ${new Date(t.first*1e3).toLocaleString()}`,l("#lastLog").textContent=`Latest ${new Date(t.last*1e3).toLocaleString()}`,(i||e||!l("#selectedTime").value)&&(o.cursor=t.last,R(Math.max(t.first,t.last-300)),l("#rangeStart").value=$(new Date(t.first*1e3)),l("#rangeEnd").value=$(new Date(t.last*1e3))),(o.cursor===null||o.auto)&&(o.cursor=t.last),M(o.cursor)}catch{l("#replayClock").textContent="History unavailable"}}function g(i="PAUSED"){o.playing=!1,o.lastTick=0,l("#playButton").textContent="▶ Play to latest",l("#playButton").className="",i&&N(i)}function k(i){if(!o.bounds)return;o.auto=!1,o.cursor=B(i),M(o.cursor);const t=Number(l("#trailMinutes").value)*60,e=o.playing&&o.playbackStart!==null?o.playbackStart:Math.max(o.bounds.first,o.cursor-t),s=Math.min(o.cursor-.001,e);A({start:new Date(s*1e3).toISOString(),end:new Date(o.cursor*1e3).toISOString()})}function F(){g(null),o.auto=!0,o.playbackStart=null,N("LIVE"),o.bounds&&(o.cursor=o.bounds.last,M(o.cursor)),A({hours:Number(l("#trailMinutes").value)/60})}function dt(){g("HISTORY");const i=l("#selectedTime").value;i&&k(new Date(i).getTime()/1e3)}function ht(){if(o.playing){g();return}if(!o.bounds)return;o.auto=!1;const i=new Date(l("#selectedTime").value).getTime()/1e3;o.cursor=B(Number.isFinite(i)?i:o.bounds.first),o.playbackStart=o.cursor,o.playbackEnd=o.bounds.last,o.playing=!0,o.lastTick=performance.now(),N("REPLAY"),l("#playButton").textContent="❚❚ Pause replay",l("#playButton").className="playing",k(o.cursor)}function ut(){if(!o.playing)return;const i=performance.now();if(o.loading){o.lastTick=i;return}const t=Math.min(2,(i-o.lastTick)/1e3);o.lastTick=i,o.cursor=Math.min(o.playbackEnd,o.cursor+t*Number(l("#playSpeed").value)),R(o.cursor),k(o.cursor),o.cursor>=o.playbackEnd&&g("HISTORY")}function pt(){const i=l("#rangeStart").value,t=l("#rangeEnd").value;!i||!t||(g("HISTORY"),o.auto=!1,A({start:new Date(i).toISOString(),end:new Date(t).toISOString()}))}l("#liveButton").addEventListener("click",F);l("#jumpButton").addEventListener("click",dt);l("#playButton").addEventListener("click",ht);l("#applyRange").addEventListener("click",pt);l("#stateFilter").addEventListener("change",T);function U(i){var e,s;o.selectedVehicle=i.dataset.vehicle,o.selectedHotspot=null,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(a=>{a.classList.toggle("selected",a===i)}),document.querySelectorAll("#hotspots [data-hotspot]").forEach(a=>a.classList.remove("selected")),l("#pathLayer").checked=!0,f.focusVehicle(o.selectedVehicle),[...l("#routeVehicle").options].some(a=>a.value===o.selectedVehicle)&&(l("#routeVehicle").value=o.selectedVehicle);const t=(s=(e=o.data)==null?void 0:e.latest)==null?void 0:s.find(a=>a.vehicle_id===o.selectedVehicle);l("#mapFocus").textContent=t?`${o.selectedVehicle} path · x ${t.x.toFixed(1)} · y ${t.y.toFixed(1)} · ${t.speed.toFixed(2)} m/s`:`${o.selectedVehicle} path`,l(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})}l("#summaryRows").addEventListener("click",i=>{const t=i.target.closest("[data-vehicle]");t&&U(t)});l("#summaryRows").addEventListener("keydown",i=>{if(i.key!=="Enter"&&i.key!==" ")return;const t=i.target.closest("[data-vehicle]");t&&(i.preventDefault(),U(t))});l("#hotspots").addEventListener("click",i=>{const t=i.target.closest("[data-hotspot]");if(!t)return;o.selectedVehicle=null,l("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(s=>s.classList.remove("selected")),o.selectedHotspot={x:Number(t.dataset.x),y:Number(t.dataset.y),type:t.dataset.type,events:Number(t.dataset.events),first_started:Number(t.dataset.first)||null,last_ended:Number(t.dataset.last)||null},document.querySelectorAll("#hotspots [data-hotspot]").forEach(s=>{s.classList.toggle("selected",s===t)}),f.focusAt(o.selectedHotspot);const e=o.selectedHotspot.first_started?`${new Date(o.selectedHotspot.first_started*1e3).toLocaleString()} → ${new Date((o.selectedHotspot.last_ended||o.selectedHotspot.first_started)*1e3).toLocaleString()}`:"time unavailable";l("#mapFocus").textContent=`${o.selectedHotspot.type} · x ${o.selectedHotspot.x.toFixed(1)} · y ${o.selectedHotspot.y.toFixed(1)} · ${o.selectedHotspot.events} event(s) · ${e}`,l(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})});function q(i){var t,e;if(i.dataset.insight==="stuck")o.selectedVehicle=null,l("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(s=>s.classList.remove("selected")),o.selectedHotspot={x:Number(i.dataset.x),y:Number(i.dataset.y),type:"Stuck",events:Number(i.dataset.events),first_started:Number(i.dataset.first)||null,last_ended:Number(i.dataset.last)||null},f.focusAt(o.selectedHotspot),l("#mapFocus").textContent=`Stuck · x ${o.selectedHotspot.x.toFixed(1)} · y ${o.selectedHotspot.y.toFixed(1)} · ${o.selectedHotspot.events} event(s)`;else{const s=i.dataset.vehicle,a=(e=(t=o.data)==null?void 0:t.analytics)==null?void 0:e.worst_path;o.selectedVehicle=s,o.selectedHotspot=null,l("#pathLayer").checked=!0,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(n=>{n.classList.toggle("selected",n.dataset.vehicle===s)}),document.querySelectorAll("#hotspots [data-hotspot]").forEach(n=>n.classList.remove("selected")),f.focusVehicle(s),l("#mapFocus").textContent=`${s} path · ${i.dataset.insight==="window"?"bad interval":"worst path"}${a?` · ${a.slow_seconds.toFixed(0)} s slow`:""}`}l(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})}l("#analytics").addEventListener("click",i=>{const t=i.target.closest("[data-insight]");t&&q(t)});l("#analytics").addEventListener("keydown",i=>{if(i.key!=="Enter"&&i.key!==" ")return;const t=i.target.closest("[data-insight]");t&&(i.preventDefault(),q(t))});["pathLayer","vehicleLayer","densityLayer","stuckLayer","jamLayer","tagLayer","heatMetric","heatFilter"].forEach(i=>l(`#${i}`).addEventListener("input",T));l("#trailMinutes").addEventListener("change",()=>o.auto?F():o.cursor!==null&&k(o.cursor));["selectedTime","rangeStart","rangeEnd"].forEach(i=>l(`#${i}`).addEventListener("focus",()=>{o.auto=!1,g("PAUSED")}));l("#timeline").addEventListener("input",i=>{o.auto=!1,g("HISTORY"),o.cursor=Number(i.target.value),R(o.cursor),M(o.cursor),clearTimeout(o.debounce),o.debounce=setTimeout(()=>k(o.cursor),120)});function Y(){o.route=null,x.setRoute(null),W(l("#routeResult"),null)}x.onDestination(i=>{l("#routeX").value=i.x.toFixed(2),l("#routeY").value=i.y.toFixed(2),l("#routeStatus").className="route-status",l("#routeStatus").textContent=`Destination selected at x ${i.x.toFixed(2)}, y ${i.y.toFixed(2)}. Generate the suggestion when ready.`});l("#routeVehicle").addEventListener("change",Y);l("#routeForm").addEventListener("submit",async i=>{var n;if(i.preventDefault(),o.routeLoading)return;const t=l("#routeVehicle").value,e=Number(l("#routeX").value),s=Number(l("#routeY").value),a=l("#routeStatus");if(!t||!Number.isFinite(e)||!Number.isFinite(s)){a.className="route-status error",a.textContent="Choose a forklift and set both destination coordinates.";return}if(!((n=o.data)!=null&&n.samples)){a.className="route-status error",a.textContent="No recorded traffic is available in this dashboard time range.";return}o.routeLoading=!0,l("#suggestRouteButton").disabled=!0,a.className="route-status loading",a.textContent="Calculating collision-clear alternatives…";try{o.route=await Q({vehicle_id:t,destination:{x:e,y:s},nominal_speed_mps:Number(l("#routeSpeed").value),start:o.data.start,end:o.data.end}),x.setRoute(o.route),W(l("#routeResult"),o.route),a.className="route-status success",a.textContent=`${t}: route ready. Green is the suggested path; dashed gray is the shortest path.`}catch(r){Y(),a.className="route-status error",a.textContent=r.message}finally{o.routeLoading=!1,l("#suggestRouteButton").disabled=!1}});async function mt(){j(H);try{const i=await X();await Promise.all([f.load(i),x.load(i)]),T()}catch{await Promise.all([f.load(f.info,"/fallback-map.png"),x.load(x.info,"/fallback-map.png")]),f.draw(H,O()),C(!1,"Map preview · ROS monitor offline")}await z(!0),F()}mt();setInterval(ut,400);let P=0;setInterval(()=>{o.auto&&F(),P+=1,P%5===0&&z()},2e3);
