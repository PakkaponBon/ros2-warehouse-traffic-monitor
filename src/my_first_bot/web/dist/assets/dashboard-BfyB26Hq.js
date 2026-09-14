import"./modulepreload-polyfill-B5Qt9EMX.js";import{a as J,b as K,c as Q,d as Z}from"./api-BiLEcXRt.js";const m=i=>String(i).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),tt=i=>i.vehicle_id==="my_robot"?`${m(i.vehicle_id)} <span class="tag">AMR</span>`:m(i.vehicle_id),E={moving:["Moving","moving"],turning:["Turning normally","turning"],waiting_vehicle:["Waiting for vehicle","waiting"],blocked_obstacle:["Blocked by obstacle","blocked"],stalled:["Commanded but not moving","blocked"],stuck:["Stuck","blocked"],idle:["Idle / intentional stop","idle"],planning:["Planning next route","idle"],localizing:["Waiting for localization","idle"],sensor_wait:["Waiting for LiDAR","idle"],unknown:["State unavailable","idle"]};function I(i){const t=i.speed>=.05?"moving":"unknown",e=i.motion_state||t,[s,a]=E[e]||E.unknown;return{state:e,label:s,className:a}}function et(i,t){var n;const e=t.latest.filter(c=>I(c).state==="moving").length,s=(n=t.localization)==null?void 0:n.summary,a=s!=null&&s.samples?`${s.mean_error.toFixed(2)} m`:"—";i.innerHTML=[["samples",t.samples.toLocaleString(),"Position samples",""],["vehicles",t.latest.length,"Active vehicles","teal"],["moving",e,"Moving now","teal"],["stuck",t.stuck.length,"Stuck hotspots","orange"],["congestion",t.congestion.length,"Congestion hotspots","red"],["localization",a,"Mean AMCL error","teal"]].map(c=>`<article class="metric ${c[3]}"><strong>${c[1]}</strong><span>${c[2]}</span></article>`).join("")}function st(i,t,e=[]){if(!t.length){i.innerHTML='<div class="empty">No fresh vehicle positions at the end of this range.</div>';return}i.innerHTML=t.map(s=>{const a=I(s),n=e.find(c=>c.vehicle_id===s.vehicle_id);return`<article class="vehicle-card vehicle-action" data-vehicle="${m(s.vehicle_id)}" role="button" tabindex="0" title="Show ${m(s.vehicle_id)} path on the map">
      <div class="vehicle-card-head"><strong><i class="status-dot ${a.className}"></i>${tt(s)}</strong>
        <b class="speed">${s.speed.toFixed(2)} m/s</b></div>
      <div class="vehicle-position">Position <b>x ${s.x.toFixed(2)} m</b><b>y ${s.y.toFixed(2)} m</b></div>
      ${n?`<div class="localization-error">LiDAR AMCL error <b>${n.latest_error.toFixed(2)} m</b></div>`:""}
      <small class="motion-state ${a.className}">● ${a.label}</small>
    </article>`}).join("")}function it(i,t){const e=t==null?void 0:t.summary,s=(t==null?void 0:t.vehicles)||[];if(!(e!=null&&e.samples)){i.innerHTML='<div class="empty">Waiting for AMCL and Gazebo comparison samples…</div>';return}const a=e.mean_yaw_error*180/Math.PI;i.innerHTML=`
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
      </div>`).join("")}</div>`}function at(i,t,e={}){const s=(t==null?void 0:t.vehicles)||[],a=(t==null?void 0:t.summary)||{};if(!s.length){i.innerHTML=t!=null&&t.historical?'<div class="empty">No recorded UWB validation in this time range.</div>':'<div class="empty">Waiting for live UWB validation…</div>';return}const n={confirmed:["Confirmed","confirmed"],caution:["Caution","caution"],disagreement:["Disagreement","disagreement"],uwb_unavailable:["UWB unavailable","unavailable"],waiting_amcl:["Waiting for AMCL","unavailable"],unsynchronized:["Time mismatch","unavailable"]},c=(a.uwb_unavailable||0)+(a.waiting_amcl||0)+(a.unsynchronized||0),r=t.as_of?new Date(t.as_of).toLocaleString():null,d=(e==null?void 0:e.vehicles)||[],h=new Map(d.map(u=>[u.vehicle_id,u])),p=(e==null?void 0:e.summary)||{},b=d.length?`<div class="recovery-summary ${p.interlocked?"active":""}">
        <b>Motion interlock</b>
        <span>${p.ready||0} ready · ${p.interlocked||0} stopped/recovering</span>
      </div>`:"";i.innerHTML=`
    ${b}
    <div class="uwb-overview">
      <div><strong>${a.confirmed||0}</strong><small>Confirmed</small></div>
      <div><strong>${a.caution||0}</strong><small>Caution</small></div>
      <div><strong>${a.disagreement||0}</strong><small>Disagree</small></div>
      <div><strong>${c}</strong><small>Not compared</small></div>
    </div>
    <div class="uwb-list">${s.map(u=>{var M;const[v,y]=n[u.state]||["Unknown","unavailable"],x=Number.isFinite(u.error_m)?`${u.error_m.toFixed(2)} m difference`:u.state==="unsynchronized"&&Number.isFinite(u.measurement_skew_s)?`${u.measurement_skew_s.toFixed(2)} s time mismatch`:((M=u.uwb_reason)==null?void 0:M.replaceAll("_"," "))||"No comparison",w=u.raw_state&&u.raw_state!==u.state?` · checking ${u.raw_state.replaceAll("_"," ")}`:"",S=h.get(u.vehicle_id),g=S?` · interlock ${S.state.replaceAll("_"," ")}`:"";return`<div class="uwb-row">
        <span><b>${m(u.vehicle_id)}</b><small>${u.visible_tag_count||0} tags visible · ${m(x)}${m(w)}${m(g)}</small></span>
        <strong class="uwb-state ${y}">${v}</strong>
      </div>`}).join("")}</div>
    <p class="uwb-note">${t.live?"Live comparison":`Recorded comparison${r?` at ${r}`:""}`}. AMCL remains the position source; UWB is confirmation only.</p>`}function ot(i,t){const e=t==null?void 0:t.most_stuck_location,s=t==null?void 0:t.worst_path,a=(n,c)=>n?`${new Date(n*1e3).toLocaleString()} → ${new Date((c||n)*1e3).toLocaleString()}`:"No slow/stuck interval in this range";i.innerHTML=`
    <div class="insight-row ${e?"insight-action":""}" ${e?`data-insight="stuck" role="button" tabindex="0" data-x="${e.x}" data-y="${e.y}" data-events="${e.events}" data-first="${e.first_started||""}" data-last="${e.last_ended||""}"`:""}>
      <i class="insight-icon orange">!</i><div><b>Most stuck position</b><small>${e?`x ${e.x.toFixed(2)} · y ${e.y.toFixed(2)} · ${e.events} event(s)`:"No stuck position recorded"}</small>${e?`<em>${a(e.first_started,e.last_ended)}</em>`:""}</div>
    </div>
    <div class="insight-row ${s?"insight-action":""}" ${s?`data-insight="path" role="button" tabindex="0" data-vehicle="${m(s.vehicle_id)}"`:""}>
      <i class="insight-icon red">↝</i><div><b>Worst vehicle path</b><small>${s?`${m(s.vehicle_id)} · ${s.reason}`:"No vehicle path recorded"}</small>${s?`<em>${s.distance_m.toFixed(1)} m travelled · ${s.slow_seconds.toFixed(0)} s slow</em>`:""}</div>
    </div>
    <div class="insight-row ${s?"insight-action":""}" ${s?`data-insight="window" role="button" tabindex="0" data-vehicle="${m(s.vehicle_id)}"`:""}>
      <i class="insight-icon blue">◷</i><div><b>Bad path window</b><small>${s?a(s.bad_when_start,s.bad_when_end):"No bad interval found"}</small>${s?`<em>Average speed ${s.average_speed.toFixed(2)} m/s</em>`:""}</div>
    </div>`}function _(i,t,e="count"){var x,w,S;if(!t){i.innerHTML='<div class="empty">Click a colored heat spot on the map to see its detailed summary.</div>';return}const s={count:["Position samples","samples"],vehicles:["Unique vehicles","vehicles"],slow_samples:["Slow samples","slow samples"]},[a,n]=s[e]||s.count,c=(w=(x=t.time_details)==null?void 0:x.peaks)==null?void 0:w[e],r=(S=t.time_details)==null?void 0:S.stuck,d=g=>g?`${new Date(g.start*1e3).toLocaleString()} → ${new Date(g.end*1e3).toLocaleString()}`:"No peak time available",h=(c==null?void 0:c.vehicle_ids)||[],p=((c==null?void 0:c.slow_vehicle_states)||[]).map(g=>`${m(g.vehicle_id)} (${g.states.map(M=>m(M.replaceAll("_"," "))).join(", ")})`),b=new Set((c==null?void 0:c.slow_vehicle_ids)||[]),u=h.filter(g=>!b.has(g)),v=Number((c==null?void 0:c[e])||0),y=r!=null&&r.events?`${r.events} event(s), ${r.vehicles} vehicle(s)${r.peak?` · busiest ${d(r.peak)}`:""}`:"None in this selected time range";i.innerHTML=`<div class="heat-area-summary">
    <div class="heat-area-location"><b>Map area</b><span>x ${Number(t.x).toFixed(1)} m · y ${Number(t.y).toFixed(1)} m</span></div>
    <div class="heat-area-grid">
      <div><small>${a}</small><strong>${Number(t[e]||0)}</strong><span>whole selected range</span></div>
      <div><small>Average speed</small><strong>${Number(t.average_speed||0).toFixed(2)} m/s</strong><span>in this area</span></div>
      <div><small>Busiest period</small><strong>${v}</strong><span>${n}</span></div>
      <div><small>Slow at busiest time</small><strong>${Number((c==null?void 0:c.slow_samples)||0)}</strong><span>samples</span></div>
    </div>
    <dl class="heat-area-details">
      <div><dt>Busiest time</dt><dd>${d(c)}</dd></div>
      <div><dt>Vehicles there</dt><dd>${h.length?h.map(m).join(", "):"None recorded"}</dd></div>
      <div><dt>Slow or waiting</dt><dd>${p.length?p.join(", "):"None recorded"}</dd></div>
      <div><dt>Moving normally</dt><dd>${u.length?u.map(m).join(", "):"None recorded"}</dd></div>
      <div><dt>Confirmed stuck</dt><dd>${y}</dd></div>
    </dl>
  </div>`}function nt(i,t){const e=[...t.congestion.map(s=>({...s,type:"Congestion",color:"var(--red)"})),...t.stuck.map(s=>({...s,type:"Stuck",color:"var(--orange)"}))].sort((s,a)=>a.events-s.events).slice(0,6);i.innerHTML=e.length?e.map(s=>`<button type="button" class="hotspot-row" data-hotspot
    data-x="${s.x}" data-y="${s.y}" data-type="${s.type}"
    data-events="${s.events}" data-first="${s.first_started||""}" data-last="${s.last_ended||""}"
    title="Show ${s.type.toLowerCase()} location on the map">
    <span><b style="color:${s.color}">${s.type}</b><small>x ${s.x.toFixed(1)} · y ${s.y.toFixed(1)}</small></span>
    <span class="hotspot-count"><strong>${s.events}×</strong><small>View map</small></span>
  </button>`).join(""):'<div class="empty">No stuck or congestion events.</div>'}function lt(i,t){const e=(t==null?void 0:t.buckets)||[];if(!e.length){i.innerHTML='<div class="empty">No stuck vehicles in this time range.</div>';return}const s=t.bucket_seconds||60,a=s<3600?`${s/60} minute${s===60?"":"s"}`:`${s/3600} hour${s===3600?"":"s"}`;i.innerHTML=`
    <p class="timeline-note">Busiest stuck location per ${a}; newest first.</p>
    <div class="stuck-time-list">${[...e].reverse().map(n=>{const c=n.hotspot,r=new Date(n.start*1e3).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),d=c.vehicle_ids.map(m).join(", ");return`<button type="button" class="stuck-time-row" data-stuck-time
        data-x="${c.x}" data-y="${c.y}"
        data-time="${n.start}" data-count="${c.vehicles}"
        title="Show this stuck location on the map">
        <span><b>${r}</b><small>x ${c.x.toFixed(1)} · y ${c.y.toFixed(1)}</small></span>
        <span><strong>${c.vehicles}</strong><small>at hotspot · ${n.total_vehicles} total</small></span>
        <em>${d}</em>
      </button>`}).join("")}</div>`}function j(i,t){if(!t){i.innerHTML='<div class="empty">Choose a forklift and click a destination on the route map.</div>';return}const e=n=>n>=60?`${(n/60).toFixed(1)} min`:`${n.toFixed(0)} sec`,s=t.suggested.distance_m-t.baseline.distance_m,a=t.destination.snapped?'<p class="route-warning">Destination was moved to the nearest collision-clear map cell.</p>':"";i.innerHTML=`
    <div class="route-result-grid">
      <div><small>Suggested distance</small><strong>${t.suggested.distance_m.toFixed(1)} m</strong><span>${s>.05?`+${s.toFixed(1)} m vs shortest`:"same as shortest"}</span></div>
      <div><small>Estimated time</small><strong>${e(t.suggested.eta_s)}</strong><span>at selected nominal speed</span></div>
      <div><small>Traffic risk</small><strong>${t.suggested.risk_score.toFixed(0)} / 100</strong><span>${t.risk_reduction.toFixed(1)} points lower</span></div>
      <div><small>Hotspots avoided</small><strong>${t.hotspots_avoided}</strong><span>from this history window</span></div>
    </div>
    <p class="route-explanation">${m(t.explanation)}</p>
    ${a}
    <p class="route-meta">Generated ${new Date(t.generated_at).toLocaleString()} using traffic from ${new Date(t.traffic_window.start).toLocaleString()} to ${new Date(t.traffic_window.end).toLocaleString()}.</p>`}function V(i,t){const e=document.querySelector("#connection");e.classList.toggle("error",!i),e.querySelector("span").textContent=t}function D(i){const t=document.querySelector("#mode");t.textContent=i,t.className=`mode ${i.toLowerCase()}`}const B=["#8d6bff","#00a7d8","#ef7d50","#21a47b","#d45fc0","#789637","#d99924","#4a75dc","#d35c69"];function ct(i,t){if(![Number(i),Number(t)].every(Number.isFinite))return"time unavailable";const e=new Date(Number(i)*1e3),s=new Date(Number(t)*1e3),a=e.toLocaleDateString()===s.toLocaleDateString(),n={hour:"2-digit",minute:"2-digit"};return a?`${e.toLocaleDateString()} ${e.toLocaleTimeString([],n)}–${s.toLocaleTimeString([],n)}`:`${e.toLocaleString([],n)}–${s.toLocaleString([],n)}`}function rt(i,t="count"){var c,r,d;const e=Number(i[t]||0),s=t==="vehicles"?`${e} unique vehicles`:t==="slow_samples"?`${e} slow samples`:`${e} position samples`,a=[`Area x ${Number(i.x).toFixed(1)}, y ${Number(i.y).toFixed(1)}`,`${s} · average speed ${Number(i.average_speed||0).toFixed(2)} m/s`],n=(r=(c=i.time_details)==null?void 0:c.peaks)==null?void 0:r[t];return n&&(a.push(`Busiest: ${ct(n.start,n.end)}`),(d=n.vehicle_ids)!=null&&d.length&&a.push(`Vehicles: ${n.vehicle_ids.join(", ")}`)),a.push("Click for full details"),a.join(`
