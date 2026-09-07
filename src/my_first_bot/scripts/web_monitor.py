#!/usr/bin/env python3
# flake8: noqa: E501,W391
"""Serve a small browser dashboard for live and historical warehouse traffic."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import mimetypes
import posixpath
import re
import sqlite3
import struct
import threading
import time
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import rclpy
from rclpy.node import Node
from std_msgs.msg import String
import yaml

from grid_planner import OccupancyGridPlanner
from traffic_common import (
    iso_time,
    motion_state_is_problem,
    open_database,
    parse_time,
    track_paths,
)


HTML = r"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Warehouse intelligence</title><style>
:root{color-scheme:dark;--bg:#08111d;--panel:#101d2b;--panel2:#142538;--line:#243a50;--text:#edf5fb;--muted:#8fa5b8;--teal:#25d0ae;--blue:#3da4ff;--orange:#ffbf47;--red:#ff5263}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -20%,#18334d 0,var(--bg) 44%);color:var(--text);font:14px Inter,ui-sans-serif,system-ui,sans-serif;min-height:100vh}
nav{height:68px;padding:0 24px;background:#0c1826e8;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:20px;position:sticky;top:0;z-index:5;backdrop-filter:blur(12px)}.brand{display:flex;align-items:center;gap:11px}.logo{width:35px;height:35px;border-radius:9px;background:linear-gradient(135deg,var(--teal),#2081e8);display:grid;place-items:center;font-weight:900;color:#071521}.brand b{font-size:17px}.brand small{display:block;color:var(--muted);margin-top:1px}.connection{display:flex;align-items:center;gap:8px;color:#a9bbca;font-size:12px}.pulse{width:8px;height:8px;border-radius:50%;background:var(--teal);box-shadow:0 0 0 5px #25d0ae1f}.connection.error .pulse{background:var(--red);box-shadow:0 0 0 5px #ff52631f}
.toolbar{margin:0;padding:11px 20px;background:#0c1927f5;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:9px;position:sticky;top:68px;z-index:4;box-shadow:0 8px 22px #0005}.controls{display:flex;align-items:end;gap:9px;flex-wrap:wrap}.field{display:flex;flex-direction:column;gap:4px}.field span{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}input,select,button{height:34px;border:1px solid #34516b;border-radius:7px;background:#071522;color:var(--text);padding:0 10px}button{background:linear-gradient(135deg,#1bb99c,#177fbb);border:0;font-weight:700;cursor:pointer;padding:0 15px}button:hover{filter:brightness(1.12)}button.secondary{background:#1a3045;border:1px solid #34516b}button.playing{background:linear-gradient(135deg,#e79327,#d15455)}.mode{margin-left:auto;align-self:center;padding:5px 10px;border-radius:20px;background:#25d0ae1c;color:#60efd3;border:1px solid #25d0ae55;font-size:11px;font-weight:800;letter-spacing:.08em}.mode.history{background:#3da4ff1a;color:#8bc8ff;border-color:#3da4ff55}.mode.paused{background:#ffbf471a;color:#ffd27a;border-color:#ffbf4755}.mode.replay{background:#b06cff1f;color:#d3aaff;border-color:#b06cff66}.timeline-row{display:grid;grid-template-columns:auto minmax(180px,1fr) auto auto;align-items:center;gap:10px}.timeline-row input{width:100%;height:auto;padding:0}.timeline-row span{color:var(--muted);font-size:10px;white-space:nowrap}.replay-clock{font-size:12px!important;color:#dce9f3!important;font-variant-numeric:tabular-nums}.advanced{position:relative}.advanced summary{height:34px;display:flex;align-items:center;padding:0 10px;border:1px solid #34516b;border-radius:7px;color:#b9c9d6;cursor:pointer;list-style:none}.advanced[open]{background:#122437;border-radius:7px}.advanced-range{position:absolute;right:0;top:40px;width:max-content;padding:10px;background:#122437;border:1px solid #34516b;border-radius:8px;display:flex;gap:8px;align-items:end;box-shadow:0 12px 30px #0008}
main{padding:14px 20px 24px;max-width:1680px;margin:auto}.cards{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:10px;margin-bottom:12px}.card{background:linear-gradient(145deg,#132337,#0e1a28);border:1px solid var(--line);border-radius:10px;padding:12px 14px;min-height:78px}.card b{display:block;font-size:24px;line-height:1.2}.card span{color:var(--muted);font-size:12px}.card.teal b{color:#61edd2}.card.orange b{color:#ffd071}.card.red b{color:#ff7180}
.layout{display:grid;grid-template-columns:minmax(620px,1fr) 300px;gap:12px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:11px;overflow:hidden}.panel-head{min-height:52px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line)}.panel-head h2{font-size:14px;margin:0}.sub{color:var(--muted);font-size:11px}.map-tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.map-tools label{font-size:11px;color:#b8c7d3;display:flex;align-items:center;gap:5px}.map-tools input[type=range]{width:90px;height:auto;padding:0}.map-wrap{position:relative;padding:10px;background:#0b1724}canvas{display:block;width:100%;height:auto;border-radius:7px;background:#dfe6ea}.tooltip{position:absolute;display:none;pointer-events:none;background:#07111aed;border:1px solid #53728e;border-radius:6px;padding:7px 9px;font-size:12px;box-shadow:0 8px 25px #0007;z-index:2}
.map-foot{padding:9px 14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.legend{display:flex;gap:13px;flex-wrap:wrap;color:#b6c5d1;font-size:11px}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px}.range{color:var(--muted);font-size:11px}
.side{display:flex;flex-direction:column;gap:12px}.side .panel{overflow:visible}.list{padding:0 12px;max-height:390px;overflow:auto}.vehicle{display:grid;grid-template-columns:1fr auto;gap:3px;padding:9px 2px;border-bottom:1px solid #203549}.vehicle:last-child{border:0}.vehicle-name{display:flex;align-items:center;gap:7px;font-weight:700}.status-dot{width:7px;height:7px;border-radius:50%;background:var(--teal)}.status-dot.stopped{background:var(--orange)}.speed{color:#6be8d1;font-variant-numeric:tabular-nums}.vehicle small{color:var(--muted)}.badge{font-size:9px;padding:2px 5px;border-radius:4px;background:#243b51;color:#a9bdcd}.hotspots{padding:7px 12px 11px}.hotspot{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid #203549;font-size:12px}.hotspot:last-child{border:0}.hotspot span{color:var(--muted)}.empty{color:var(--muted);padding:14px 2px;font-size:12px}.help{color:var(--muted);font-size:11px;line-height:1.5}
.summary-panel{margin-bottom:12px}.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;padding:10px 12px 12px}.summary-row{display:grid;grid-template-columns:1fr auto;gap:3px 8px;padding:9px 10px;border:1px solid #244057;border-radius:8px;background:#0d1b29}.summary-row strong{font-size:13px}.summary-row .summary-speed{color:#6be8d1;font-variant-numeric:tabular-nums;font-weight:700}.summary-position{grid-column:1/-1;color:var(--muted);font-size:11px}.summary-status{font-size:10px;color:#6be8d1}.summary-status.stopped{color:#ffd071}
@media(max-width:850px){.layout{grid-template-columns:1fr}.side{display:grid;grid-template-columns:1fr 1fr}.list{max-height:300px}.cards{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){nav{padding:0 14px}.toolbar{padding:9px 10px}.controls .field{width:calc(50% - 5px)}.controls input,.controls select{width:100%}.mode{margin-left:0}.timeline-row{grid-template-columns:1fr}.timeline-row span:first-child{display:none}.advanced-range{position:fixed;left:10px;right:10px;top:190px;width:auto;flex-wrap:wrap}.cards{grid-template-columns:1fr 1fr}main{padding:10px}.layout{display:block}.side{display:block}.side .panel{margin-top:10px}.map-tools{display:none}.brand small{display:none}.summary-grid{grid-template-columns:1fr}}
</style></head><body>
<nav><div class="brand"><div class="logo">W</div><div><b>Warehouse Intelligence</b><small>Traffic analytics and vehicle monitoring</small></div></div><div id="connection" class="connection"><i class="pulse"></i><span id="updated">Connecting…</span></div></nav>
<section class="toolbar"><div class="controls"><button class="secondary" onclick="live()">● Live now</button><div class="field"><span>Replay starts at</span><input id="selectedTime" type="datetime-local" step="1"></div><button class="secondary" onclick="jumpToSelected()">Jump to time</button><button id="playButton" onclick="togglePlayback()">▶ Play to latest</button><div class="field"><span>Playback speed</span><select id="playSpeed"><option value="1">1× realtime</option><option value="10">10×</option><option value="60" selected>60×</option><option value="300">300×</option></select></div><div class="field"><span>Heat trail</span><select id="trailMinutes"><option value="1">1 minute</option><option value="5" selected>5 minutes</option><option value="15">15 minutes</option><option value="60">1 hour</option></select></div><details class="advanced"><summary>Custom range</summary><div class="advanced-range"><div class="field"><span>From</span><input id="rangeStart" type="datetime-local" step="1"></div><div class="field"><span>To</span><input id="rangeEnd" type="datetime-local" step="1"></div><button onclick="loadHistory()">Apply</button></div></details><span id="mode" class="mode">LIVE</span></div><div class="timeline-row"><span id="firstLog">First log —</span><input id="timeline" type="range" min="0" max="1" value="1" step="0.5"><span id="replayClock" class="replay-clock">Loading history…</span><span id="lastLog">Latest log —</span></div></section>
<main><div class="cards"><div class="card"><b id="sampleCount">—</b><span>Position samples</span></div><div class="card teal"><b id="vehicleCount">—</b><span>Active vehicles</span></div><div class="card teal"><b id="movingCount">—</b><span>Moving now</span></div><div class="card orange"><b id="stuckCount">—</b><span>Stuck hotspots</span></div><div class="card red"><b id="jamCount">—</b><span>Congestion hotspots</span></div></div>
<section class="summary-panel panel"><div class="panel-head"><div><h2>Vehicle summary</h2><span class="sub">Current name, position, speed, and movement state</span></div><span class="badge">MAP FRAME</span></div><div id="summaryRows" class="summary-grid"><div class="empty">Waiting for vehicle data…</div></div></section>
<div class="layout"><section class="panel"><div class="panel-head"><div><h2>Warehouse positions and traffic</h2><span class="sub">Colored lines are recent vehicle paths · labeled dots are exact positions</span></div><div class="map-tools"><label><input id="pathLayer" type="checkbox" checked onchange="redraw()"> Paths</label><label><input id="vehicleLayer" type="checkbox" checked onchange="redraw()"> Positions</label><label><input id="densityLayer" type="checkbox" checked onchange="redraw()"> Heat</label><label><input id="stuckLayer" type="checkbox" onchange="redraw()"> Stuck</label><label><input id="jamLayer" type="checkbox" onchange="redraw()"> Congestion</label><label>Less heat <input id="heatFilter" type="range" min="0" max="95" value="78" oninput="redraw()"></label></div></div><div class="map-wrap"><canvas id="map" width="1200" height="720"></canvas><div id="tip" class="tooltip"></div></div><div class="map-foot"><div class="legend"><span><i class="dot" style="background:#8d6bff"></i>vehicle path</span><span><i class="dot" style="background:#3da4ff"></i>low traffic</span><span><i class="dot" style="background:#ff6856"></i>high traffic</span><span><i class="dot" style="background:#ffbf47"></i>stuck</span><span><i class="dot" style="background:#ff5263"></i>congestion</span><span><i class="dot" style="background:#25d0ae"></i>position</span></div><div id="range" class="range">Loading…</div></div></section>
<aside class="side"><section class="panel"><div class="panel-head"><div><h2>Vehicle snapshot</h2><span class="sub">Positions at the end of this range</span></div></div><div id="vehicles" class="list"><div class="empty">Waiting for vehicle data…</div></div></section><section class="panel"><div class="panel-head"><div><h2>Top hotspots</h2><span class="sub">Highest event counts in this range</span></div></div><div id="hotspots" class="hotspots"><div class="empty">No hotspots found.</div></div></section></aside></div></main>
<script>
const C=document.getElementById('map'),ctx=C.getContext('2d'),tip=document.getElementById('tip');
let mapInfo={origin:[-20,-12],resolution:.5,width:80,height:48},mapImage=null,mapReady=false;
let data=null,auto=true,hits=[],loading=false,historyBounds=null,cursor=null,playing=false,playbackEnd=null,lastPlaybackTick=0,timelineDebounce=null;
function mapWidth(){return mapInfo.width*mapInfo.resolution}function mapHeight(){return mapInfo.height*mapInfo.resolution}function px(x){return(x-mapInfo.origin[0])/mapWidth()*C.width}function py(y){return(mapInfo.origin[1]+mapHeight()-y)/mapHeight()*C.height}function checked(id){return document.getElementById(id).checked}function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function setMode(value){const element=document.getElementById('mode');element.textContent=value;element.className='mode '+(value==='HISTORY'?'history':value==='PAUSED'?'paused':value==='REPLAY'?'replay':'')}
function circle(x,y,r,color,label,stroke){ctx.fillStyle=color;ctx.beginPath();ctx.arc(px(x),py(y),r,0,Math.PI*2);ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}hits.push({x:px(x),y:py(y),r:Math.max(r,10),label})}
function drawGrid(){ctx.fillStyle='#e5eaed';ctx.fillRect(0,0,C.width,C.height);if(mapReady)ctx.drawImage(mapImage,0,0,C.width,C.height);ctx.fillStyle='#ffffff18';ctx.fillRect(0,0,C.width,C.height);ctx.strokeStyle='#aebbc4aa';ctx.lineWidth=1;ctx.font='10px system-ui';ctx.fillStyle='#61717b';const step=mapWidth()>35?5:4;const x0=Math.ceil(mapInfo.origin[0]/step)*step,x1=mapInfo.origin[0]+mapWidth();for(let x=x0;x<=x1;x+=step){ctx.beginPath();ctx.moveTo(px(x),0);ctx.lineTo(px(x),C.height);ctx.stroke();ctx.fillText(x.toFixed(0)+' m',px(x)+4,C.height-8)}const y0=Math.ceil(mapInfo.origin[1]/step)*step,y1=mapInfo.origin[1]+mapHeight();for(let y=y0;y<=y1;y+=step){ctx.beginPath();ctx.moveTo(0,py(y));ctx.lineTo(C.width,py(y));ctx.stroke();ctx.fillText(y.toFixed(0)+' m',6,py(y)-4)}ctx.strokeStyle='#43596a';ctx.lineWidth=8;ctx.strokeRect(4,4,C.width-8,C.height-8)}
function drawHeat(d){if(!checked('densityLayer')||!d.density.length)return;const counts=d.density.map(v=>v.count).sort((a,b)=>a-b),filter=Number(document.getElementById('heatFilter').value)/100,min=counts[Math.floor((counts.length-1)*filter)]||0,cap=Math.max(min+1,counts[Math.floor((counts.length-1)*.95)]||1),low=Math.log1p(min),span=Math.max(.001,Math.log1p(cap)-low);d.density.forEach(v=>{if(v.count<min)return;const a=Math.max(0,Math.min(1,(Math.log1p(v.count)-low)/span)),r=10+11*a,g=ctx.createRadialGradient(px(v.x),py(v.y),0,px(v.x),py(v.y),r),hue=Math.round(210*(1-a));g.addColorStop(0,`hsla(${hue},90%,53%,${.14+.34*a})`);g.addColorStop(1,`hsla(${hue},90%,53%,0)`);ctx.fillStyle=g;ctx.beginPath();ctx.arc(px(v.x),py(v.y),r,0,Math.PI*2);ctx.fill()})}
function trackColor(id){const colors=['#8d6bff','#00a7d8','#ef7d50','#21a47b','#d45fc0','#789637','#d99924','#4a75dc','#d35c69'];let value=0;for(const char of id)value=(value*31+char.charCodeAt(0))>>>0;return colors[value%colors.length]}function drawPaths(d){if(!checked('pathLayer'))return;(d.tracks||[]).forEach(track=>{if(track.points.length<2)return;ctx.strokeStyle=trackColor(track.vehicle_id);ctx.lineWidth=2.5;ctx.globalAlpha=.72;ctx.beginPath();let previous=null;track.points.forEach(point=>{const separated=previous&&(Math.hypot(point[0]-previous[0],point[1]-previous[1])>2.5||point[2]-previous[2]>5);if(!previous||separated)ctx.moveTo(px(point[0]),py(point[1]));else ctx.lineTo(px(point[0]),py(point[1]));previous=point});ctx.stroke();ctx.globalAlpha=1})}
function drawVehicle(v){const x=px(v.x),y=py(v.y),stopped=v.speed<.05,color=v.vehicle_id==='my_robot'?'#ffffff':stopped?'#ffbf47':'#25d0ae';ctx.shadowColor='#07111a';ctx.shadowBlur=7;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#132638';ctx.lineWidth=2;ctx.stroke();const label=v.vehicle_id.replace('vehicle_','V');ctx.font='bold 10px system-ui';const width=ctx.measureText(label).width+8;ctx.fillStyle='#0b1825d9';ctx.fillRect(x-width/2,y-25,width,14);ctx.fillStyle='#f2f7fa';ctx.textAlign='center';ctx.fillText(label,x,y-15);ctx.textAlign='start';hits.push({x,y,r:11,label:`${v.vehicle_id} · ${v.speed.toFixed(2)} m/s · x ${v.x.toFixed(2)}, y ${v.y.toFixed(2)}`})}
function draw(d){data=d;hits=[];ctx.clearRect(0,0,C.width,C.height);drawGrid();drawHeat(d);drawPaths(d);if(checked('stuckLayer'))d.stuck.slice(0,10).forEach(v=>circle(v.x,v.y,7+Math.min(9,Math.log2(v.events+1)*2),'#ffbf47cc',`${v.events} stuck event(s) · ${Math.round(v.duration)} seconds`,'#fff0bd'));if(checked('jamLayer'))d.congestion.slice(0,10).forEach(v=>circle(v.x,v.y,9+Math.min(13,v.max_vehicles*2),'#ff5263b8',`${v.events} congestion event(s) · up to ${v.max_vehicles} vehicles`,'#ff9ba5'));if(checked('vehicleLayer'))d.latest.forEach(drawVehicle);renderSummary(d)}
function renderSummary(d){const moving=d.latest.filter(v=>v.speed>=.05).length;document.getElementById('sampleCount').textContent=d.samples.toLocaleString();document.getElementById('vehicleCount').textContent=d.latest.length;document.getElementById('movingCount').textContent=moving;document.getElementById('stuckCount').textContent=d.stuck.length;document.getElementById('jamCount').textContent=d.congestion.length;document.getElementById('range').textContent=`${new Date(d.start).toLocaleString()} — ${new Date(d.end).toLocaleString()}`;
document.getElementById('vehicles').innerHTML=d.latest.length?d.latest.map(v=>`<div class="vehicle"><div class="vehicle-name"><i class="status-dot ${v.speed<.05?'stopped':''}"></i>${escapeHtml(v.vehicle_id)} ${v.vehicle_id==='my_robot'?'<span class="badge">AMCL</span>':''}</div><span class="speed">${v.speed.toFixed(2)} m/s</span><small>x ${v.x.toFixed(2)} · y ${v.y.toFixed(2)}</small><small>${v.speed<.05?'Stopped':'Moving'}</small></div>`).join(''):'<div class="empty">No fresh vehicle positions at the end of this range.</div>';
document.getElementById('summaryRows').innerHTML=d.latest.length?d.latest.map(v=>{const stopped=v.speed<.05;return `<div class="summary-row"><strong>${escapeHtml(v.vehicle_id)} ${v.vehicle_id==='my_robot'?'<span class="badge">AMR</span>':''}</strong><span class="summary-speed">${v.speed.toFixed(2)} m/s</span><span class="summary-position">Position: x ${v.x.toFixed(2)} m · y ${v.y.toFixed(2)} m</span><span class="summary-status ${stopped?'stopped':''}">${stopped?'● Stopped':'● Moving'}</span></div>`}).join(''):'<div class="empty">No fresh vehicle positions at the end of this range.</div>';
const events=[...d.congestion.map(v=>({type:'Congestion',x:v.x,y:v.y,count:v.events,color:'var(--red)'})),...d.stuck.map(v=>({type:'Stuck',x:v.x,y:v.y,count:v.events,color:'var(--orange)'}))].sort((a,b)=>b.count-a.count).slice(0,5);document.getElementById('hotspots').innerHTML=events.length?events.map(v=>`<div class="hotspot"><div><b style="color:${v.color}">${v.type}</b><br><span>x ${v.x.toFixed(1)} · y ${v.y.toFixed(1)}</span></div><b>${v.count}×</b></div>`).join(''):'<div class="empty">No stuck or congestion events in this range.</div>'}
function redraw(){if(data)draw(data)}async function load(url){if(loading)return;loading=true;try{const response=await fetch(url,{cache:'no-store'}),value=await response.json();if(!response.ok)throw new Error(value.error||response.statusText);draw(value);document.getElementById('connection').className='connection';document.getElementById('updated').textContent='Updated '+new Date().toLocaleTimeString()}catch(error){document.getElementById('connection').className='connection error';document.getElementById('updated').textContent='Monitor offline · '+error.message}finally{loading=false}}
function localInput(date){const d=new Date(date.getTime()-date.getTimezoneOffset()*60000);return d.toISOString().slice(0,19)}function clampToHistory(value){if(!historyBounds)return value;return Math.max(historyBounds.first,Math.min(historyBounds.last,value))}function setSelectedInput(epoch){document.getElementById('selectedTime').value=localInput(new Date(epoch*1000))}
function updateReplayUI(epoch){if(epoch===null)return;document.getElementById('timeline').value=epoch;document.getElementById('replayClock').textContent=new Date(epoch*1000).toLocaleString()}
async function refreshBounds(initial=false){try{const response=await fetch('/api/bounds',{cache:'no-store'}),bounds=await response.json();if(!response.ok)throw new Error(bounds.error||response.statusText);if(bounds.empty){document.getElementById('replayClock').textContent='No recorded history';return}historyBounds=bounds;const timeline=document.getElementById('timeline'),selected=document.getElementById('selectedTime');timeline.min=bounds.first;timeline.max=bounds.last;selected.min=localInput(new Date(bounds.first*1000));selected.max=localInput(new Date(bounds.last*1000));document.getElementById('firstLog').textContent='First '+new Date(bounds.first*1000).toLocaleString();document.getElementById('lastLog').textContent='Latest '+new Date(bounds.last*1000).toLocaleString();if(initial){cursor=bounds.last;setSelectedInput(Math.max(bounds.first,bounds.last-300));document.getElementById('rangeStart').value=localInput(new Date(bounds.first*1000));document.getElementById('rangeEnd').value=localInput(new Date(bounds.last*1000))}if(cursor===null||auto)cursor=bounds.last;updateReplayUI(cursor)}catch(error){document.getElementById('replayClock').textContent='History unavailable'} }
function selectedEpoch(){const value=document.getElementById('selectedTime').value;return value?new Date(value).getTime()/1000:null}function pausePlayback(mode='PAUSED'){playing=false;lastPlaybackTick=0;const button=document.getElementById('playButton');button.textContent='▶ Play to latest';button.className='';if(mode)setMode(mode)}
function loadFrame(at){if(!historyBounds)return;auto=false;cursor=clampToHistory(at);updateReplayUI(cursor);const trail=Number(document.getElementById('trailMinutes').value)*60,start=Math.min(cursor-.001,Math.max(historyBounds.first,cursor-trail)),end=cursor;load('/api/state?start='+encodeURIComponent(new Date(start*1000).toISOString())+'&end='+encodeURIComponent(new Date(end*1000).toISOString()))}
function jumpToSelected(){pausePlayback('HISTORY');const selected=selectedEpoch();if(selected===null)return;cursor=clampToHistory(selected);setSelectedInput(cursor);loadFrame(cursor)}function togglePlayback(){if(playing){pausePlayback();return}const selected=selectedEpoch();if(selected===null||!historyBounds)return;auto=false;cursor=clampToHistory(selected);playbackEnd=historyBounds.last;setSelectedInput(cursor);playing=true;lastPlaybackTick=performance.now();setMode('REPLAY');const button=document.getElementById('playButton');button.textContent='❚❚ Pause replay';button.className='playing';loadFrame(cursor)}
function playbackStep(){if(!playing)return;const now=performance.now();if(loading){lastPlaybackTick=now;return}const elapsed=Math.min(2,(now-lastPlaybackTick)/1000),speed=Number(document.getElementById('playSpeed').value);lastPlaybackTick=now;cursor=Math.min(playbackEnd,cursor+elapsed*speed);loadFrame(cursor);if(cursor>=playbackEnd)pausePlayback('HISTORY')}
function live(){pausePlayback(null);auto=true;setMode('LIVE');if(historyBounds){cursor=historyBounds.last;updateReplayUI(cursor)}const hours=Number(document.getElementById('trailMinutes').value)/60;load('/api/state?hours='+hours)}function loadHistory(){const s=document.getElementById('rangeStart').value,e=document.getElementById('rangeEnd').value;if(!s||!e)return;pausePlayback('HISTORY');auto=false;load('/api/state?start='+encodeURIComponent(new Date(s).toISOString())+'&end='+encodeURIComponent(new Date(e).toISOString()))}
['selectedTime','rangeStart','rangeEnd'].forEach(id=>document.getElementById(id).addEventListener('focus',()=>{auto=false;pausePlayback('PAUSED')}));document.getElementById('timeline').addEventListener('input',event=>{auto=false;pausePlayback('HISTORY');cursor=Number(event.target.value);setSelectedInput(cursor);updateReplayUI(cursor);clearTimeout(timelineDebounce);timelineDebounce=setTimeout(()=>loadFrame(cursor),120)});document.getElementById('trailMinutes').addEventListener('change',()=>auto?live():cursor!==null&&loadFrame(cursor));C.addEventListener('mousemove',event=>{const box=C.getBoundingClientRect(),x=(event.clientX-box.left)*C.width/box.width,y=(event.clientY-box.top)*C.height/box.height,hit=hits.slice().reverse().find(h=>Math.hypot(h.x-x,h.y-y)<=h.r);if(!hit){tip.style.display='none';return}tip.textContent=hit.label;tip.style.display='block';tip.style.left=(event.clientX-box.left+13)+'px';tip.style.top=(event.clientY-box.top+13)+'px'});C.addEventListener('mouseleave',()=>tip.style.display='none');
async function loadMap(){try{const response=await fetch('/api/map',{cache:'no-store'}),value=await response.json();if(!response.ok)throw new Error(value.error||response.statusText);mapInfo=value;const image=new Image();image.onload=()=>{mapImage=image;mapReady=true;draw(data||{density:[],tracks:[],stuck:[],congestion:[],latest:[],samples:0,start:new Date().toISOString(),end:new Date().toISOString()})};image.src='/map.png?'+Date.now()}catch(error){console.warn('Map asset unavailable',error)}}
async function boot(){await loadMap();await refreshBounds(true);live()}boot();setInterval(playbackStep,400);let refreshCycle=0;setInterval(()=>{if(auto)live();refreshCycle+=1;if(refreshCycle%5===0)refreshBounds()},2000);
</script></body></html>"""