`)}class dt{constructor(t){this.canvas=t,this.ctx=t.getContext("2d"),this.info={origin:[-18.6,-26.3],resolution:.05,width:607,height:1004},this.image=null,this.hits=[],this.focused=null,this.focusedVehicle=null,this.lastData=null,this.lastOptions=null,this.rotated=!1,this.onHeatSelect=null,this.tooltip=document.querySelector("#mapTooltip"),t.addEventListener("mousemove",e=>this.showTooltip(e)),t.addEventListener("click",e=>this.selectHeat(e)),t.addEventListener("mouseleave",()=>{this.tooltip.style.display="none"})}async load(t,e="/map.png"){this.info=t,this.rotated=this.height()>this.width()*1.1,this.canvas.width=this.rotated?1600:1200;const s=this.rotated?this.width()/this.height():this.height()/this.width();return this.canvas.height=Math.max(1,Math.round(this.canvas.width*s)),new Promise(a=>{const n=new Image;n.onload=()=>{this.image=n,a()},n.onerror=()=>a(),n.src=`${e}?${Date.now()}`})}width(){return this.info.width*this.info.resolution}height(){return this.info.height*this.info.resolution}project(t,e){const s=(t-this.info.origin[0])/this.width(),a=(e-this.info.origin[1])/this.height();return this.rotated?{x:a*this.canvas.width,y:s*this.canvas.height}:{x:s*this.canvas.width,y:(1-a)*this.canvas.height}}drawGrid(){const{ctx:t,canvas:e}=this;t.fillStyle="#e9eef0",t.fillRect(0,0,e.width,e.height),this.image&&(this.rotated?(t.save(),t.translate(e.width,0),t.rotate(Math.PI/2),t.drawImage(this.image,0,0,e.height,e.width),t.restore()):t.drawImage(this.image,0,0,e.width,e.height)),t.fillStyle="#ffffff18",t.fillRect(0,0,e.width,e.height),t.strokeStyle="#aebbc499",t.lineWidth=1,t.font="11px system-ui",t.fillStyle="#536875";const s=this.width()>35?5:4,a=Math.ceil(this.info.origin[0]/s)*s,n=this.info.origin[0]+this.width();for(let d=a;d<=n;d+=s){const h=this.project(d,this.info.origin[1]),p=this.project(d,this.info.origin[1]+this.height());t.beginPath(),t.moveTo(h.x,h.y),t.lineTo(p.x,p.y),t.stroke(),this.rotated?t.fillText(`${d.toFixed(0)} m`,7,h.y-4):t.fillText(`${d.toFixed(0)} m`,h.x+4,e.height-8)}const c=Math.ceil(this.info.origin[1]/s)*s,r=this.info.origin[1]+this.height();for(let d=c;d<=r;d+=s){const h=this.project(this.info.origin[0],d),p=this.project(this.info.origin[0]+this.width(),d);t.beginPath(),t.moveTo(h.x,h.y),t.lineTo(p.x,p.y),t.stroke(),this.rotated?t.fillText(`${d.toFixed(0)} m`,h.x+4,e.height-8):t.fillText(`${d.toFixed(0)} m`,7,h.y-4)}t.strokeStyle="#43596a",t.lineWidth=7,t.strokeRect(4,4,e.width-8,e.height-8)}drawHeat(t,e,s="count"){if(!t.density.length)return;const a=t.density.map(h=>Number(h[s]||0)).sort((h,p)=>h-p),n=a[Math.floor((a.length-1)*e)]||0,c=Math.max(n+1,a[Math.floor((a.length-1)*.95)]||1),r=Math.log1p(n),d=Math.max(.001,Math.log1p(c)-r);t.density.forEach(h=>{const p=Number(h[s]||0);if(p<n)return;const b=Math.max(0,Math.min(1,(Math.log1p(p)-r)/d)),u=12+16*b,{x:v,y}=this.project(h.x,h.y),x=this.ctx.createRadialGradient(v,y,0,v,y,u),w=Math.round(210*(1-b));x.addColorStop(0,`hsla(${w}, 90%, 53%, ${.15+.4*b})`),x.addColorStop(1,`hsla(${w}, 90%, 53%, 0)`),this.ctx.fillStyle=x,this.ctx.beginPath(),this.ctx.arc(v,y,u,0,Math.PI*2),this.ctx.fill(),this.hits.push({x:v,y,radius:u,priority:0,label:rt(h,s),heatValue:h,heatMetric:s})})}trackColor(t){let e=0;for(const s of t)e=e*31+s.charCodeAt(0)>>>0;return B[e%B.length]}trackSegments(t){const e=[];let s=[],a=null;for(const n of t){const c={x:Number(n[0]),y:Number(n[1]),time:Number(n[2])};if(![c.x,c.y,c.time].every(Number.isFinite)){s.length>1&&e.push(s),s=[],a=null;continue}if(a){const r=c.time-a.time,d=Math.hypot(c.x-a.x,c.y-a.y),h=Math.max(2.5,r*2.2+.75);(r<=0||r>12||d>h)&&(s.length>1&&e.push(s),s=[])}s.push(c),a=c}return s.length>1&&e.push(s),e}traceSegment(t){this.ctx.beginPath(),t.forEach((e,s)=>{const a=this.project(e.x,e.y);s===0?this.ctx.moveTo(a.x,a.y):this.ctx.lineTo(a.x,a.y)})}drawPathArrows(t,e){let s=0;for(let a=1;a<t.length;a+=1){const n=this.project(t[a-1].x,t[a-1].y),c=this.project(t[a].x,t[a].y);if(s+=Math.hypot(c.x-n.x,c.y-n.y),s<90)continue;s=0;const r=Math.atan2(c.y-n.y,c.x-n.x);this.ctx.save(),this.ctx.translate(c.x,c.y),this.ctx.rotate(r),this.ctx.fillStyle=e,this.ctx.strokeStyle="#071521",this.ctx.lineWidth=2,this.ctx.beginPath(),this.ctx.moveTo(8,0),this.ctx.lineTo(-5,-5),this.ctx.lineTo(-2,0),this.ctx.lineTo(-5,5),this.ctx.closePath(),this.ctx.fill(),this.ctx.stroke(),this.ctx.restore()}}drawPaths(t){this.focusedVehicle&&(t.tracks||[]).forEach(e=>{if(e.points.length<2||this.focusedVehicle&&e.vehicle_id!==this.focusedVehicle)return;const s=this.trackColor(e.vehicle_id),a=this.trackSegments(e.points);this.ctx.save(),this.ctx.lineCap="round",this.ctx.lineJoin="round";for(const n of a)this.traceSegment(n),this.ctx.strokeStyle="#071521cc",this.ctx.lineWidth=8,this.ctx.stroke(),this.traceSegment(n),this.ctx.strokeStyle=s,this.ctx.lineWidth=4.5,this.ctx.shadowColor=s,this.ctx.shadowBlur=5,this.ctx.stroke(),this.ctx.shadowBlur=0,this.drawPathArrows(n,s);this.ctx.restore()})}circle(t,e,s,a,n){const{x:c,y:r}=this.project(t.x,t.y);this.ctx.fillStyle=s,this.ctx.beginPath(),this.ctx.arc(c,r,e,0,Math.PI*2),this.ctx.fill(),n&&(this.ctx.strokeStyle=n,this.ctx.lineWidth=2,this.ctx.stroke()),this.hits.push({x:c,y:r,radius:Math.max(e,12),priority:2,label:a})}drawVehicle(t){const{x:e,y:s}=this.project(t.x,t.y),a=t.motion_state||(t.speed<.05?"unknown":"moving"),n={moving:"#25d0ae",turning:"#3da4ff",waiting_vehicle:"#ffbf47",blocked_obstacle:"#ff6856",stalled:"#ff5263",stuck:"#ff5263",idle:"#91a7b9",planning:"#91a7b9",localizing:"#91a7b9",sensor_wait:"#91a7b9",unknown:"#91a7b9"},c=t.vehicle_id==="my_robot"?"#ffffff":n[a]||n.unknown;this.ctx.shadowColor="#07111a",this.ctx.shadowBlur=8,this.ctx.fillStyle=c,this.ctx.beginPath(),this.ctx.arc(e,s,9,0,Math.PI*2),this.ctx.fill(),this.ctx.shadowBlur=0,this.ctx.strokeStyle="#132638",this.ctx.lineWidth=2,this.ctx.stroke();const r=t.vehicle_id.replace("vehicle_","V");this.ctx.font="bold 11px system-ui";const d=this.ctx.measureText(r).width+10;this.ctx.fillStyle="#0b1825e8",this.ctx.fillRect(e-d/2,s-29,d,16),this.ctx.fillStyle="#f2f7fa",this.ctx.textAlign="center",this.ctx.fillText(r,e,s-17),this.ctx.textAlign="start",this.hits.push({x:e,y:s,radius:13,priority:3,label:`${t.vehicle_id} · ${a.replaceAll("_"," ")} · ${t.speed.toFixed(2)} m/s · x ${t.x.toFixed(2)}, y ${t.y.toFixed(2)}`})}drawUwbTags(){(this.info.uwb_tags||[]).forEach(t=>{const{x:e,y:s}=this.project(Number(t.x),Number(t.y));this.ctx.save(),this.ctx.translate(e,s),this.ctx.rotate(Math.PI/4),this.ctx.globalAlpha=t.enabled===!1?.35:1,this.ctx.fillStyle="#f04df2",this.ctx.shadowColor="#f04df2",this.ctx.shadowBlur=10,this.ctx.fillRect(-7,-7,14,14),this.ctx.shadowBlur=0,this.ctx.strokeStyle="#53145f",this.ctx.lineWidth=2,this.ctx.strokeRect(-7,-7,14,14),this.ctx.restore(),this.ctx.font="bold 10px system-ui",this.ctx.fillStyle="#6e187c",this.ctx.textAlign="center",this.ctx.fillText(t.id,e,s-13),this.ctx.textAlign="start",this.hits.push({x:e,y:s,radius:14,priority:3,label:`UWB tag ${t.id} · ${t.enabled===!1?"disabled":"enabled"} · battery ${Number(t.battery_pct??100).toFixed(0)}% · x ${Number(t.x).toFixed(1)}, y ${Number(t.y).toFixed(1)}, z ${Number(t.z).toFixed(1)} m`})})}draw(t,e){this.lastData=t,this.lastOptions=e,this.hits=[],this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height),this.drawGrid(),e.heat&&this.drawHeat(t,e.heatFilter,e.heatMetric),e.paths&&this.drawPaths(t),e.stuck&&t.stuck.slice(0,12).forEach(s=>this.circle(s,8+Math.min(10,Math.log2(s.events+1)*2),"#ffbf47cc",`${s.events} stuck event(s) · ${Math.round(s.duration)} seconds`,"#fff0bd")),e.congestion&&t.congestion.slice(0,12).forEach(s=>this.circle(s,10+Math.min(14,s.max_vehicles*2),"#ff5263b8",`${s.events} congestion event(s) · up to ${s.max_vehicles} vehicles`,"#ff9ba5")),e.vehicles&&(e.stateFilter==="all"?t.latest:t.latest.filter(a=>(a.motion_state||(a.speed<.05?"unknown":"moving"))===e.stateFilter)).forEach(a=>this.drawVehicle(a)),e.tags&&this.drawUwbTags(),this.drawFocus(),this.drawVehicleFocus(t)}focusAt(t){this.focused=t,this.focusedVehicle=null,this.lastData&&this.lastOptions&&this.draw(this.lastData,this.lastOptions)}focusVehicle(t){this.focused=null,this.focusedVehicle=t,this.lastData&&this.lastOptions&&this.draw(this.lastData,this.lastOptions)}setHeatSelectionHandler(t){this.onHeatSelect=typeof t=="function"?t:null}drawFocus(){if(!this.focused||!Number.isFinite(Number(this.focused.x))||!Number.isFinite(Number(this.focused.y)))return;const{x:t,y:e}=this.project(Number(this.focused.x),Number(this.focused.y)),s=this.focused.type==="Congestion"?"#ff5263":this.focused.type==="Heat area"?"#3da4ff":"#ffbf47",a=this.focused.type==="Heat area"?"Selected heat area":`${this.focused.type} · ${this.focused.events} event(s)`;this.ctx.save(),this.ctx.strokeStyle=s,this.ctx.lineWidth=3,this.ctx.shadowColor=s,this.ctx.shadowBlur=14,this.ctx.beginPath(),this.ctx.arc(t,e,20,0,Math.PI*2),this.ctx.stroke(),this.ctx.shadowBlur=0,this.ctx.beginPath(),this.ctx.moveTo(t-30,e),this.ctx.lineTo(t+30,e),this.ctx.moveTo(t,e-30),this.ctx.lineTo(t,e+30),this.ctx.stroke(),this.ctx.font="bold 11px system-ui";const n=this.ctx.measureText(a).width+14;this.ctx.fillStyle="#07111aeb",this.ctx.fillRect(t-n/2,e+27,n,18),this.ctx.fillStyle="#f2f7fa",this.ctx.textAlign="center",this.ctx.fillText(a,t,e+40),this.ctx.textAlign="start",this.ctx.restore(),this.hits.push({x:t,y:e,radius:32,priority:4,label:`${a} · x ${Number(this.focused.x).toFixed(2)}, y ${Number(this.focused.y).toFixed(2)}`})}drawVehicleFocus(t){var h;if(!this.focusedVehicle)return;const e=(t.latest||[]).find(p=>p.vehicle_id===this.focusedVehicle),s=(t.tracks||[]).find(p=>p.vehicle_id===this.focusedVehicle),a=e||((h=s==null?void 0:s.points)!=null&&h.length?{x:s.points.at(-1)[0],y:s.points.at(-1)[1]}:null);if(!a)return;const{x:n,y:c}=this.project(Number(a.x),Number(a.y));this.ctx.save(),this.ctx.strokeStyle="#b06cff",this.ctx.lineWidth=3,this.ctx.shadowColor="#b06cff",this.ctx.shadowBlur=16,this.ctx.beginPath(),this.ctx.arc(n,c,22,0,Math.PI*2),this.ctx.stroke(),this.ctx.shadowBlur=0,this.ctx.font="bold 11px system-ui";const r=`${this.focusedVehicle} path`,d=this.ctx.measureText(r).width+14;this.ctx.fillStyle="#07111aeb",this.ctx.fillRect(n-d/2,c+28,d,18),this.ctx.fillStyle="#f2f7fa",this.ctx.textAlign="center",this.ctx.fillText(r,n,c+41),this.ctx.textAlign="start",this.ctx.restore(),this.hits.push({x:n,y:c,radius:34,priority:4,label:`${r} · x ${Number(a.x).toFixed(2)}, y ${Number(a.y).toFixed(2)}`})}hitAt(t,e=!1){const s=this.canvas.getBoundingClientRect(),a=(t.clientX-s.left)*this.canvas.width/s.width,n=(t.clientY-s.top)*this.canvas.height/s.height;return this.hits.filter(c=>!e||c.heatValue).map(c=>({...c,distance:Math.hypot(c.x-a,c.y-n)})).filter(c=>c.distance<=c.radius).sort((c,r)=>Number(r.priority||0)-Number(c.priority||0)||c.distance-r.distance)[0]}selectHeat(t){const e=this.hitAt(t,!0);!e||!this.onHeatSelect||(this.onHeatSelect(e.heatValue,e.heatMetric),this.tooltip.style.display="none")}showTooltip(t){const e=this.hitAt(t);if(!e){this.tooltip.style.display="none";return}this.tooltip.textContent=e.label,this.tooltip.style.display="block";const s=this.canvas.parentElement,a=s.getBoundingClientRect(),n=t.clientX-a.left+14,c=t.clientY-a.top+14,r=Math.max(6,Math.min(n,s.clientWidth-this.tooltip.offsetWidth-6)),d=Math.max(6,Math.min(c,s.clientHeight-this.tooltip.offsetHeight-6));this.tooltip.style.left=`${r}px`,this.tooltip.style.top=`${d}px`}}class ht{constructor(t,e){this.canvas=t,this.ctx=t.getContext("2d"),this.tooltip=e,this.info={origin:[-10,-10],resolution:1,width:20,height:20},this.image=null,this.rotated=!1,this.route=null,this.destinationHandler=null,t.addEventListener("click",s=>{this.destinationHandler&&this.destinationHandler(this.eventToWorld(s))}),t.addEventListener("mousemove",s=>this.showCoordinates(s)),t.addEventListener("mouseleave",()=>{this.tooltip.style.display="none"})}width(){return this.info.width*this.info.resolution}height(){return this.info.height*this.info.resolution}project(t,e){const s=(t-this.info.origin[0])/this.width(),a=(e-this.info.origin[1])/this.height();return this.rotated?{x:a*this.canvas.width,y:s*this.canvas.height}:{x:s*this.canvas.width,y:(1-a)*this.canvas.height}}unproject(t,e){return this.rotated?{x:this.info.origin[0]+e/this.canvas.height*this.width(),y:this.info.origin[1]+t/this.canvas.width*this.height()}:{x:this.info.origin[0]+t/this.canvas.width*this.width(),y:this.info.origin[1]+(1-e/this.canvas.height)*this.height()}}eventToWorld(t){const e=this.canvas.getBoundingClientRect();return this.unproject((t.clientX-e.left)*this.canvas.width/e.width,(t.clientY-e.top)*this.canvas.height/e.height)}async load(t,e="/map.png"){this.info=t,this.rotated=this.height()>this.width()*1.1,this.canvas.width=this.rotated?1200:1e3;const s=this.rotated?this.width()/this.height():this.height()/this.width();return this.canvas.height=Math.max(1,Math.round(this.canvas.width*s)),new Promise(a=>{const n=new Image;n.onload=()=>{this.image=n,this.draw(),a()},n.onerror=()=>{this.draw(),a()},n.src=`${e}?${Date.now()}`})}onDestination(t){this.destinationHandler=t}setRoute(t){this.route=t,this.draw()}drawBase(){const{ctx:t,canvas:e}=this;t.fillStyle="#e9eef0",t.fillRect(0,0,e.width,e.height),this.image&&(this.rotated?(t.save(),t.translate(e.width,0),t.rotate(Math.PI/2),t.drawImage(this.image,0,0,e.height,e.width),t.restore()):t.drawImage(this.image,0,0,e.width,e.height)),t.fillStyle="#ffffff12",t.fillRect(0,0,e.width,e.height),t.strokeStyle="#43596a",t.lineWidth=7,t.strokeRect(4,4,e.width-8,e.height-8)}drawPolyline(t,e,s,a=!1){if(!t||t.length<2)return;const n=this.ctx;n.save(),n.strokeStyle=e,n.lineWidth=s,n.lineCap="round",n.lineJoin="round",n.setLineDash(a?[11,8]:[]),n.beginPath(),t.forEach(([c,r],d)=>{const h=this.project(c,r);d===0?n.moveTo(h.x,h.y):n.lineTo(h.x,h.y)}),n.stroke(),n.restore()}drawMarker(t,e,s){if(!t)return;const a=this.project(t.x,t.y),n=this.ctx;n.save(),n.fillStyle=e,n.shadowColor=e,n.shadowBlur=12,n.beginPath(),n.arc(a.x,a.y,10,0,Math.PI*2),n.fill(),n.shadowBlur=0,n.strokeStyle="#07111d",n.lineWidth=3,n.stroke(),n.font="bold 12px system-ui",n.fillStyle="#07111ddd",n.fillRect(a.x+12,a.y-13,n.measureText(s).width+10,18),n.fillStyle="#ffffff",n.fillText(s,a.x+17,a.y),n.restore()}draw(){if(this.drawBase(),!this.route)return;const t=this.ctx;for(const e of this.route.risk_cells||[]){const s=this.project(e.x,e.y),a=4+8*e.risk,n=t.createRadialGradient(s.x,s.y,0,s.x,s.y,a);n.addColorStop(0,`rgba(255, 82, 99, ${.12+e.risk*.48})`),n.addColorStop(1,"rgba(255, 82, 99, 0)"),t.fillStyle=n,t.beginPath(),t.arc(s.x,s.y,a,0,Math.PI*2),t.fill()}this.drawPolyline(this.route.baseline.points,"#70869a",4,!0),this.drawPolyline(this.route.suggested.points,"#25d0ae",6),this.drawMarker(this.route.start,"#3da4ff","START"),this.drawMarker(this.route.destination,"#b06cff","GOAL")}showCoordinates(t){const e=this.canvas.getBoundingClientRect(),s=this.eventToWorld(t);this.tooltip.textContent=`Set destination · x ${s.x.toFixed(2)}, y ${s.y.toFixed(2)}`,this.tooltip.style.display="block",this.tooltip.style.left=`${t.clientX-e.left+14}px`,this.tooltip.style.top=`${t.clientY-e.top+14}px`}}const ut=document.querySelector("#app");ut.innerHTML=`
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
    <nav class="top-links" aria-label="Dashboard pages">
      <a class="active" href="/">Traffic</a>
      <a href="/health.html">System health</a>
    </nav>
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
            <span class="sub">Hover for a quick answer · click heat for the full area summary</span>
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

      <section class="panel route-panel" hidden aria-hidden="true">
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

      <section class="panel area-summary-panel">
        <div class="panel-head">
          <div>
            <h2>Selected area summary</h2>
            <span class="sub">Click a colored heat spot on the traffic map for its complete breakdown</span>
          </div>
          <span class="tag">HEAT DETAILS</span>
        </div>
        <div id="heatAreaSummary">
          <div class="empty">Click a colored heat spot on the map to see its detailed summary.</div>
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
`;const l=i=>document.querySelector(i),f=new dt(l("#map")),k=new ht(l("#routeMap"),l("#routeTooltip")),o={data:null,bounds:null,cursor:null,auto:!0,loading:!1,playing:!1,playbackEnd:null,playbackStart:null,lastTick:0,debounce:null,selectedHotspot:null,selectedHeat:null,selectedVehicle:null,route:null,routeLoading:!1},P={samples:0,latest:[],density:[],tracks:[],stuck:[],stuck_timeline:{bucket_seconds:60,buckets:[]},congestion:[],start:new Date().toISOString(),end:new Date().toISOString(),analytics:{},localization:{summary:{samples:0},vehicles:[]},uwb_validation:{live:!0,summary:{},vehicles:[]},localization_recovery:{live:!0,summary:{},vehicles:[]}};function L(i){return new Date(i.getTime()-i.getTimezoneOffset()*6e4).toISOString().slice(0,19)}function T(i){l("#selectedTime").value=L(new Date(i*1e3))}function F(i){i!==null&&(l("#timeline").value=i,l("#replayClock").textContent=new Date(i*1e3).toLocaleString())}function O(i){return o.bounds?Math.max(o.bounds.first,Math.min(o.bounds.last,i)):i}function q(){return{paths:l("#pathLayer").checked,vehicles:l("#vehicleLayer").checked,heat:l("#densityLayer").checked,heatMetric:l("#heatMetric").value,stuck:l("#stuckLayer").checked,congestion:l("#jamLayer").checked,tags:l("#tagLayer").checked,stateFilter:l("#stateFilter").value,heatFilter:Number(l("#heatFilter").value)/100}}function H(){o.data&&f.draw(o.data,q())}function z(i){var t;if(o.data=i,et(l("#metrics"),i),st(l("#summaryRows"),i.latest,((t=i.localization)==null?void 0:t.vehicles)||[]),it(l("#localization"),i.localization),at(l("#uwbValidation"),i.uwb_validation,i.localization_recovery),o.selectedVehicle){const e=[...document.querySelectorAll("#summaryRows [data-vehicle]")].find(s=>s.dataset.vehicle===o.selectedVehicle);e&&e.classList.add("selected")}if(ot(l("#analytics"),i.analytics),o.selectedHeat){const e=i.density.find(s=>Math.abs(Number(s.x)-Number(o.selectedHeat.value.x))<.001&&Math.abs(Number(s.y)-Number(o.selectedHeat.value.y))<.001);e?(o.selectedHeat.value=e,_(l("#heatAreaSummary"),e,o.selectedHeat.metric)):(o.selectedHeat=null,_(l("#heatAreaSummary"),null))}if(nt(l("#hotspots"),i),lt(l("#stuckTimeline"),i.stuck_timeline),pt(i.latest),o.selectedHotspot){const e=[...document.querySelectorAll("#hotspots [data-hotspot]")].find(s=>Math.abs(Number(s.dataset.x)-o.selectedHotspot.x)<.001&&Math.abs(Number(s.dataset.y)-o.selectedHotspot.y)<.001&&s.dataset.type===o.selectedHotspot.type);e&&e.classList.add("selected")}l("#range").textContent=i.samples?`${new Date(i.start).toLocaleString()} — ${new Date(i.end).toLocaleString()}`:"Waiting for ROS traffic history",H()}function C(){o.selectedHeat=null,_(l("#heatAreaSummary"),null)}f.setHeatSelectionHandler((i,t)=>{var a,n;o.selectedHeat={value:i,metric:t},o.selectedVehicle=null,o.selectedHotspot=null,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(c=>c.classList.remove("selected")),document.querySelectorAll("#hotspots [data-hotspot]").forEach(c=>c.classList.remove("selected")),l("#pathLayer").checked=!1,_(l("#heatAreaSummary"),i,t),f.focusAt({x:Number(i.x),y:Number(i.y),type:"Heat area",events:Number(i[t]||0)});const e=(n=(a=i.time_details)==null?void 0:a.peaks)==null?void 0:n[t],s=e?` · busiest ${new Date(e.start*1e3).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`:"";l("#mapFocus").textContent=`Selected heat area · x ${Number(i.x).toFixed(1)} · y ${Number(i.y).toFixed(1)}${s}`});function pt(i){const t=l("#routeVehicle"),e=t.value;t.replaceChildren(...i.length?i.map(a=>new Option(a.vehicle_id,a.vehicle_id)):[new Option("No vehicles in this time range","")]);const s=o.selectedVehicle||e;i.some(a=>a.vehicle_id===s)&&(t.value=s)}async function R(i){if(!o.loading){o.loading=!0;try{z(await Q(i)),V(!0,`Updated ${new Date().toLocaleTimeString()}`)}catch(t){V(!1,`Monitor offline · ${t.message}`)}finally{o.loading=!1}}}async function U(i=!1){try{const t=await K();if(t.empty){l("#replayClock").textContent="No recorded history";return}const e=o.bounds===null;o.bounds=t,l("#timeline").min=t.first,l("#timeline").max=t.last,l("#selectedTime").min=L(new Date(t.first*1e3)),l("#selectedTime").max=L(new Date(t.last*1e3)),l("#firstLog").textContent=`First ${new Date(t.first*1e3).toLocaleString()}`,l("#lastLog").textContent=`Latest ${new Date(t.last*1e3).toLocaleString()}`,(i||e||!l("#selectedTime").value)&&(o.cursor=t.last,T(Math.max(t.first,t.last-300)),l("#rangeStart").value=L(new Date(t.first*1e3)),l("#rangeEnd").value=L(new Date(t.last*1e3))),(o.cursor===null||o.auto)&&(o.cursor=t.last),F(o.cursor)}catch{l("#replayClock").textContent="History unavailable"}}function $(i="PAUSED"){o.playing=!1,o.lastTick=0,l("#playButton").textContent="▶ Play to latest",l("#playButton").className="",i&&D(i)}function N(i){if(!o.bounds)return;o.auto=!1,o.cursor=O(i),F(o.cursor);const t=Number(l("#trailMinutes").value)*60,e=o.playing&&o.playbackStart!==null?o.playbackStart:Math.max(o.bounds.first,o.cursor-t),s=Math.min(o.cursor-.001,e);R({start:new Date(s*1e3).toISOString(),end:new Date(o.cursor*1e3).toISOString()})}function A(){$(null),o.auto=!0,o.playbackStart=null,D("LIVE"),o.bounds&&(o.cursor=o.bounds.last,F(o.cursor)),R({hours:Number(l("#trailMinutes").value)/60})}function mt(){$("HISTORY");const i=l("#selectedTime").value;i&&N(new Date(i).getTime()/1e3)}function ft(){if(o.playing){$();return}if(!o.bounds)return;o.auto=!1;const i=new Date(l("#selectedTime").value).getTime()/1e3;o.cursor=O(Number.isFinite(i)?i:o.bounds.first),o.playbackStart=o.cursor,o.playbackEnd=o.bounds.last,o.playing=!0,o.lastTick=performance.now(),D("REPLAY"),l("#playButton").textContent="❚❚ Pause replay",l("#playButton").className="playing",N(o.cursor)}function gt(){if(!o.playing)return;const i=performance.now();if(o.loading){o.lastTick=i;return}const t=Math.min(2,(i-o.lastTick)/1e3);o.lastTick=i,o.cursor=Math.min(o.playbackEnd,o.cursor+t*Number(l("#playSpeed").value)),T(o.cursor),N(o.cursor),o.cursor>=o.playbackEnd&&$("HISTORY")}function vt(){const i=l("#rangeStart").value,t=l("#rangeEnd").value;!i||!t||($("HISTORY"),o.auto=!1,R({start:new Date(i).toISOString(),end:new Date(t).toISOString()}))}l("#liveButton").addEventListener("click",A);l("#jumpButton").addEventListener("click",mt);l("#playButton").addEventListener("click",ft);l("#applyRange").addEventListener("click",vt);l("#stateFilter").addEventListener("change",H);function Y(i){var e,s;C(),o.selectedVehicle=i.dataset.vehicle,o.selectedHotspot=null,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(a=>{a.classList.toggle("selected",a===i)}),document.querySelectorAll("#hotspots [data-hotspot]").forEach(a=>a.classList.remove("selected")),l("#pathLayer").checked=!0,f.focusVehicle(o.selectedVehicle),[...l("#routeVehicle").options].some(a=>a.value===o.selectedVehicle)&&(l("#routeVehicle").value=o.selectedVehicle);const t=(s=(e=o.data)==null?void 0:e.latest)==null?void 0:s.find(a=>a.vehicle_id===o.selectedVehicle);l("#mapFocus").textContent=t?`${o.selectedVehicle} path · x ${t.x.toFixed(1)} · y ${t.y.toFixed(1)} · ${t.speed.toFixed(2)} m/s`:`${o.selectedVehicle} path`,l(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})}l("#summaryRows").addEventListener("click",i=>{const t=i.target.closest("[data-vehicle]");t&&Y(t)});l("#summaryRows").addEventListener("keydown",i=>{if(i.key!=="Enter"&&i.key!==" ")return;const t=i.target.closest("[data-vehicle]");t&&(i.preventDefault(),Y(t))});l("#hotspots").addEventListener("click",i=>{const t=i.target.closest("[data-hotspot]");if(!t)return;C(),o.selectedVehicle=null,l("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(s=>s.classList.remove("selected")),o.selectedHotspot={x:Number(t.dataset.x),y:Number(t.dataset.y),type:t.dataset.type,events:Number(t.dataset.events),first_started:Number(t.dataset.first)||null,last_ended:Number(t.dataset.last)||null},document.querySelectorAll("#hotspots [data-hotspot]").forEach(s=>{s.classList.toggle("selected",s===t)}),f.focusAt(o.selectedHotspot);const e=o.selectedHotspot.first_started?`${new Date(o.selectedHotspot.first_started*1e3).toLocaleString()} → ${new Date((o.selectedHotspot.last_ended||o.selectedHotspot.first_started)*1e3).toLocaleString()}`:"time unavailable";l("#mapFocus").textContent=`${o.selectedHotspot.type} · x ${o.selectedHotspot.x.toFixed(1)} · y ${o.selectedHotspot.y.toFixed(1)} · ${o.selectedHotspot.events} event(s) · ${e}`,l(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})});l("#stuckTimeline").addEventListener("click",i=>{const t=i.target.closest("[data-stuck-time]");t&&(C(),o.selectedVehicle=null,l("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(e=>e.classList.remove("selected")),document.querySelectorAll("#hotspots [data-hotspot]").forEach(e=>e.classList.remove("selected")),o.selectedHotspot={x:Number(t.dataset.x),y:Number(t.dataset.y),type:"Stuck",events:Number(t.dataset.count),first_started:Number(t.dataset.time),last_ended:Number(t.dataset.time)},f.focusAt(o.selectedHotspot),T(Number(t.dataset.time)),l("#mapFocus").textContent=`Stuck at ${new Date(Number(t.dataset.time)*1e3).toLocaleTimeString()} · x ${o.selectedHotspot.x.toFixed(1)} · y ${o.selectedHotspot.y.toFixed(1)} · ${o.selectedHotspot.events} vehicle(s)`,l(".map-panel").scrollIntoView({behavior:"smooth",block:"center"}))});function G(i){var t,e;if(C(),i.dataset.insight==="stuck")o.selectedVehicle=null,l("#pathLayer").checked=!1,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(s=>s.classList.remove("selected")),o.selectedHotspot={x:Number(i.dataset.x),y:Number(i.dataset.y),type:"Stuck",events:Number(i.dataset.events),first_started:Number(i.dataset.first)||null,last_ended:Number(i.dataset.last)||null},f.focusAt(o.selectedHotspot),l("#mapFocus").textContent=`Stuck · x ${o.selectedHotspot.x.toFixed(1)} · y ${o.selectedHotspot.y.toFixed(1)} · ${o.selectedHotspot.events} event(s)`;else{const s=i.dataset.vehicle,a=(e=(t=o.data)==null?void 0:t.analytics)==null?void 0:e.worst_path;o.selectedVehicle=s,o.selectedHotspot=null,l("#pathLayer").checked=!0,document.querySelectorAll("#summaryRows [data-vehicle]").forEach(n=>{n.classList.toggle("selected",n.dataset.vehicle===s)}),document.querySelectorAll("#hotspots [data-hotspot]").forEach(n=>n.classList.remove("selected")),f.focusVehicle(s),l("#mapFocus").textContent=`${s} path · ${i.dataset.insight==="window"?"bad interval":"worst path"}${a?` · ${a.slow_seconds.toFixed(0)} s slow`:""}`}l(".map-panel").scrollIntoView({behavior:"smooth",block:"center"})}l("#analytics").addEventListener("click",i=>{const t=i.target.closest("[data-insight]");t&&G(t)});l("#analytics").addEventListener("keydown",i=>{if(i.key!=="Enter"&&i.key!==" ")return;const t=i.target.closest("[data-insight]");t&&(i.preventDefault(),G(t))});["pathLayer","vehicleLayer","densityLayer","stuckLayer","jamLayer","tagLayer","heatMetric","heatFilter"].forEach(i=>l(`#${i}`).addEventListener("input",H));l("#heatMetric").addEventListener("change",()=>{o.selectedHeat&&(o.selectedHeat.metric=l("#heatMetric").value,_(l("#heatAreaSummary"),o.selectedHeat.value,o.selectedHeat.metric))});l("#trailMinutes").addEventListener("change",()=>o.auto?A():o.cursor!==null&&N(o.cursor));["selectedTime","rangeStart","rangeEnd"].forEach(i=>l(`#${i}`).addEventListener("focus",()=>{o.auto=!1,$("PAUSED")}));l("#timeline").addEventListener("input",i=>{o.auto=!1,$("HISTORY"),o.cursor=Number(i.target.value),T(o.cursor),F(o.cursor),clearTimeout(o.debounce),o.debounce=setTimeout(()=>N(o.cursor),120)});function X(){o.route=null,k.setRoute(null),j(l("#routeResult"),null)}k.onDestination(i=>{l("#routeX").value=i.x.toFixed(2),l("#routeY").value=i.y.toFixed(2),l("#routeStatus").className="route-status",l("#routeStatus").textContent=`Destination selected at x ${i.x.toFixed(2)}, y ${i.y.toFixed(2)}. Generate the suggestion when ready.`});l("#routeVehicle").addEventListener("change",X);l("#routeForm").addEventListener("submit",async i=>{var n;if(i.preventDefault(),o.routeLoading)return;const t=l("#routeVehicle").value,e=Number(l("#routeX").value),s=Number(l("#routeY").value),a=l("#routeStatus");if(!t||!Number.isFinite(e)||!Number.isFinite(s)){a.className="route-status error",a.textContent="Choose a forklift and set both destination coordinates.";return}if(!((n=o.data)!=null&&n.samples)){a.className="route-status error",a.textContent="No recorded traffic is available in this dashboard time range.";return}o.routeLoading=!0,l("#suggestRouteButton").disabled=!0,a.className="route-status loading",a.textContent="Calculating collision-clear alternatives…";try{o.route=await Z({vehicle_id:t,destination:{x:e,y:s},nominal_speed_mps:Number(l("#routeSpeed").value),start:o.data.start,end:o.data.end}),k.setRoute(o.route),j(l("#routeResult"),o.route),a.className="route-status success",a.textContent=`${t}: route ready. Green is the suggested path; dashed gray is the shortest path.`}catch(c){X(),a.className="route-status error",a.textContent=c.message}finally{o.routeLoading=!1,l("#suggestRouteButton").disabled=!1}});async function yt(){z(P);try{const i=await J();await Promise.all([f.load(i),k.load(i)]),H()}catch{await Promise.all([f.load(f.info,"/fallback-map.png"),k.load(k.info,"/fallback-map.png")]),f.draw(P,q()),V(!1,"Map preview · ROS monitor offline")}await U(!0),A()}yt();setInterval(gt,400);let W=0;setInterval(()=>{o.auto&&A(),W+=1,W%5===0&&U()},2e3);