class MonitorHandler(BaseHTTPRequestHandler):
    monitor = None

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/":
            try:
                content_type, body = self.monitor.static_file("index.html")
                self._send(200, content_type, body)
            except OSError:
                self._send(200, "text/html; charset=utf-8", HTML.encode())
        elif parsed.path == "/api/state":
            try:
                payload = self.monitor.query(parse_qs(parsed.query))
                self._send(200, "application/json", json.dumps(payload).encode())
            except Exception as error:  # Keep the browser connection JSON-safe on unexpected data errors.
                self._send(400, "application/json", json.dumps({"error": str(error)}).encode())
        elif parsed.path == "/api/bounds":
            try:
                self._send(
                    200,
                    "application/json",
                    json.dumps(self.monitor.bounds()).encode(),
                )
            except Exception as error:
                self._send(500, "application/json", json.dumps({"error": str(error)}).encode())
        elif parsed.path == "/api/map":
            try:
                self._send(200, "application/json", json.dumps(self.monitor.map_info).encode())
            except Exception as error:
                self._send(500, "application/json", json.dumps({"error": str(error)}).encode())
        elif parsed.path == "/map.png":
            try:
                content_type, body = self.monitor.map_asset()
                self._send(200, content_type, body)
            except Exception as error:
                self._send(404, "text/plain", str(error).encode())
        elif parsed.path == "/api/health":
            self._send(200, "application/json", b'{"ok":true}')
        elif parsed.path == "/api/debug":
            try:
                payload = self.monitor.debug_snapshot(parse_qs(parsed.query))
                self._send(200, "application/json", json.dumps(payload, indent=2).encode())
            except Exception as error:
                self._send(500, "application/json", json.dumps({"error": str(error)}).encode())
        else:
            try:
                content_type, body = self.monitor.static_file(parsed.path)
                self._send(200, content_type, body)
            except OSError:
                self._send(404, "text/plain", b"not found")

    def do_POST(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path != "/api/routes/suggest":
            self._send(404, "application/json", b'{"error":"not found"}')
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 65536:
                raise ValueError("request body must be between 1 byte and 64 KiB")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            result = self.monitor.suggest_route(payload)
            self._send(200, "application/json", json.dumps(result).encode())
        except (json.JSONDecodeError, TypeError, ValueError) as error:
            self._send(400, "application/json", json.dumps({"error": str(error)}).encode())
        except Exception as error:
            self._send(500, "application/json", json.dumps({"error": str(error)}).encode())

    def _send(self, status, content_type, body):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        return


class WebMonitor(Node):
    """Expose SQLite traffic history as a browser-friendly JSON API."""

    def __init__(self):
        super().__init__("web_monitor")
        self.declare_parameter("database_path", "~/.ros/warehouse_traffic.db")
        self.declare_parameter("web_host", "127.0.0.1")
        self.declare_parameter("web_port", 8080)
        self.declare_parameter("grid_resolution", 0.5)
        self.declare_parameter("event_resolution", 1.5)
        self.declare_parameter("slow_speed", 0.05)
        self.declare_parameter("latest_max_age", 10.0)
        self.declare_parameter("max_track_points", 240)
        self.declare_parameter("max_analysis_samples", 100000)
        self.declare_parameter("map_yaml", "")
        self.declare_parameter("map_image", "")
        self.declare_parameter("uwb_tag_config", "")
        self.declare_parameter("traffic_vehicle_count", 8)
        self.declare_parameter("web_root", "")
        self.declare_parameter("route_planning_resolution", 0.30)
        self.declare_parameter("route_robot_radius", 0.55)
        self.map_info, self._map_content_type, self._map_bytes = self._load_map_asset()
        self.map_info["uwb_tags"] = self._load_uwb_tags()
        self.route_planner = self._load_route_planner()
        configured_root = str(self.get_parameter("web_root").value or "").strip()
        self.web_root = Path(configured_root).expanduser() if configured_root else Path(__file__).resolve().parent.parent / "web" / "dist"
        self.connection = open_database(
            self.get_parameter("database_path").value, check_same_thread=False
        )
        self.lock = threading.Lock()
        self.validation_status = {}
        self.initialization_status = {}
        self.validation_subscriptions = []
        validation_vehicles = ["my_robot"] + [
            f"vehicle_{index}"
            for index in range(
                1, int(self.get_parameter("traffic_vehicle_count").value) + 1
            )
        ]
        for vehicle_name in validation_vehicles:
            self.validation_subscriptions.append(
                self.create_subscription(
                    String,
                    f"/traffic/{vehicle_name}/localization_validation",
                    lambda message, name=vehicle_name: self._on_validation(
                        name, message
                    ),
                    10,
                )
            )
            self.validation_subscriptions.append(
                self.create_subscription(
                    String,
                    f"/traffic/{vehicle_name}/initialization_status",
                    lambda message, name=vehicle_name: self._on_initialization(
                        name, message
                    ),
                    10,
                )
            )
        MonitorHandler.monitor = self
        self.server = ThreadingHTTPServer(
            (
                self.get_parameter("web_host").value,
                int(self.get_parameter("web_port").value),
            ),
            MonitorHandler,
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.get_logger().info(
            f"Web traffic monitor available at http://localhost:{self.get_parameter('web_port').value}"
        )

    def _load_route_planner(self):
        """Load the same occupancy map used by AMCL for advisory routes."""
        map_yaml = str(self.get_parameter("map_yaml").value or "").strip()
        if not map_yaml:
            self.get_logger().warning(
                "Route suggestions disabled because map_yaml is not configured"
            )
            return None
        try:
            return OccupancyGridPlanner.from_yaml(
                map_yaml,
                planning_resolution=float(
                    self.get_parameter("route_planning_resolution").value
                ),
                robot_radius=float(self.get_parameter("route_robot_radius").value),
            )
        except Exception as error:
            self.get_logger().warning(f"Route suggestions disabled: {error}")
            return None

    @staticmethod
    def _image_dimensions(path):
        """Read PNG or Netpbm dimensions without adding an image dependency."""
        with path.open("rb") as stream:
            header = stream.read(32)
            if header.startswith(b"\x89PNG\r\n\x1a\n"):
                return struct.unpack(">II", header[16:24])
            stream.seek(0)
            tokens = []
            while len(tokens) < 3:
                line = stream.readline()
                if not line:
                    break
                line = line.split(b"#", 1)[0]
                tokens.extend(line.split())
            if len(tokens) >= 3 and tokens[0] in (b"P2", b"P5"):
                return int(tokens[1]), int(tokens[2])
        raise ValueError(f"unsupported map image format: {path}")

    def _load_map_asset(self):
        yaml_value = str(self.get_parameter("map_yaml").value or "").strip()
        image_value = str(self.get_parameter("map_image").value or "").strip()
        yaml_path = Path(yaml_value).expanduser() if yaml_value else None
        image_path = Path(image_value).expanduser() if image_value else None
        resolution, origin, yaml_image = 1.0, [0.0, 0.0, 0.0], None
        if yaml_path and yaml_path.is_file():
            text = yaml_path.read_text(encoding="utf-8")
            match = re.search(r"(?m)^\s*image\s*:\s*(.+?)\s*$", text)
            if match:
                yaml_image = match.group(1).strip().strip("'\"")
                candidate = Path(yaml_image).expanduser()
                if not candidate.is_absolute():
                    candidate = yaml_path.parent / candidate
                if image_path is None:
                    png_candidate = candidate.with_suffix(".png")
                    if candidate.suffix.lower() in (".pgm", ".pnm") and png_candidate.is_file():
                        candidate = png_candidate
                    image_path = candidate
            match = re.search(r"(?m)^\s*resolution\s*:\s*([-+0-9.eE]+)", text)
            if match:
                resolution = float(match.group(1))
            match = re.search(r"(?m)^\s*origin\s*:\s*\[([^\]]+)\]", text)
            if match:
                origin = [float(value.strip()) for value in match.group(1).split(",")]
        if image_path is None or not image_path.is_file():
            image_path = Path(__file__).resolve().parent.parent / "maps" / "warehouse.png"
        width, height = self._image_dimensions(image_path)
        content_type = "image/png" if image_path.suffix.lower() == ".png" else "image/x-portable-graymap"
        return (
            {
                "origin": origin,
                "resolution": resolution,
                "width": width,
                "height": height,
                "image": image_path.name,
            },
            content_type,
            image_path.read_bytes(),
        )

    def _load_uwb_tags(self):
        """Expose surveyed UWB references in the same metadata as the map."""
        value = str(self.get_parameter("uwb_tag_config").value or "").strip()
        path = Path(value).expanduser() if value else None
        if path is None or not path.is_file():
            return []
        payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        return [
            {
                "id": str(tag["id"]),
                "x": float(tag["x"]),
                "y": float(tag["y"]),
                "z": float(tag.get("z", 0.0)),
                "enabled": bool(tag.get("enabled", True)),
                "battery_pct": float(tag.get("battery_pct", 100.0)),
            }
            for tag in payload.get("tags", [])
        ]

    def _on_validation(self, vehicle_name, message):
        """Cache the latest live AMCL/UWB diagnostic for the web API."""
        try:
            payload = json.loads(message.data)
        except (TypeError, ValueError):
            return
        payload["received_at"] = time.monotonic()
        with self.lock:
            self.validation_status[vehicle_name] = payload

    def _on_initialization(self, vehicle_name, message):
        """Cache live one-shot UWB/AMCL startup progress for diagnostics."""
        try:
            payload = json.loads(message.data)
        except (TypeError, ValueError):
            return
        payload["received_at"] = time.monotonic()
        with self.lock:
            self.initialization_status[vehicle_name] = payload

    def _validation_snapshot(self):
        """Return fresh diagnostics and summary counts; these are live only."""
        now = time.monotonic()
        with self.lock:
            vehicles = [
                {key: value for key, value in payload.items() if key != "received_at"}
                for payload in self.validation_status.values()
                if now - payload.get("received_at", 0.0) <= 5.0
            ]
        vehicles.sort(key=lambda value: value.get("vehicle_id", ""))
        states = (
            "confirmed",
            "caution",
            "disagreement",
            "uwb_unavailable",
            "waiting_amcl",
            "unsynchronized",
        )
        summary = {
            state: sum(1 for vehicle in vehicles if vehicle.get("state") == state)
            for state in states
        }
        summary["total"] = len(vehicles)
        return {
            "live": True,
            "historical": False,
            "as_of": iso_time(time.time()),
            "summary": summary,
            "vehicles": vehicles,
        }

    @staticmethod
    def _historical_validation(rows):
        """Convert the latest recorded row per vehicle into the web payload."""
        states = (
            "confirmed",
            "caution",
            "disagreement",
            "uwb_unavailable",
            "waiting_amcl",
            "unsynchronized",
        )
        vehicles = [
            {
                "vehicle_id": row[0],
                "state": row[1],
                "raw_state": row[2],
                "authoritative_source": row[3],
                "amcl_x": row[4],
                "amcl_y": row[5],
                "uwb_x": row[6],
                "uwb_y": row[7],
                "error_m": row[8],
                "visible_tag_count": int(row[9]),
                "uwb_residual_m": row[10],
                "measurement_skew_s": row[11],
                "amcl_age_s": row[12],
                "uwb_age_s": row[13],
                "amcl_stamp": row[14],
                "uwb_stamp": row[15],
                "uwb_reason": row[16],
                "observed_at": row[17],
            }
            for row in rows
        ]
        summary = {
            state: sum(1 for vehicle in vehicles if vehicle["state"] == state)
            for state in states
        }
        summary["total"] = len(vehicles)
        latest_time = max((vehicle["observed_at"] for vehicle in vehicles), default=None)
        return {
            "live": False,
            "historical": True,
            "as_of": iso_time(latest_time) if latest_time is not None else None,
            "summary": summary,
            "vehicles": vehicles,
        }

    def _initialization_snapshot(self):
        now = time.monotonic()
        with self.lock:
            vehicles = [
                {key: value for key, value in payload.items() if key != "received_at"}
                for payload in self.initialization_status.values()
                if now - payload.get("received_at", 0.0) <= 5.0
            ]
        vehicles.sort(key=lambda value: value.get("vehicle_id", ""))
        return {
            "live": True,
            "summary": {
                "total": len(vehicles),
                "ready": sum(
                    1 for vehicle in vehicles
                    if vehicle.get("drive_allowed") is True
                ),
                "interlocked": sum(
                    1 for vehicle in vehicles
                    if vehicle.get("drive_allowed") is not True
                ),
            },
            "vehicles": vehicles,
        }

    def map_asset(self):
        return self._map_content_type, self._map_bytes

    def static_file(self, request_path):
        """Return a built Vite asset while preventing path traversal."""
        relative = unquote(request_path).lstrip("/")
        relative = posixpath.normpath(relative)
        if relative in ("", "."):
            relative = "index.html"
        if relative == ".." or relative.startswith("../"):
            raise OSError("invalid asset path")
        path = (self.web_root / relative).resolve()
        try:
            path.relative_to(self.web_root.resolve())
        except ValueError as error:
            raise OSError("invalid asset path") from error
        if not path.is_file():
            raise OSError(f"asset not found: {relative}")
        content_type, _ = mimetypes.guess_type(str(path))
        if path.suffix == ".js":
            content_type = "application/javascript"
        return content_type or "application/octet-stream", path.read_bytes()

    @staticmethod
    def _aggregate_events(rows, start, end, resolution, congestion=False):
        """Merge repeated database events into spatial historical hotspots."""
        cells = {}
        for row in rows:
            x, y = float(row[1]), float(row[2])
            key = (math.floor(x / resolution), math.floor(y / resolution))
            cell = cells.setdefault(
                key,
                {
                    "x_sum": 0.0,
                    "y_sum": 0.0,
                    "events": 0,
                    "duration": 0.0,
                    "vehicles": set(),
                    "max_vehicles": 0,
                    "vehicle_events": {},
                    "first_started": None,
                    "last_ended": None,
                },
            )
            cell["x_sum"] += x
            cell["y_sum"] += y
            cell["events"] += 1
            if congestion:
                cell["vehicles"].update(row[0].split(","))
                cell["max_vehicles"] = max(cell["max_vehicles"], int(row[3]))
                started_at, ended_at = float(row[4]), float(row[5])
            else:
                cell["vehicles"].add(row[0])
                started_at, ended_at = float(row[3]), float(row[4])
            cell["vehicle_events"][row[0]] = cell["vehicle_events"].get(row[0], 0) + 1
            cell["first_started"] = started_at if cell["first_started"] is None else min(cell["first_started"], started_at)
            cell["last_ended"] = ended_at if cell["last_ended"] is None else max(cell["last_ended"], ended_at)
            cell["duration"] += max(
                0.0, min(ended_at, end) - max(started_at, start)
            )

        hotspots = []
        for cell in cells.values():
            events = cell["events"]
            hotspot = {
                "x": cell["x_sum"] / events,
                "y": cell["y_sum"] / events,
                "events": events,
                "duration": cell["duration"],
                "vehicles": len(cell["vehicles"]),
                "first_started": max(start, cell["first_started"]),
                "last_ended": min(end, cell["last_ended"]),
                "vehicle_id": max(cell["vehicle_events"], key=cell["vehicle_events"].get),
            }
            if congestion:
                hotspot["max_vehicles"] = cell["max_vehicles"]
            hotspots.append(hotspot)
        return sorted(hotspots, key=lambda item: item["events"], reverse=True)

    @staticmethod
    def _stuck_timeline(rows, start, end, resolution, maximum_buckets=120):
        """Find the busiest stuck location in each readable time bucket."""
        duration = max(1.0, end - start)
        bucket_options = (60, 300, 900, 3600, 21600, 86400)
        bucket_seconds = next(
            (
                size
                for size in bucket_options
                if math.ceil(duration / size) <= maximum_buckets
            ),
            bucket_options[-1],
        )
        buckets = {}
        for vehicle_id, x, y, started_at, ended_at in rows:
            event_start = max(start, float(started_at))
            event_end = min(end, float(ended_at))
            if event_end < event_start:
                continue
            first_bucket = math.floor(event_start / bucket_seconds) * bucket_seconds
            last_bucket = math.floor(
                max(event_start, event_end - 1.0e-6) / bucket_seconds
            ) * bucket_seconds
            bucket_start = first_bucket
            while bucket_start <= last_bucket:
                cell_key = (
                    math.floor(float(x) / resolution),
                    math.floor(float(y) / resolution),
                )
                bucket = buckets.setdefault(
                    bucket_start,
                    {"vehicles": set(), "events": 0, "cells": {}},
                )
                bucket["vehicles"].add(vehicle_id)
                bucket["events"] += 1
                cell = bucket["cells"].setdefault(
                    cell_key,
                    {
                        "x_sum": 0.0,
                        "y_sum": 0.0,
                        "events": 0,
                        "vehicles": set(),
                    },
                )
                cell["x_sum"] += float(x)
                cell["y_sum"] += float(y)
                cell["events"] += 1
                cell["vehicles"].add(vehicle_id)
                bucket_start += bucket_seconds

        timeline = []
        for bucket_start, bucket in sorted(buckets.items()):
            hotspot = max(
                bucket["cells"].values(),
                key=lambda cell: (len(cell["vehicles"]), cell["events"]),
            )
            timeline.append(
                {
                    "start": max(start, bucket_start),
                    "end": min(end, bucket_start + bucket_seconds),
                    "total_vehicles": len(bucket["vehicles"]),
                    "total_events": bucket["events"],
                    "hotspot": {
                        "x": hotspot["x_sum"] / hotspot["events"],
                        "y": hotspot["y_sum"] / hotspot["events"],
                        "vehicles": len(hotspot["vehicles"]),
                        "events": hotspot["events"],
                        "vehicle_ids": sorted(hotspot["vehicles"]),
                    },
                }
            )
        return {"bucket_seconds": bucket_seconds, "buckets": timeline}

    @staticmethod
    def _heat_bucket_seconds(start, end, maximum_buckets=24):
        """Choose readable time buckets for per-cell heatmap hover details."""
        duration = max(1.0, end - start)
        options = (60, 300, 900, 3600, 21600, 86400)
        return next(
            (
                size
                for size in options
                if math.ceil(duration / size) <= maximum_buckets
            ),
            options[-1],
        )

    @staticmethod
    def _density_time_details(
        rows, stuck_rows, start, end, resolution, bucket_seconds
    ):
        """Keep metric-specific peak times and stuck history for each heat cell."""
        cells = {}
        for row in rows:
            cell_key = (int(row[0]), int(row[1]))
            bucket_start = max(start, int(row[2]) * bucket_seconds)
            bucket_end = min(end, (int(row[2]) + 1) * bucket_seconds)
            vehicle_ids = sorted(
                vehicle_id for vehicle_id in str(row[7] or "").split(",")
                if vehicle_id
            )
            value = {
                "start": bucket_start,
                "end": bucket_end,
                "count": int(row[3]),
                "vehicles": int(row[4]),
                "average_speed": float(row[5] or 0.0),
                "slow_samples": int(row[6] or 0),
                "vehicle_ids": vehicle_ids,
            }
            cell = cells.setdefault(
                cell_key,
                {
                    "bucket_seconds": bucket_seconds,
                    "peaks": {},
                    "stuck": {
                        "events": 0,
                        "vehicles": set(),
                        "buckets": {},
                    },
                },
            )
            for metric in ("count", "vehicles", "slow_samples"):
                previous = cell["peaks"].get(metric)
                # Prefer the latest bucket when two intervals have equal
                # values so a live hover reports the most recent peak.
                score = (value[metric], value["count"], value["start"])
                previous_score = (
                    previous[metric], previous["count"], previous["start"]
                ) if previous else None
                if previous_score is None or score > previous_score:
                    cell["peaks"][metric] = value.copy()

        for vehicle_id, x, y, started_at, ended_at in stuck_rows:
            cell_key = (
                math.floor(float(x) / resolution),
                math.floor(float(y) / resolution),
            )
            if cell_key not in cells:
                continue
            event_start = max(start, float(started_at))
            event_end = min(end, float(ended_at))
            if event_end < event_start:
                continue
            stuck = cells[cell_key]["stuck"]
            stuck["events"] += 1
            stuck["vehicles"].add(vehicle_id)
            first_bucket = math.floor(event_start / bucket_seconds) * bucket_seconds
            last_bucket = math.floor(
                max(event_start, event_end - 1.0e-6) / bucket_seconds
            ) * bucket_seconds
            bucket_start = first_bucket
            while bucket_start <= last_bucket:
                bucket = stuck["buckets"].setdefault(
                    bucket_start, {"events": 0, "vehicles": set()}
                )
                bucket["events"] += 1
                bucket["vehicles"].add(vehicle_id)
                bucket_start += bucket_seconds

        for cell in cells.values():
            stuck = cell["stuck"]
            peak = None
            if stuck["buckets"]:
                peak_start, peak_value = max(
                    stuck["buckets"].items(),
                    key=lambda item: (
                        len(item[1]["vehicles"]),
                        item[1]["events"],
                        item[0],
                    ),
                )
                peak = {
                    "start": max(start, peak_start),
                    "end": min(end, peak_start + bucket_seconds),
                    "vehicles": len(peak_value["vehicles"]),
                    "events": peak_value["events"],
                    "vehicle_ids": sorted(peak_value["vehicles"]),
                }
            cell["stuck"] = {
                "events": stuck["events"],
                "vehicles": len(stuck["vehicles"]),
                "vehicle_ids": sorted(stuck["vehicles"]),
                "peak": peak,
            }
        return cells

    def _path_analytics(self, samples, stuck_rows, start, end):
        """Summarize path quality and identify the vehicle with the worst history."""
        slow_speed = float(self.get_parameter("slow_speed").value)
        stats = {}
        for row in samples:
            vehicle_id, x, y, speed, observed_at = row[:5]
            motion_state = row[5] if len(row) > 5 else "unknown"
            problem_sample = motion_state_is_problem(
                motion_state, speed, slow_speed
            )
            item = stats.setdefault(vehicle_id, {
                "vehicle_id": vehicle_id, "distance_m": 0.0, "duration_s": 0.0,
                "slow_seconds": 0.0, "samples": 0, "speed_sum": 0.0,
                "last": None, "bad_start": None, "bad_end": None,
            })
            observed_at, speed = float(observed_at), float(speed)
            if item["last"] is not None:
                previous_x, previous_y, previous_at = item["last"]
                delta = max(0.0, min(10.0, observed_at - previous_at))
                item["duration_s"] += delta
                item["distance_m"] += math.hypot(float(x) - previous_x, float(y) - previous_y)
                if problem_sample:
                    item["slow_seconds"] += delta
            if problem_sample:
                if item["bad_start"] is None:
                    item["bad_start"] = observed_at
                item["bad_end"] = observed_at
            item["last"] = (float(x), float(y), observed_at)
            item["samples"] += 1
            item["speed_sum"] += speed
        stuck_by_vehicle = {}
        for row in stuck_rows:
            vehicle_id = row[0]
            started_at, ended_at = float(row[3]), float(row[4])
            value = stuck_by_vehicle.setdefault(vehicle_id, {"events": 0, "duration_s": 0.0, "first_started": started_at, "last_ended": ended_at})
            value["events"] += 1
            value["duration_s"] += max(0.0, min(ended_at, end) - max(started_at, start))
            value["first_started"] = min(value["first_started"], started_at)
            value["last_ended"] = max(value["last_ended"], ended_at)
        for vehicle_id, item in stats.items():
            stuck = stuck_by_vehicle.get(vehicle_id, {})
            item["stuck_events"] = stuck.get("events", 0)
            item["stuck_seconds"] = stuck.get("duration_s", 0.0)
            item["average_speed"] = item["speed_sum"] / max(1, item["samples"])
            item["bad_when_start"] = max(start, stuck["first_started"]) if stuck else item["bad_start"]
            item["bad_when_end"] = min(end, stuck["last_ended"]) if stuck else item["bad_end"]
            item["bad_score"] = item["stuck_seconds"] * 3.0 + item["slow_seconds"]
        ranked = sorted(stats.values(), key=lambda value: (value["bad_score"], -value["average_speed"]), reverse=True)
        fields = ("vehicle_id", "distance_m", "duration_s", "slow_seconds", "samples", "average_speed", "stuck_events", "stuck_seconds", "bad_when_start", "bad_when_end")
        vehicle_stats = [{key: item[key] for key in fields} for item in ranked]
        if not vehicle_stats or ranked[0]["bad_score"] <= 0.0:
            return {"vehicle_stats": [], "worst_path": None}
        worst = vehicle_stats[0].copy()
        worst["reason"] = f"{worst['stuck_events']} stuck event(s)" if worst["stuck_events"] else ("most slow-driving time" if worst["slow_seconds"] else "lowest average speed")
        return {"vehicle_stats": vehicle_stats, "worst_path": worst}

    @staticmethod
    def _route_distance(points):
        """Return the length in metres of a world-coordinate polyline."""
        return sum(
            math.hypot(second[0] - first[0], second[1] - first[1])
            for first, second in zip(points, points[1:])
        )

    @staticmethod
    def _add_route_penalty(penalties, center, value, radius=0):
        """Spread a traffic cost around a planner cell with linear falloff."""
        for offset_x in range(-radius, radius + 1):
            for offset_y in range(-radius, radius + 1):
                distance = math.hypot(offset_x, offset_y)
                if distance > radius:
                    continue
                cell = (center[0] + offset_x, center[1] + offset_y)
                falloff = 1.0 if radius == 0 else max(0.2, 1.0 - distance / (radius + 1.0))
                penalties[cell] = penalties.get(cell, 0.0) + value * falloff

    def _route_penalties(self, history, selected_vehicle):
        """Convert dashboard history into traversable A* traffic costs."""
        planner = self.route_planner
        density = history.get("density", [])
        max_count = max((item["count"] for item in density), default=1)
        max_vehicles = max((item["vehicles"] for item in density), default=1)
        max_slow = max((item["slow_samples"] for item in density), default=1)
        penalties = {}

        for item in density:
            occupancy = item["count"] / max_count
            vehicle_mix = item["vehicles"] / max_vehicles
            slow = item["slow_samples"] / max_slow
            value = 1.2 * occupancy + 0.8 * vehicle_mix + 4.0 * slow
            self._add_route_penalty(
                penalties,
                planner.world_to_cell(item["x"], item["y"]),
                value,
                radius=1,
            )

        event_radius = max(1, math.ceil(1.0 / planner.resolution))
        for item in history.get("stuck", []):
            value = 5.0 + min(5.0, math.log1p(item["events"]) * 2.0)
            self._add_route_penalty(
                penalties,
                planner.world_to_cell(item["x"], item["y"]),
                value,
                event_radius,
            )
        for item in history.get("congestion", []):
            value = 6.0 + min(6.0, float(item.get("max_vehicles", 1)))
            self._add_route_penalty(
                penalties,
                planner.world_to_cell(item["x"], item["y"]),
                value,
                event_radius,
            )

        # Other forklifts are temporary risks, not permanent obstacles. This
        # lets the suggestion use a narrow aisle if it is the only valid path.
        vehicle_radius = max(1, math.ceil(1.2 / planner.resolution))
        for vehicle in history.get("latest", []):
            if vehicle["vehicle_id"] == selected_vehicle:
                continue
            self._add_route_penalty(
                penalties,
                planner.world_to_cell(vehicle["x"], vehicle["y"]),
                8.0,
                vehicle_radius,
            )
        return {
            cell: value
            for cell, value in penalties.items()
            if cell in planner.free
        }

    @staticmethod
    def _route_exposure(cells, penalties):
        if not cells:
            return 0.0
        return sum(penalties.get(cell, 0.0) for cell in cells) / len(cells)

    def suggest_route(self, payload):
        """Compare the shortest route with a history-aware advisory route."""
        if not isinstance(payload, dict):
            raise ValueError("request body must be a JSON object")
        if self.route_planner is None:
            raise ValueError("route planner is unavailable; configure map_yaml")

        vehicle_id = str(payload.get("vehicle_id", "")).strip()
        destination = payload.get("destination")
        if not vehicle_id:
            raise ValueError("vehicle_id is required")
        if not isinstance(destination, dict):
            raise ValueError("destination with numeric x and y is required")
        try:
            requested_goal = (float(destination["x"]), float(destination["y"]))
            nominal_speed = float(payload.get("nominal_speed_mps", 0.8))
        except (KeyError, TypeError, ValueError) as error:
            raise ValueError("destination x/y and nominal_speed_mps must be numeric") from error
        if not all(math.isfinite(value) for value in requested_goal):
            raise ValueError("destination coordinates must be finite")
        if not 0.1 <= nominal_speed <= 5.0:
            raise ValueError("nominal_speed_mps must be between 0.1 and 5.0")

        now = time.time()
        end = parse_time(str(payload.get("end", "")), now)
        start = parse_time(str(payload.get("start", "")), end - 300.0)
        if start >= end:
            raise ValueError("start must be earlier than end")
        history = self.query({"start": [str(start)], "end": [str(end)]})
        vehicle = next(
            (item for item in history["latest"] if item["vehicle_id"] == vehicle_id),
            None,
        )
        if vehicle is None:
            track = next(
                (item for item in history["tracks"] if item["vehicle_id"] == vehicle_id),
                None,
            )
            if track and track["points"]:
                point = track["points"][-1]
                vehicle = {"vehicle_id": vehicle_id, "x": point[0], "y": point[1]}
        if vehicle is None:
            raise ValueError(f"no position for {vehicle_id} in the selected time range")

        planner = self.route_planner
        start_cell = planner.nearest_free(vehicle["x"], vehicle["y"])
        goal_cell = planner.nearest_free(*requested_goal)
        if start_cell is None:
            raise ValueError("vehicle position is outside the traversable map")
        if goal_cell is None:
            raise ValueError("destination is outside the traversable map")
        if planner.component_for.get(start_cell) != planner.component_for.get(goal_cell):
            raise ValueError("destination is not reachable from this vehicle")

        penalties = self._route_penalties(history, vehicle_id)
        baseline_cells = planner.plan_cells(start_cell, goal_cell)
        suggested_cells = planner.plan_weighted_cells(
            start_cell, goal_cell, penalties
        )
        if not baseline_cells or not suggested_cells:
            raise ValueError("no collision-clear route was found")

        baseline_points = [planner.cell_to_world(cell) for cell in baseline_cells]
        suggested_points = [planner.cell_to_world(cell) for cell in suggested_cells]
        baseline_distance = self._route_distance(baseline_points)
        suggested_distance = self._route_distance(suggested_points)
        baseline_exposure = self._route_exposure(baseline_cells, penalties)
        suggested_exposure = self._route_exposure(suggested_cells, penalties)

        def route_summary(points, distance, exposure):
            risk_score = round(100.0 * (1.0 - math.exp(-exposure / 3.0)), 1)
            delay_factor = 1.0 + min(0.75, exposure * 0.12)
            return {
                "points": [[round(x, 3), round(y, 3)] for x, y in points],
                "distance_m": round(distance, 2),
                "eta_s": round(distance / nominal_speed * delay_factor, 1),
                "risk_score": risk_score,
                "traffic_exposure": round(exposure, 3),
            }

        baseline = route_summary(
            baseline_points, baseline_distance, baseline_exposure
        )
        suggested = route_summary(
            suggested_points, suggested_distance, suggested_exposure
        )
        hotspots = [*history.get("stuck", []), *history.get("congestion", [])]

        def route_near(point_list, hotspot):
            return any(
                math.hypot(point[0] - hotspot["x"], point[1] - hotspot["y"])
                <= 1.5
                for point in point_list
            )

        avoided = sum(
            1
            for hotspot in hotspots
            if route_near(baseline_points, hotspot)
            and not route_near(suggested_points, hotspot)
        )
        risk_reduction = max(
            0.0, baseline["risk_score"] - suggested["risk_score"]
        )
        if risk_reduction >= 1.0 or avoided:
            explanation = (
                f"Lower-risk route avoids {avoided} recorded hotspot(s) and "
                f"reduces the traffic-risk score by {risk_reduction:.1f} points."
            )
        else:
            explanation = (
                "The shortest collision-clear route is also the best route for "
                "the selected traffic window."
            )

        risk_cells = sorted(
            penalties.items(), key=lambda item: item[1], reverse=True
        )[:600]
        maximum_penalty = max((value for _cell, value in risk_cells), default=1.0)
        used_goal = planner.cell_to_world(goal_cell)
        return {
            "advisory_only": True,
            "vehicle_id": vehicle_id,
            "generated_at": iso_time(time.time()),
            "traffic_window": {"start": history["start"], "end": history["end"]},
            "map": {
                "image": self.map_info.get("image"),
                "width": self.map_info["width"],
                "height": self.map_info["height"],
                "resolution": self.map_info["resolution"],
            },
            "start": {"x": vehicle["x"], "y": vehicle["y"]},
            "destination": {
                "requested_x": requested_goal[0],
                "requested_y": requested_goal[1],
                "x": used_goal[0],
                "y": used_goal[1],
                "snapped": math.hypot(
                    used_goal[0] - requested_goal[0],
                    used_goal[1] - requested_goal[1],
                ) > planner.resolution,
            },
            "baseline": baseline,
            "suggested": suggested,
            "risk_reduction": round(risk_reduction, 1),
            "hotspots_avoided": avoided,
            "explanation": explanation,
            "risk_cells": [
                {
                    "x": round(planner.cell_to_world(cell)[0], 3),
                    "y": round(planner.cell_to_world(cell)[1], 3),
                    "risk": round(value / maximum_penalty, 3),
                }
                for cell, value in risk_cells
            ],
        }

    def query(self, query):
        now = time.time()
        end = parse_time(query.get("end", [""])[0], now)
        if query.get("hours", [""])[0]:
            start = end - float(query["hours"][0]) * 3600.0
        else:
            start = parse_time(query.get("start", [""])[0], end - 3600.0)
        if start >= end:
            raise ValueError("start must be earlier than end")
        resolution = float(self.get_parameter("grid_resolution").value)
        event_resolution = float(self.get_parameter("event_resolution").value)
        if resolution <= 0.0:
            raise ValueError("grid_resolution must be greater than zero")
        if event_resolution <= 0.0:
            raise ValueError("event_resolution must be greater than zero")
        max_track_points = max(
            1, int(self.get_parameter("max_track_points").value)
        )
        max_analysis_samples = max(
            1000, int(self.get_parameter("max_analysis_samples").value)
        )
        latest_cutoff = max(
            start,
            end - float(self.get_parameter("latest_max_age").value),
        )
        with self.lock:
            sample_count = int(self.connection.execute(
                "SELECT COUNT(*) FROM samples WHERE observed_at BETWEEN ? AND ?",
                (start, end),
            ).fetchone()[0])
            stride = max(1, math.ceil(sample_count / max_analysis_samples))
            samples = self.connection.execute(
                """SELECT vehicle_id, x, y, speed, observed_at, motion_state,
                          commanded_speed, intent_active FROM samples
                   WHERE observed_at BETWEEN ? AND ? AND id % ? = 0
                   ORDER BY observed_at""",
                (start, end, stride),
            ).fetchall()
            latest = self.connection.execute(
                """SELECT vehicle_id, x, y, speed, observed_at, motion_state,
                          commanded_speed, intent_active FROM samples
                   WHERE observed_at BETWEEN ? AND ? AND id IN
                     (SELECT MAX(id) FROM samples WHERE observed_at BETWEEN ? AND ? GROUP BY vehicle_id)""",
                (latest_cutoff, end, latest_cutoff, end),
            ).fetchall()
            stuck = self.connection.execute(
                "SELECT vehicle_id, x, y, started_at, ended_at FROM stuck_events WHERE ended_at >= ? AND started_at <= ?",
                (start, end),
            ).fetchall()
            congestion = self.connection.execute(
                "SELECT group_key, x, y, vehicle_count, started_at, ended_at FROM congestion_events WHERE ended_at >= ? AND started_at <= ?",
                (start, end),
            ).fetchall()
            density_rows = self.connection.execute(
                """SELECT CAST(FLOOR(x / ?) AS INTEGER),
                          CAST(FLOOR(y / ?) AS INTEGER),
                          COUNT(*), COUNT(DISTINCT vehicle_id), AVG(speed),
                          SUM(CASE
                                WHEN motion_state IN
                                  ('waiting_vehicle', 'blocked_obstacle', 'stalled', 'stuck')
                                  THEN 1
                                WHEN motion_state = 'unknown' AND speed < ? THEN 1
                                ELSE 0
                              END)
                   FROM samples WHERE observed_at BETWEEN ? AND ?
                   GROUP BY 1, 2""",
                (resolution, resolution, self.get_parameter("slow_speed").value, start, end),
            ).fetchall()
            heat_bucket_seconds = self._heat_bucket_seconds(start, end)
            density_time_rows = self.connection.execute(
                """SELECT CAST(FLOOR(x / ?) AS INTEGER),
                          CAST(FLOOR(y / ?) AS INTEGER),
                          CAST(FLOOR(observed_at / ?) AS INTEGER),
                          COUNT(*), COUNT(DISTINCT vehicle_id), AVG(speed),
                          SUM(CASE
                                WHEN motion_state IN
                                  ('waiting_vehicle', 'blocked_obstacle', 'stalled', 'stuck')
                                  THEN 1
                                WHEN motion_state = 'unknown' AND speed < ? THEN 1
                                ELSE 0
                              END),
                          GROUP_CONCAT(DISTINCT vehicle_id)
                   FROM samples WHERE observed_at BETWEEN ? AND ?
                   GROUP BY 1, 2, 3""",
                (
                    resolution,
                    resolution,
                    heat_bucket_seconds,
                    self.get_parameter("slow_speed").value,
                    start,
                    end,
                ),
            ).fetchall()
            localization_summary = self.connection.execute(
                """SELECT COUNT(*), AVG(position_error),
                          SQRT(AVG(position_error * position_error)),
                          MAX(position_error), AVG(yaw_error), AVG(covariance_trace)
                   FROM localization_metrics
                   WHERE observed_at BETWEEN ? AND ?""",
                (start, end),
            ).fetchone()
            localization_vehicles = self.connection.execute(
                """SELECT vehicle_id, COUNT(*), AVG(position_error),
                          SQRT(AVG(position_error * position_error)),
                          MAX(position_error), AVG(yaw_error), AVG(covariance_trace),
                          (SELECT recent.position_error
                           FROM localization_metrics AS recent
                           WHERE recent.vehicle_id = localization_metrics.vehicle_id
                             AND recent.observed_at BETWEEN ? AND ?
                           ORDER BY recent.id DESC LIMIT 1)
                   FROM localization_metrics
                   WHERE observed_at BETWEEN ? AND ?
                   GROUP BY vehicle_id ORDER BY vehicle_id""",
                (start, end, start, end),
            ).fetchall()
            validation_rows = self.connection.execute(
                """SELECT vehicle_id, state, raw_state, authoritative_source,
                          amcl_x, amcl_y, uwb_x, uwb_y, error_m,
                          visible_tag_count, uwb_residual_m, measurement_skew_s,
                          amcl_age_s, uwb_age_s, amcl_stamp, uwb_stamp,
                          uwb_reason, observed_at
                   FROM localization_validation_samples
                   WHERE observed_at BETWEEN ? AND ? AND id IN
                     (SELECT MAX(id)
                      FROM localization_validation_samples
                      WHERE observed_at BETWEEN ? AND ?
                      GROUP BY vehicle_id)
                   ORDER BY vehicle_id""",
                (latest_cutoff, end, latest_cutoff, end),
            ).fetchall()
        known_samples = {(row[0], row[4]) for row in samples}
        samples.extend(row for row in latest if (row[0], row[4]) not in known_samples)
        samples.sort(key=lambda row: row[4])
        tracks = track_paths([row[:5] for row in samples], max_track_points)
        stuck_hotspots = self._aggregate_events(
            stuck, start, end, event_resolution
        )
        congestion_hotspots = self._aggregate_events(
            congestion, start, end, event_resolution, congestion=True
        )
        stuck_timeline = self._stuck_timeline(
            stuck, start, end, event_resolution
        )
        density_time_details = self._density_time_details(
            density_time_rows,
            stuck,
            start,
            end,
            resolution,
            heat_bucket_seconds,
        )
        path_analytics = self._path_analytics(samples, stuck, start, end)
        if validation_rows:
            uwb_validation = self._historical_validation(validation_rows)
        elif end >= now - float(self.get_parameter("latest_max_age").value):
            # A brand-new database may receive validator topics before the
            # recorder's next one-second snapshot. Use live data only when the
            # requested range actually ends at the present time.
            uwb_validation = self._validation_snapshot()
        else:
            uwb_validation = self._historical_validation([])
        localization_recovery = (
            self._initialization_snapshot()
            if end >= now - float(self.get_parameter("latest_max_age").value)
            else {"live": False, "summary": {}, "vehicles": []}
        )
        return {
            "start": iso_time(start),
            "end": iso_time(end),
            "samples": sample_count,
            "sampled_samples": len(samples),
            "density": [
                {
                    "x": (row[0] + 0.5) * resolution,
                    "y": (row[1] + 0.5) * resolution,
                    "count": int(row[2]),
                    "vehicles": int(row[3]),
                    "average_speed": float(row[4]),
                    "slow_samples": int(row[5]),
                    "time_details": density_time_details.get(
                        (int(row[0]), int(row[1])),
                        {
                            "bucket_seconds": heat_bucket_seconds,
                            "peaks": {},
                            "stuck": {
                                "events": 0,
                                "vehicles": 0,
                                "vehicle_ids": [],
                                "peak": None,
                            },
                        },
                    ),
                }
                for row in density_rows
            ],
            "latest": [
                {
                    "vehicle_id": row[0],
                    "x": row[1],
                    "y": row[2],
                    "speed": row[3],
                    "observed_at": row[4],
                    "motion_state": row[5],
                    "commanded_speed": row[6],
                    "intent_active": bool(row[7]),
                }
                for row in latest
            ],
            "tracks": tracks,
            "stuck": stuck_hotspots,
            "stuck_timeline": stuck_timeline,
            "congestion": congestion_hotspots,
            "analytics": {
                "most_stuck_location": stuck_hotspots[0] if stuck_hotspots else None,
                **path_analytics,
            },
            "localization": {
                "summary": {
                    "samples": int(localization_summary[0]),
                    "mean_error": float(localization_summary[1] or 0.0),
                    "rms_error": float(localization_summary[2] or 0.0),
                    "max_error": float(localization_summary[3] or 0.0),
                    "mean_yaw_error": float(localization_summary[4] or 0.0),
                    "mean_covariance": float(localization_summary[5] or 0.0),
                },
                "vehicles": [
                    {
                        "vehicle_id": row[0],
                        "samples": int(row[1]),
                        "mean_error": float(row[2]),
                        "rms_error": float(row[3]),
                        "max_error": float(row[4]),
                        "mean_yaw_error": float(row[5]),
                        "mean_covariance": float(row[6]),
                        "latest_error": float(row[7]),
                    }
                    for row in localization_vehicles
                ],
            },
            "uwb_validation": uwb_validation,
            "localization_recovery": localization_recovery,
        }

    def bounds(self):
        """Return the available history range for the replay controls."""
        with self.lock:
            row = self.connection.execute(
                "SELECT MIN(observed_at), MAX(observed_at) FROM samples"
            ).fetchone()
        if row is None or row[0] is None:
            return {"empty": True, "first": None, "last": None}
        return {
            "empty": False,
            "first": float(row[0]),
            "last": float(row[1]),
            "first_iso": iso_time(row[0]),
            "last_iso": iso_time(row[1]),
        }

    def debug_snapshot(self, query):
        """Return recent raw records and live diagnostics for developer checks."""
        try:
            limit = int(query.get("limit", ["100"])[0])
        except (TypeError, ValueError):
            limit = 100
        limit = max(1, min(500, limit))

        tables = {
            "samples": (
                ("id", "observed_at", "sim_time", "vehicle_id", "x", "y", "speed", "source", "frame_id", "motion_state", "commanded_speed", "intent_active"),
                "SELECT id, observed_at, sim_time, vehicle_id, x, y, speed, source, frame_id, motion_state, commanded_speed, intent_active FROM samples ORDER BY id DESC LIMIT ?",
            ),
            "stuck_events": (
                ("id", "vehicle_id", "started_at", "ended_at", "x", "y", "max_speed"),
                "SELECT id, vehicle_id, started_at, ended_at, x, y, max_speed FROM stuck_events ORDER BY id DESC LIMIT ?",
            ),
            "congestion_events": (
                ("id", "group_key", "vehicle_count", "started_at", "ended_at", "x", "y"),
                "SELECT id, group_key, vehicle_count, started_at, ended_at, x, y FROM congestion_events ORDER BY id DESC LIMIT ?",
            ),
            "localization_metrics": (
                ("id", "observed_at", "sim_time", "vehicle_id", "estimated_x", "estimated_y", "ground_truth_x", "ground_truth_y", "position_error", "yaw_error", "covariance_trace"),
                "SELECT id, observed_at, sim_time, vehicle_id, estimated_x, estimated_y, ground_truth_x, ground_truth_y, position_error, yaw_error, covariance_trace FROM localization_metrics ORDER BY id DESC LIMIT ?",
            ),
            "localization_validation_samples": (
                (
                    "id", "observed_at", "sim_time", "vehicle_id", "state",
                    "raw_state", "authoritative_source", "amcl_x", "amcl_y",
                    "uwb_x", "uwb_y", "error_m", "visible_tag_count",
                    "uwb_residual_m", "measurement_skew_s", "amcl_age_s",
                    "uwb_age_s", "amcl_stamp", "uwb_stamp", "uwb_reason",
                ),
                "SELECT id, observed_at, sim_time, vehicle_id, state, raw_state, authoritative_source, amcl_x, amcl_y, uwb_x, uwb_y, error_m, visible_tag_count, uwb_residual_m, measurement_skew_s, amcl_age_s, uwb_age_s, amcl_stamp, uwb_stamp, uwb_reason FROM localization_validation_samples ORDER BY id DESC LIMIT ?",
            ),
        }
        database = {}
        with self.lock:
            database_path = self.connection.execute("PRAGMA database_list").fetchone()[2]
            for table_name, (columns, statement) in tables.items():
                count = int(
                    self.connection.execute(
                        f"SELECT COUNT(*) FROM {table_name}"
                    ).fetchone()[0]
                )
                rows = self.connection.execute(statement, (limit,)).fetchall()
                database[table_name] = {
                    "total_rows": count,
                    "shown_rows": len(rows),
                    "newest_first": True,
                    "rows": [dict(zip(columns, row)) for row in rows],
                }

        return {
            "ok": True,
            "generated_at": iso_time(time.time()),
            "note": "Raw developer view. Database rows are newest first; the state API replays recorded UWB validation for historical ranges.",
            "database_path": database_path,
            "row_limit_per_table": limit,
            "history_bounds": self.bounds(),
            "map": self.map_info,
            "live_uwb_validation": self._validation_snapshot(),
            "live_uwb_amcl_startup": self._initialization_snapshot(),
            "database": database,
        }

    def destroy_node(self):
        self.server.shutdown()
        self.server.server_close()
        self.connection.close()
        return super().destroy_node()


def main(args=None):
    rclpy.init(args=args)
    node = WebMonitor()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
