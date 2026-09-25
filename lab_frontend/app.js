const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const canvas = $('networkCanvas');
const linkLayer = $('linkLayer');
const routeLayer = $('routeLayer');
const nodeLayer = $('nodeLayer');
const packetLayer = $('packetLayer');
const connectPreview = $('connectPreview');
const inspectorBody = $('inspectorBody');
let state = null;
let mode = 'select';
let selected = null;
let connectStart = null;
let drag = null;
let seenPacketIds = new Set();
let diagnosticView = false;
let transportView = false;
let transportProtocol = 'TCP';
let packetFilter = {status:'all', protocol:'all', traffic_class:'all'};
let playTimer = null;
let zoom = 1;
let origin = { x: 0, y: 0 };

const TYPES = {pc:'PC',laptop:'Laptop',server:'Server',printer:'Printer',router:'Router',switch:'Switch',hub:'Hub',access_point:'Access Point',cloud:'Cloud',internet:'Internet'};
const TYPE_CLASS = {pc:'host',laptop:'host',server:'server',printer:'host',router:'router',switch:'switch',hub:'switch',access_point:'switch',cloud:'cloud',internet:'cloud'};
const COLORS = {Emergency:'#f16c7a',VoIP:'#56d9e8',Video:'#bb9cff',HTTP:'#5ca9ff',FTP:'#f3bf5b'};

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function key(a, b) { return [a,b].sort().join('--'); }
function fmt(n, digits=0) { return Number(n || 0).toFixed(digits); }
function clock(seconds) { const s=Math.max(0,Number(seconds)||0); return `${String(Math.floor(s/60)).padStart(2,'0')}:${(s%60).toFixed(1).padStart(4,'0')}`; }
function toast(message, error=false) { const el=$('toast'); el.textContent=message; el.className=`toast show${error?' error':''}`; clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.className='toast',2600); }

async function api(action, payload={}) {
  try {
    const response = await fetch('/api/action', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action,...payload})});
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Backend request failed');
    if (data.state && Array.isArray(data.state.devices)) { state=data.state; render(); }
    return data;
  } catch (error) { toast(error.message, true); throw error; }
}
async function loadState() { const response=await fetch('/api/state'); state=await response.json(); render(); }

function icon(type) {
  if (type==='router') return '<circle class="device-glyph" cx="0" cy="-2" r="10"/><path class="device-glyph" d="M-10 10h20M-5 6l5 4 5-4M-5 14l5-4 5 4"/>';
  if (type==='switch' || type==='hub') return '<rect class="device-glyph" x="-16" y="-10" width="32" height="20" rx="2"/><path class="device-glyph" d="M-11-3h22M-11 3h22M-12 10v4M-4 10v4M4 10v4M12 10v4"/>';
  if (type==='server') return '<rect class="device-glyph" x="-13" y="-17" width="26" height="34" rx="2"/><path class="device-glyph" d="M-8-9H8M-8 0H8M-8 9H8"/><circle cx="7" cy="-9" r="1.5" fill="#65e6a6"/><circle cx="7" cy="0" r="1.5" fill="#56d9e8"/>';
  if (type==='printer') return '<rect class="device-glyph" x="-15" y="-8" width="30" height="18" rx="2"/><path class="device-glyph" d="M-9-8v-8h18v8M-9 10v7h18v-7"/><path class="device-glyph" d="M-6 2H6"/>';
  if (type==='laptop') return '<rect class="device-glyph" x="-14" y="-14" width="28" height="20" rx="2"/><path class="device-glyph" d="M-19 10h38l-4 5H-15z"/>';
  if (type==='cloud') return '<path class="device-glyph" d="M-22 11c-8 0-10-11-3-14 2-10 15-11 20-4 10-4 20 3 17 12 0 4-4 6-8 6z"/>';
  if (type==='access_point') return '<path class="device-glyph" d="M-18-2c8-9 28-9 36 0M-12 4c5-5 19-5 24 0"/><circle cx="0" cy="11" r="2" fill="#56d9e8"/>';
  return '<rect class="device-glyph" x="-15" y="-14" width="30" height="23" rx="2"/><path class="device-glyph" d="M-8 16h16M-4 9l4 4 4-4"/>';
}
function nodeMarkup(device) {
  const down=device.status==='DOWN';
  return `<g class="node ${TYPE_CLASS[device.type]||'host'} ${down?'down':''} ${selected?.kind==='device'&&selected.id===device.id?'selected':''}" data-id="${esc(device.id)}" transform="translate(${device.x},${device.y})">
    <rect class="selection" x="-34" y="-38" width="68" height="82" rx="7"/><rect class="device-body" x="-30" y="-33" width="60" height="60" rx="8"/>${icon(device.type)}<circle class="port" cx="-25" cy="30" r="2"/><circle class="port" cx="25" cy="30" r="2"/><text class="node-label" y="45">${esc(device.name)}</text><text class="node-type" y="57">${esc(TYPES[device.type]||device.type)}</text><text class="node-status ${down?'down':'up'}" y="68">${down?'DOWN':'ONLINE'}</text></g>`;
}
function linkMarkup(link, active) {
  const source=state.devices.find(d=>d.id===link.source), target=state.devices.find(d=>d.id===link.target);
  if (!source || !target) return '';
  const mx=(source.x+target.x)/2, my=(source.y+target.y)/2;
  const failed=link.status==='DOWN', warning=link.congestion>.3, loss=link.packet_loss>.1;
  const cls=failed?'failed':warning?'warning':loss?'loss':active?'active':'';
  return `<g data-link="${esc(link.id)}" data-source="${esc(link.source)}" data-target="${esc(link.target)}"><line class="link hit" x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}"/><line class="link ${cls}" x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}"/><g class="link-label ${active?'active':''}" transform="translate(${mx},${my})"><rect x="-32" y="-9" width="64" height="18"/><text y="0">${fmt(link.bandwidth)}M · ${Math.round(link.latency)}ms</text></g></g>`;
}
function routeEdges() {
  const edges=new Set();
  for (const flow of state.flows || []) for (let i=0;i<(flow.route||[]).length-1;i++) edges.add(key(flow.route[i],flow.route[i+1]));
  for (const packet of state.packets || []) if (['ACTIVE','PENDING'].includes(packet.status) && packet.route?.length>1) for (let i=0;i<packet.route.length-1;i++) edges.add(key(packet.route[i],packet.route[i+1]));
  return edges;
}
function renderCanvas() {
  const edges=routeEdges();
  linkLayer.innerHTML=(state.links||[]).map(l=>linkMarkup(l,edges.has(key(l.source,l.target)))).join('');
  nodeLayer.innerHTML=(state.devices||[]).map(nodeMarkup).join('');
  $('canvasEmpty').style.display=state.devices?.length?'none':'grid';
  $('gridRect').style.display=$('gridToggle').checked?'block':'none';
  linkLayer.querySelectorAll('[data-link]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mode === 'delete') {
        api('delete_link', {source: el.dataset.source, target: el.dataset.target});
      } else {
        selected = {kind: 'link', id: el.dataset.source, other: el.dataset.target}; diagnosticView=false; transportView=false; renderInspector();
      }
    });
  });
  nodeLayer.querySelectorAll('[data-id]').forEach(el=>bindNode(el));
  $('backendName').textContent=state.name;
  $('topologyName').textContent=state.name;
  $('clock').textContent=clock(state.time);
  $('statSent').textContent=Math.round(state.metrics.sent); $('statDelivered').textContent=Math.round(state.metrics.delivered); $('statDropped').textContent=Math.round(state.metrics.dropped); $('statPdr').textContent=`${fmt(state.metrics.pdr,1)}%`; $('statLatency').textContent=`${fmt(state.metrics.latency,1)} ms`; $('statRouteChanges').textContent=state.metrics.route_changes;
  const q=state.queue||{}; $('queueLength').textContent=`${Math.round(q.length||0)} packets`; $('queueWait').textContent=`${fmt((q.average_wait||0)*1000,1)} ms average wait`; $('flowCount').textContent=`${state.flows?.length||0} active flows`; $('queueBar').style.width=`${Math.min(100,(q.length||0)*10)}%`;
  const packets=state.packets||[];
  if(!packets.length) seenPacketIds.clear();
  packets.forEach(packet=>{const packetKey=String(packet.id);if(!seenPacketIds.has(packetKey)){seenPacketIds.add(packetKey);animatePacket(packet);}});
  renderDiagnosticToolbar();
  $('undoBtn').disabled=!state.can_undo; $('redoBtn').disabled=!state.can_redo;
  $('playBtn').classList.toggle('primary',state.running);
}
function renderTimeline() {
  const events=(state.events||[]).slice().reverse();
  $('timeline').innerHTML=events.length?events.map(e=>`<div class="timeline-item" data-kind="${esc(e.event)}" data-event="${esc(JSON.stringify(e))}"><span class="timeline-time">${clock(e.time)}</span><span class="timeline-event">${esc(e.event)}</span><span class="timeline-message">${esc(e.message)}</span></div>`).join(''):'<div class="timeline-empty">No simulation events yet. Start traffic or inject a fault.</div>';
  $('timeline').querySelectorAll('.timeline-item').forEach(el=>el.addEventListener('click',()=>{selected={kind:'event',data:JSON.parse(el.dataset.event)};renderInspector();}));
}
function render() { renderCanvas(); renderTimeline(); renderInspector(); }
function bindNode(el) {
  const id=el.dataset.id;
  el.addEventListener('pointerdown',(e)=>{
    e.stopPropagation();
    if(mode==='delete') { api('delete_device',{id}); return; }
    if(mode==='connect') { if(!connectStart) {connectStart=id;toast(`Connect from ${id}`);} else if(connectStart!==id) { const from=connectStart;connectStart=null;api('add_link',{source:from,target:id}); } return; }
    if(e.button!==0) return;
    const point=canvasPoint(e); drag={id,dx:point.x-state.devices.find(d=>d.id===id).x,dy:point.y-state.devices.find(d=>d.id===id).y,moved:false}; el.setPointerCapture?.(e.pointerId); selected={kind:'device',id}; diagnosticView=false; transportView=false; renderInspector();
  });
  el.addEventListener('pointermove',(e)=>{if(!drag||drag.id!==id)return;const p=canvasPoint(e);let x=p.x-drag.dx,y=p.y-drag.dy;if($('snapToggle').checked){x=Math.round(x/16)*16;y=Math.round(y/16)*16;}drag.moved=true;el.setAttribute('transform',`translate(${x},${y})`);origin={x,y};});
  el.addEventListener('pointerup',async()=>{if(!drag||drag.id!==id)return;const d=drag;drag=null;if(d.moved) await api('move_device',{id,x:origin.x,y:origin.y}); else renderInspector();});
  el.addEventListener('click',(e)=>{e.stopPropagation();if(mode==='select'&&!drag){selected={kind:'device',id};diagnosticView=false;renderInspector();}});
}
function canvasPoint(event) { const point=canvas.createSVGPoint(); point.x=event.clientX;point.y=event.clientY; return point.matrixTransform(canvas.getScreenCTM().inverse()); }
function animatePacket(packet) {
  const route=packet.route||[]; if(route.length<2)return; const points=route.map(id=>state.devices.find(d=>d.id===id)).filter(Boolean); if(points.length<2)return;
  const id=`packetPath-${packet.id}-${Date.now()}`; const d=points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' '); const trafficClass=packet.traffic_class||packet.traffic_type; const kind=packet.kind||'DATA'; const protocol=packet.protocol||'IP'; const color=packet.status==='DROPPED'?'#f16c7a':protocol==='TCP'?(kind==='ACK'?'#bb9cff':kind==='CONTROL'||kind==='FIN'?'#f3bf5b':'#56d9e8'):protocol==='UDP'?'#5ca9ff':COLORS[trafficClass]||'#56d9e8'; const retransmission=Number(packet.retransmission||0); const transportClass=protocol==='TCP'?`transport tcp-${kind.toLowerCase()}`:protocol==='UDP'?'transport udp-data':''; const stateClass=`${packet.status==='DROPPED'?'dropped ':''}${retransmission?'retransmission':''}`; const label=protocol==='TCP'?`${protocol} ${(packet.flags||[]).join('+')||kind}${retransmission?' ↻'+retransmission:''}`:protocol==='UDP'?`${protocol} DATA`:`P${packet.id}`;
  packetLayer.insertAdjacentHTML('beforeend',`<path id="${id}" d="${d}" fill="none" stroke="none"/><g class="packet ${transportClass} ${stateClass}" data-packet="${packet.id}" style="color:${color}"><circle class="packet-ring" r="8"/><circle class="packet-core" r="3"/><text class="packet-label" y="-13">${esc(label)}</text><animateMotion dur="${Math.max(900,route.length*430)}ms" repeatCount="1" fill="freeze"><mpath href="#${id}"/></animateMotion></g>`);
  packetLayer.querySelector(`[data-packet="${CSS.escape(String(packet.id))}"]`)?.addEventListener('click',()=>{selected={kind:'packet',data:packet};diagnosticView=false;transportView=false;renderInspector();});
  setTimeout(()=>{const el=document.getElementById(id);if(el)el.remove();},Math.max(1000,route.length*430)+300);
}
function renderDiagnosticToolbar(){
  const source=selected?.kind==='device'?selected.id:null;
  $('diagnosticSource').textContent=source||'select a device';
  const select=$('diagnosticDestination');
  const previous=select.value;
  const destinations=(state.devices||[]).filter(device=>device.id!==source);
  select.innerHTML=destinations.length?destinations.map(device=>`<option value="${esc(device.id)}">${esc(device.name)}</option>`).join(''):'<option>select a destination</option>';
  if(destinations.some(device=>device.id===previous))select.value=previous;
}
function eventName(value){return String(value||'').split('.').pop();}
function diagnosticResultInspector(){
  const result=state.diagnostic_result;
  if(!result)return '<div class="inspector-empty"><div>⌁</div><p>Select a device and run a diagnostic quick action.</p></div>';
  if(result.type==='ping'){
    const r=result.rtt_ms||{};
    return `<div class="device-hero"><div class="device-symbol">⌁</div><div><b>${esc(result.title)}</b><span>${result.success?'Reachable':'Unreachable'} · real ICMP simulation</span></div></div><div class="diagnostic-stats">${[['Packets',result.packets],['Sent',result.sent],['Received',result.received],['Lost',result.lost],['Loss',`${fmt(result.loss_percent,1)}%`],['Hops',Math.max(0,(result.path?.length||0)-1)]].map(([label,value])=>`<div class="diagnostic-stat"><b>${esc(value)}</b><span>${label}</span></div>`).join('')}</div><div class="inspector-section"><div class="section-title">RTT</div>${property('Minimum',r.min==null?'—':`${fmt(r.min,2)} ms`)}${property('Average',r.average==null?'—':`${fmt(r.average,2)} ms`)}${property('Maximum',r.max==null?'—':`${fmt(r.max,2)} ms`)}</div><div class="inspector-section"><div class="section-title">Actual path</div><div class="diagnostic-path">${esc((result.path||[]).join(' → ')||'No route')}</div>${result.reason?`<div class="drop-reason">${esc(result.reason)}</div>`:''}<button data-action="open-packets">Inspect ${result.packet_results?.length||0} ping packets</button></div>`;
  }
  if(result.type==='traceroute'){
    return `<div class="device-hero"><div class="device-symbol">↳</div><div><b>${esc(result.title)}</b><span>${result.hops.length} discovered hops</span></div></div><table class="diagnostic-table"><thead><tr><th>#</th><th>Device</th><th>IP</th><th>Response</th></tr></thead><tbody>${result.hops.map(hop=>`<tr><td>${hop.hop}</td><td>${esc(hop.device)}</td><td>${esc(hop.ip||'—')}</td><td>${hop.response_time_ms==null?'—':`${fmt(hop.response_time_ms,2)} ms`}</td></tr>`).join('')}</tbody></table><div class="diagnostic-path">${esc((result.path||[]).join(' → '))}</div><button data-action="open-packets">Inspect traceroute packets</button>`;
  }
  if(result.type==='arp'){
    return `<div class="device-hero"><div class="device-symbol">▤</div><div><b>${esc(result.title)}</b><span>${result.entries.length} dynamic entr${result.entries.length===1?'y':'ies'}</span></div></div>${result.message?`<p class="hint">${esc(result.message)}</p>`:''}<table class="diagnostic-table"><thead><tr><th>IP Address</th><th>MAC Address</th><th>Interface</th><th>State</th></tr></thead><tbody>${result.entries.map(entry=>`<tr><td>${esc(entry.ip_address)}</td><td>${esc(entry.mac_address)}</td><td>${esc(entry.interface_id)}</td><td>${esc(entry.state)}</td></tr>`).join('')||'<tr><td colspan="4">No ARP entries learned.</td></tr>'}</tbody></table><button class="danger" data-action="clear-arp">Clear ARP</button>`;
  }
  if(result.type==='mac'){
    return `<div class="device-hero"><div class="device-symbol">▥</div><div><b>${esc(result.title)}</b><span>${result.entries.length} learned entr${result.entries.length===1?'y':'ies'}</span></div></div>${result.message?`<p class="hint">${esc(result.message)}</p>`:''}<table class="diagnostic-table"><thead><tr><th>MAC Address</th><th>Interface</th><th>Type</th></tr></thead><tbody>${result.entries.map(entry=>`<tr><td>${esc(entry.mac_address)}</td><td>${esc(entry.interface_id)}</td><td>${esc(entry.type)}</td></tr>`).join('')||'<tr><td colspan="3">No MAC addresses learned.</td></tr>'}</tbody></table><button class="danger" data-action="clear-mac">Clear MAC Table</button>`;
  }
  return '<div class="inspector-empty"><div>⌁</div><p>No diagnostic result.</p></div>';
}
function packetListInspector(){
  const packets=state.packets||[];
  const filtered=packets.filter(packet=>{
    const status=packetFilter.status;
    const statusMatch=status==='all'||(status==='active'?['ACTIVE','PENDING'].includes(packet.status):packet.status===status.toUpperCase());
    return statusMatch&&(packetFilter.protocol==='all'||packet.protocol===packetFilter.protocol)&&(packetFilter.traffic_class==='all'||(packet.traffic_class||packet.traffic_type)===packetFilter.traffic_class);
  });
  const statuses=['all','active','delivered','dropped'];
  const classes=[...new Set(packets.map(packet=>packet.traffic_class||packet.traffic_type).filter(Boolean))];
  return `<div class="device-hero"><div class="device-symbol">◎</div><div><b>Packet Inspector</b><span>${filtered.length} of ${packets.length} engine packets</span></div></div><div class="packet-filter-row"><select data-packet-filter="status">${statuses.map(value=>`<option value="${value}" ${packetFilter.status===value?'selected':''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select><select data-packet-filter="protocol"><option value="all">All protocols</option><option value="ICMP" ${packetFilter.protocol==='ICMP'?'selected':''}>ICMP</option><option value="IP" ${packetFilter.protocol==='IP'?'selected':''}>IP</option></select></div><select data-packet-filter="traffic_class" style="width:100%;margin-bottom:8px"><option value="all">All traffic classes</option>${classes.map(value=>`<option ${packetFilter.traffic_class===value?'selected':''}>${esc(value)}</option>`).join('')}</select>${filtered.map(packet=>`<div class="packet-row" data-packet-id="${esc(packet.id)}"><b>#${esc(packet.id)} · ${esc(packet.source)} → ${esc(packet.destination)}</b><span>${esc(packet.protocol)} · ${esc(packet.traffic_class||packet.traffic_type)} · ${esc(packet.status)}</span></div>`).join('')||'<p class="hint">No packets match these filters.</p>'}`;
}
function bindPacketList(){
  inspectorBody.querySelectorAll('[data-packet-filter]').forEach(input=>input.addEventListener('change',()=>{packetFilter[input.dataset.packetFilter]=input.value;diagnosticView=true;renderInspector();}));
  inspectorBody.querySelectorAll('[data-packet-id]').forEach(row=>row.addEventListener('click',()=>{const packet=(state.packets||[]).find(item=>String(item.id)===row.dataset.packetId);if(packet){selected={kind:'packet',data:packet};diagnosticView=false;transportView=false;renderInspector();}}));
}
function property(label,value,html=false){return `<div class="property"><label>${esc(label)}</label>${html?value:`<span>${esc(value)}</span>`}</div>`;}
function deviceInspector(device) {
  const down=device.status==='DOWN';
  return `<div class="device-hero"><div class="device-symbol">${device.type==='router'?'◉':device.type==='switch'?'▥':'🖥'}</div><div><b>${esc(device.name)}</b><span>${esc(TYPES[device.type]||device.type)} · ${device.interfaces.length} interface${device.interfaces.length===1?'':'s'}</span></div></div>
  <div class="inspector-section"><div class="section-title">Identity <span class="status-badge ${down?'status-down':'status-up'}">${down?'DOWN':'ONLINE'}</span></div><input id="renameInput" value="${esc(device.name)}" style="width:100%;margin-bottom:8px"/><div class="button-row"><button data-action="rename">Rename</button><button data-action="duplicate">Duplicate</button><button class="danger" data-action="delete-device">Delete</button></div></div>
  <div class="inspector-section"><div class="section-title">Interfaces <span>${device.interfaces.length}</span></div>${device.interfaces.map(i=>`<div class="interface-card"><div class="interface-head"><b>${esc(i.interface_id)}</b><span class="status-badge ${i.status==='UP'?'status-up':'status-down'}">${i.status}</span></div><div class="interface-fields"><input data-field="ip_address" value="${esc(i.ip_address||'')}" placeholder="IP address"/><input data-field="prefix" type="number" min="1" max="32" value="${i.prefix}"/><input data-field="mac_address" value="${esc(i.mac_address||'')}" placeholder="MAC address"/><select data-field="status"><option ${i.status==='UP'?'selected':''}>UP</option><option ${i.status==='DOWN'?'selected':''}>DOWN</option></select></div><div class="interface-actions"><span>${esc(i.network_address||'unassigned')}</span><button data-action="apply-interface" data-interface="${esc(i.interface_id)}">Apply</button></div></div>`).join('')}</div>
  <div class="inspector-section"><div class="section-title">Device actions</div><div class="button-row">${down?'<button data-action="restart">Restart device</button>':'<button class="danger" data-action="shutdown">Shutdown device</button>'}<button data-action="console">Open console</button></div></div>
  <div class="inspector-section"><div class="section-title">Traffic generator</div><div class="traffic-form"><label>Destination<select id="trafficDestination">${state.devices.filter(d=>d.id!==device.id&&d.status==='UP').map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select></label><div class="two"><label>Class<select id="trafficType"><option>Emergency</option><option>VoIP</option><option selected>Video</option><option>HTTP</option><option>FTP</option></select></label><label>Packets<input id="trafficCount" type="number" min="1" value="12"/></label></div><div class="two"><label>Rate (pps)<input id="trafficPps" type="number" min=".1" value="5"/></label><label>Size (B)<input id="trafficSize" type="number" min="64" value="1500"/></label></div><button data-action="start-traffic">Start traffic</button></div></div>
  ${device.type==='router'?routerTable(device):device.type==='switch'?switchTable(device):serverInfo(device)}`;
}
function routerTable(device){const rows=state.routing_tables?.[device.id]||[];return `<div class="inspector-section"><div class="section-title">Routing table <span>${rows.length} routes</span></div>${rows.length?rows.map(r=>`<div class="interface-card"><b>${esc(r.destination_network)}/${r.prefix}</b><div>via ${esc(r.next_hop||'DIRECT')} · ${esc(r.outgoing_interface)} · metric ${fmt(r.metric,1)}</div></div>`).join(''):'<p class="hint">No route entries available.</p>'}</div>`;}
function switchTable(device){const rows=Object.entries(device.mac_table||{});return `<div class="inspector-section"><div class="section-title">MAC address table <span>${rows.length}</span></div>${rows.length?rows.map(([mac,port])=>`<div class="interface-card"><b>${esc(mac)}</b><div>${esc(port)}</div></div>`).join(''):'<p class="hint">No MACs learned.</p>'}</div>`;}
function serverInfo(device){return `<div class="inspector-section"><div class="section-title">Services</div><p class="hint">No application services configured. This server can carry simulator traffic.</p></div>`;}
function linkInspector(link){return `<div class="device-hero"><div class="device-symbol">⌁</div><div><b>${esc(link.source)} ↔ ${esc(link.target)}</b><span>Link inspector · ${esc(link.duplex)} duplex</span></div></div><div class="inspector-section"><div class="section-title">Link conditions <span class="link-state ${link.status==='UP'?'status-up':'status-down'}">${link.status}</span></div>${property('Latency (ms)',link.latency)}<input id="linkLatency" type="number" value="${link.latency}"/><br>${property('Bandwidth (Mbps)',link.bandwidth)}<input id="linkBandwidth" type="number" value="${link.bandwidth}"/><br>${property('Packet loss (%)',fmt(link.packet_loss*100,1))}<input id="linkLoss" type="number" min="0" max="100" step="1" value="${fmt(link.packet_loss*100,1)}"/><br>${property('Congestion (%)',fmt(link.congestion*100,1))}<input id="linkCongestion" type="number" min="0" max="100" step="1" value="${fmt(link.congestion*100,1)}"/><div class="button-row"><button data-action="apply-link">Apply conditions</button><button class="danger" data-action="toggle-link">${link.status==='UP'?'Fail link':'Recover link'}</button><button data-action="delete-link">Delete</button></div></div><div class="inspector-section"><div class="section-title">Interfaces</div>${property('Interface A',link.interface_a)}${property('Interface B',link.interface_b)}</div>`;}
function packetInspector(packet){
  const trafficClass=packet.traffic_class||packet.traffic_type;
  const journey=packet.journey||packet.events||[];
  const dropReason=packet.drop_reason||packet.reason;
  const transport=packet.protocol==='TCP'||packet.protocol==='UDP';
  const queueWait=packet.queue_wait_ms??(packet.queue_wait_time==null?null:packet.queue_wait_time*1000);
  return `<div class="device-hero"><div class="device-symbol" style="color:${COLORS[trafficClass]||'#56d9e8'}">●</div><div><b>Packet #${esc(packet.id)}</b><span>${esc(packet.status)} · ${esc(trafficClass)}</span></div></div><div class="inspector-section">${property('Source',packet.source)}${property('Destination',packet.destination)}${property('Protocol',packet.protocol||'IP')}${property('Size',`${packet.size} bytes`)}${property('TTL',packet.ttl)}${property('Traffic class',trafficClass)}${transport?property('Source port',packet.source_port):''}${transport?property('Destination port',packet.destination_port):''}${transport?property('Sequence number',packet.sequence_number??'—'):''}${transport?property('Acknowledgement number',packet.acknowledgement_number??'—'):''}${transport?property('Flags',(packet.flags||[]).join(' ')||'—'):''}${transport?property('Window size',packet.window_size??'—'):''}${transport?property('Retransmission',packet.retransmission??0):''}${property('Queue wait',queueWait==null?'—':`${fmt(queueWait,2)} ms`)}${property('Current device',packet.current_device||'—')}${property('Next hop',packet.next_hop||'—')}${property('Status',packet.status)}${property('Flow ID',packet.flow_id||'diagnostic')}${property('Route',(packet.route||[]).join(' → ')||'No route')}</div>${dropReason?`<div class="drop-reason">DROP · ${esc(dropReason)}</div>`:''}<div class="inspector-section"><div class="section-title">PACKET JOURNEY <span>${journey.length} events</span></div>${journey.map((event,index)=>`<div class="journey-step"><b>${index+1}. ${esc(eventName(event.event))}</b><div>${esc(event.message)}</div><span class="hint">${clock(event.time)} · ${esc(event.component||'simulator')}</span></div>`).join('')||'<p class="hint">No packet events recorded.</p>'}</div><button data-action="back-packets">Back to packet viewer</button>`;
}
function eventInspector(event){return `<div class="device-hero"><div class="device-symbol">!</div><div><b>${esc(event.event)}</b><span>${clock(event.time)} simulation time</span></div></div><div class="console-output">${esc(JSON.stringify(event,null,2))}</div>`;}
function transportLabInspector(){
  const flows=state.transport?.flows||[];
  const source=selected?.kind==='device'?selected.id:(flows[0]?.source||state.devices?.[0]?.id||'');
  const connections=state.transport?.connections||[],udp=state.transport?.udp_flows||[];
  const protocol=transportProtocol;
  const active=(protocol==='TCP'?connections[0]:udp[0])||null;
  const stats=state.transport?.statistics||{};
  const protocolStats=active||stats[protocol]||{};
  const destination=active?.destination||(state.devices||[]).find(device=>device.id!==source)?.id||'';
  const destinationOptions=(state.devices||[]).filter(device=>device.id!==source).map(device=>`<option value="${esc(device.id)}" ${device.id===destination?'selected':''}>${esc(device.name)}</option>`).join('');
  const sourceOptions=(state.devices||[]).map(device=>`<option value="${esc(device.id)}" ${device.id===source?'selected':''}>${esc(device.name)}</option>`).join('');
  const stateOrder=['CLOSED','SYN_SENT','SYN_RECEIVED','ESTABLISHED','FIN_WAIT','CLOSE_WAIT','LAST_ACK','TIME_WAIT','CLOSED'];
  const currentState=protocol==='TCP'?(active?.state||'CLOSED'):'CONNECTIONLESS';
  const comparison=state.transport?.result;
  const comparisonHtml=comparison?.results?.length?`<table class="diagnostic-table"><thead><tr><th>Protocol</th><th>Latency</th><th>PDR</th><th>Retrans.</th><th>Setup</th></tr></thead><tbody>${comparison.results.map(row=>`<tr><td>${esc(row.protocol)}</td><td>${fmt((row.average_latency||0)*1000,1)} ms</td><td>${fmt(row.packet_delivery_ratio??row.data_packet_delivery_ratio??0,1)}%</td><td>${fmt(row.retransmissions??row.retransmission_count??0,0)}</td><td>${row.connection_setup_time==null?'—':`${fmt(row.connection_setup_time*1000,1)} ms`}</td></tr>`).join('')}</tbody></table>`:'';
  const loss=100-(protocolStats.packet_delivery_ratio??protocolStats.data_packet_delivery_ratio??0);
  const metrics=[
    ['Data packets',protocolStats.data_packets_sent??protocolStats.packets_sent??0],
    ['Delivered',protocolStats.data_packets_delivered??protocolStats.packets_delivered??0],
    ['Packet loss',`${fmt(loss,1)}%`],
    ['Throughput',`${fmt(protocolStats.throughput||0,1)} B/s`],
    ['RTT',protocol==='TCP'?(active?.average_rtt_ms==null?'—':`${fmt(active.average_rtt_ms,1)} ms`):'N/A'],
    ['CWND',protocol==='TCP'?(active?.cwnd==null?'—':fmt(active.cwnd,1)):'N/A'],
    ['SSTHRESH',protocol==='TCP'?(active?.ssthresh==null?'—':fmt(active.ssthresh,1)):'N/A'],
    ['In flight',protocol==='TCP'?(active?.packets_in_flight??0):'N/A'],
    ['ACKs',protocol==='TCP'?(active?.ack_count??0):'N/A'],
    ['Retransmissions',protocol==='TCP'?(active?.retransmission_count??0):0],
    ['Timeouts',protocol==='TCP'?(active?.timeout_count??0):0],
    ['Bytes',protocolStats.bytes_transferred??0],
  ];
  return `<div class="device-hero"><div class="device-symbol">⇄</div><div><b>Transport Lab</b><span>TCP / UDP over the live topology</span></div></div><div class="inspector-section"><div class="section-title">Transport setup</div><label>Protocol<select id="transportProtocol"><option ${protocol==='TCP'?'selected':''}>TCP</option><option ${protocol==='UDP'?'selected':''}>UDP</option></select></label><label>Source<select id="transportSource">${sourceOptions}</select></label><label>Destination<select id="transportDestination">${destinationOptions}</select></label><div class="two"><label>Source port<input id="transportSourcePort" type="number" min="1" max="65535" value="${active?.source_port||5000}"/></label><label>Destination port<input id="transportDestinationPort" type="number" min="1" max="65535" value="${active?.destination_port||8080}"/></label></div><label>Payload (KB)<input id="transportPayload" type="number" min="1" value="${Math.max(1,Math.round((active?.packets?.find(p=>p.kind==='DATA')?.payload_size||1000)/1024))}"/></label><div id="tcpTransportSettings" class="${protocol==='UDP'?'hidden':''}"><div class="two"><label>Initial CWND<input id="transportCwnd" type="number" min="1" value="${active?.initial_cwnd||1}"/></label><label>Receiver window<input id="transportReceiverWindow" type="number" min="1" value="${active?.receiver_window||8}"/></label></div><div class="two"><label>SSTHRESH<input id="transportSsthresh" type="number" min="1" value="${active?.ssthresh||16}"/></label><label>Timeout (ms)<input id="transportTimeout" type="number" min="1" value="${Math.round((active?.timeout||.1)*1000)}"/></label></div></div><div class="button-row"><button data-transport-action="create">${active?'Start Connection':'Start Flow'}</button><button data-transport-action="send">Send Data</button><button data-transport-action="close" ${protocol==='TCP'?'':'disabled'}>Close</button><button data-transport-action="stop">Stop</button><button data-transport-action="tick">Advance 100 ms</button><button data-transport-action="reset">Reset</button></div></div><div class="inspector-section"><div class="section-title">TCP state</div><div class="transport-state-machine">${stateOrder.map(item=>`<span class="tcp-state ${item===currentState?'current':''}">${item.replaceAll('_',' ')}</span>`).join('<i>→</i>')}</div></div><div class="inspector-section"><div class="section-title">Live ${esc(protocol)} metrics</div><div class="diagnostic-stats">${metrics.map(([label,value])=>`<div class="diagnostic-stat"><b>${esc(value)}</b><span>${label}</span></div>`).join('')}</div></div><div class="inspector-section"><div class="section-title">Active transport flows</div>${(connections.length+udp.length)?[...connections,...udp].map(flow=>`<div class="interface-card"><b>${esc(flow.flow_id)} · ${esc(flow.source)}:${flow.source_port} → ${esc(flow.destination)}:${flow.destination_port}</b><div>${esc(flow.state)} · ${esc(flow.traffic_class)} · ${fmt(flow.packet_delivery_ratio??100,1)}% delivered</div></div>`).join(''):'<p class="hint">No transport flow.</p>'}</div><div class="inspector-section"><div class="section-title">TCP vs UDP comparison</div><button data-transport-action="compare">Run deterministic comparison</button>${comparisonHtml}<div class="hint">Cloned topology, identical workload, network conditions, scheduler, and seed.</div></div>`;
}
function bindTransportLab(){
  inspectorBody.querySelectorAll('[data-transport-action]').forEach(button=>button.addEventListener('click',async()=>{
    const action=button.dataset.transportAction;
    const source=$('transportSource')?.value||(selected?.kind==='device'?selected.id:null);
    const destination=$('transportDestination')?.value;
    const protocol=$('transportProtocol')?.value||'TCP';
    const payload=Math.max(1,Number($('transportPayload')?.value||1))*1024;
    try{
      if(action==='create'){if(!source||!destination)throw new Error('Select source and destination devices.');await api('transport_create',{protocol,source,destination,source_port:Number($('transportSourcePort').value),destination_port:Number($('transportDestinationPort').value),payload_size:payload,initial_cwnd:Number($('transportCwnd')?.value||1),receiver_window:Number($('transportReceiverWindow')?.value||8),ssthresh:Number($('transportSsthresh')?.value||16),timeout:Number($('transportTimeout')?.value||100)/1000,traffic_class:protocol==='TCP'?'HTTP':'VoIP'});}
      if(action==='send'){const flow=state.transport?.flows?.find(item=>item.protocol===protocol);if(!flow)throw new Error('Start a transport flow first.');await api('transport_send',{protocol,flow_id:flow.flow_id,packet_count:1,payload_size:payload});}
      if(action==='close'){const flow=state.transport?.connections?.[0];if(!flow)throw new Error('No TCP connection to close.');await api('transport_close',{flow_id:flow.flow_id});}
      if(action==='tick')await api('transport_tick',{delta:0.1});
      if(action==='stop')await api('running',{value:false});
      if(action==='reset')await api('transport_reset');
      if(action==='compare')await api('transport_compare',{source,destination,packet_count:6,payload_size:payload});
      transportView=true;renderInspector();
    }catch(error){}
  }));
  $('transportProtocol')?.addEventListener('change',()=>{transportProtocol=$('transportProtocol').value;transportView=true;renderInspector();});
  $('transportSource')?.addEventListener('change',()=>{transportView=true;renderInspector();});
  $('transportDestination')?.addEventListener('change',()=>{transportView=true;renderInspector();});
}
function labSettings(){
  const routing=state.routing||{},qos=state.qos||{},weights=routing.weights||{},classes=Object.keys(qos.priorities||{});
  const routingFields=Object.entries(weights).map(([name,value])=>`<label>${esc(name)}<input data-routing-weight="${esc(name)}" type="number" min="0" step="0.1" value="${value}"/></label>`).join('');
  const classFields=classes.map(name=>`<div class="policy-row"><b>${esc(name)}</b><label>Priority<input data-priority="${esc(name)}" type="number" step="0.1" value="${qos.priorities[name]}"/></label><label>WFQ weight<input data-weight="${esc(name)}" type="number" min="0.1" step="0.1" value="${(qos.weights||{})[name]||1}"/></label></div>`).join('');
  return `<div class="device-hero"><div class="device-symbol">⚙</div><div><b>Lab policies</b><span>Live engine configuration</span></div></div><div class="inspector-section"><div class="section-title">Routing</div><label>Algorithm<select id="routingAlgorithm"><option value="dijkstra" ${routing.algorithm==='dijkstra'?'selected':''}>Dijkstra</option><option value="bellman-ford" ${routing.algorithm==='bellman-ford'?'selected':''}>Bellman–Ford</option></select></label><div class="policy-grid">${routingFields}</div><button data-action="apply-routing">Apply routing policy</button></div><div class="inspector-section"><div class="section-title">Quality of Service</div><label>Scheduler<select id="schedulerSelect"><option value="fifo" ${qos.scheduler==='fifo'?'selected':''}>FIFO</option><option value="priority" ${qos.scheduler==='priority'?'selected':''}>Priority Queue</option><option value="wfq" ${qos.scheduler==='wfq'?'selected':''}>Weighted Fair Queuing</option></select></label><div class="policy-list">${classFields}</div><button data-action="apply-qos">Apply QoS policy</button></div>`;
}
function renderInspector(){let html=labSettings();if(transportView)html=transportLabInspector();else if(diagnosticView)html=state.packetListView?packetListInspector():diagnosticResultInspector();if(!transportView&&!diagnosticView&&selected?.kind==='device'){const d=state.devices.find(x=>x.id===selected.id);if(d)html=deviceInspector(d);}if(!transportView&&!diagnosticView&&selected?.kind==='link'){const l=state.links.find(x=>key(x.source,x.target)===key(selected.id,selected.other));if(l)html=linkInspector(l);}if(!transportView&&!diagnosticView&&selected?.kind==='packet')html=packetInspector(selected.data);if(!transportView&&!diagnosticView&&selected?.kind==='event')html=eventInspector(selected.data);inspectorBody.innerHTML=html;bindInspectorActions();bindTransportLab();if(diagnosticView&&state.packetListView)bindPacketList();}
function bindInspectorActions() {
  inspectorBody.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', async () => {
      const action = el.dataset.action;
      if (action === 'rename') { const result=await api('rename_device', {id:selected.id, name:$('renameInput').value}); selected={kind:'device',id:result.state.name}; renderInspector(); }
      if (action === 'duplicate') await api('duplicate_device', {id:selected.id});
      if (action === 'delete-device' && confirm('Delete this device and its links?')) { await api('delete_device', {id:selected.id}); selected=null; renderInspector(); }
      if (action === 'shutdown') await api('shutdown_device', {id:selected.id});
      if (action === 'restart') await api('restart_device', {id:selected.id});
      if (action === 'apply-interface') {
        const card = el.closest('.interface-card');
        const values = {};
        card.querySelectorAll('[data-field]').forEach((input) => { values[input.dataset.field] = input.value; });
        await api('configure_interface', {id:selected.id, interface_id:el.dataset.interface, values});
      }
      if (action === 'apply-link') await api('configure_link', {source:selected.id, target:selected.other, values:{latency:Number($('linkLatency').value), bandwidth:Number($('linkBandwidth').value), packet_loss:Number($('linkLoss').value)/100, congestion:Number($('linkCongestion').value)/100}});
      if (action === 'toggle-link') {
        const link = state.links.find((item) => key(item.source,item.target) === key(selected.id,selected.other));
        await api('configure_link', {source:selected.id, target:selected.other, values:{status:link.status === 'UP' ? 'DOWN' : 'UP'}});
      }
      if (action === 'delete-link' && confirm('Delete this link?')) { await api('delete_link', {source:selected.id, target:selected.other}); selected=null; renderInspector(); }
      if (action === 'start-traffic') { await api('start_traffic', {source:selected.id, destination:$('trafficDestination').value, traffic_type:$('trafficType').value, packet_count:Number($('trafficCount').value), pps:Number($('trafficPps').value), packet_size:Number($('trafficSize').value)}); play(); }
      if (action === 'apply-routing') { const routingWeights={}; inspectorBody.querySelectorAll('[data-routing-weight]').forEach(input=>routingWeights[input.dataset.routingWeight]=Number(input.value)); await api('routing_algorithm',{algorithm:$('routingAlgorithm').value}); await api('routing_weights',{weights:routingWeights}); }
      if (action === 'apply-qos') { const priorities={},weights={}; inspectorBody.querySelectorAll('[data-priority]').forEach(input=>priorities[input.dataset.priority]=Number(input.value)); inspectorBody.querySelectorAll('[data-weight]').forEach(input=>weights[input.dataset.weight]=Number(input.value)); await api('scheduler',{scheduler:$('schedulerSelect').value}); await api('qos_config',{priorities,weights}); }
      if (action === 'clear-arp') await api('clear_arp',{id:state.diagnostic_result.device});
      if (action === 'clear-mac') await api('clear_mac',{id:state.diagnostic_result.device});
      if (action === 'open-packets' || action === 'back-packets') { state.packetListView=true; diagnosticView=true; renderInspector(); }
      if (action === 'console') { selected = {kind:'console', id:selected.id}; renderConsole(); }
    });
  });
}
function renderConsole(){const d=selected.id;inspectorBody.innerHTML=`<div class="device-hero"><div class="device-symbol">›_</div><div><b>${esc(d)} console</b><span>Real backend commands only</span></div></div><div class="console-output" id="consoleOutput">${esc(d)}&gt; _</div><div class="console-form"><input id="consoleInput" value="show interfaces"/><button data-console>Run</button></div><div class="button-row"><button data-action="close-console">Back to device</button></div>`;inspectorBody.querySelector('[data-console]').addEventListener('click',runConsole);inspectorBody.querySelector('[data-action="close-console"]').addEventListener('click',()=>{selected={kind:'device',id:d};renderInspector();});}
async function runConsole(){const command=$('consoleInput').value;const output=$('consoleOutput');output.textContent+=`\n${command}`;try{const result=await api('console',{id:selected.id,command});output.textContent+=`\n${result.state.output}`;}catch(error){output.textContent+=`\n${error.message}`;}}
function setMode(next){mode=next;connectStart=null;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));toast(`${next[0].toUpperCase()+next.slice(1)} tool active`);}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
document.querySelectorAll('[data-menu]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.menu;if(action==='file'){$('newBtn').click();}else if(action==='simulation'){$('playBtn').click();}else if(action==='view'){$('fitBtn').click();$('gridToggle').checked=!$('gridToggle').checked;renderCanvas();}else{toast('Build a topology, connect devices, start traffic, then inject faults to observe self-healing.');}}));
document.querySelectorAll('[data-diagnostic]').forEach(button=>button.addEventListener('click',async()=>{const action=button.dataset.diagnostic;if(action==='transport'){transportView=true;diagnosticView=false;renderInspector();return;}if(action==='packets'){state.packetListView=true;diagnosticView=true;transportView=false;renderInspector();return;}const source=selected?.kind==='device'?selected.id:null;if(!source){toast('Select a source device first.',true);return;}const destination=$('diagnosticDestination').value;try{if(action==='ping'||action==='traceroute'){if(!destination||!state.devices.some(device=>device.id===destination))throw new Error('Select a destination device.');await api(action,{source,destination,count:4});}else{await api(action==='arp'?'arp_table':'mac_table',{id:source});}state.packetListView=false;diagnosticView=true;transportView=false;renderInspector();}catch(error){}}));
document.querySelectorAll('.palette-item').forEach(item=>item.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',item.dataset.type)));
canvas.addEventListener('dragover',e=>e.preventDefault());canvas.addEventListener('drop',e=>{e.preventDefault();const type=e.dataTransfer.getData('text/plain');if(type) {const p=canvasPoint(e);api('add_device',{type,x:p.x,y:p.y});}});
canvas.addEventListener('click',e=>{if(e.target===canvas||e.target.id==='gridRect'||e.target.id==='connectPreview'){selected=null;diagnosticView=false;transportView=false;connectStart=null;connectPreview.setAttribute('d','');renderInspector();}});
canvas.addEventListener('pointermove',e=>{if(connectStart&&state){const from=state.devices.find(d=>d.id===connectStart),p=canvasPoint(e);if(from)connectPreview.setAttribute('d',`M ${from.x} ${from.y} L ${p.x} ${p.y}`);}});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.65,Math.min(1.5,zoom+(e.deltaY<0?.05:-.05)));canvas.style.transform=`scale(${zoom})`;},{passive:false});
$('gridToggle').addEventListener('change',renderCanvas);$('snapToggle').addEventListener('change',()=>{});
$('clearSelection').addEventListener('click',()=>{selected=null;diagnosticView=false;transportView=false;renderInspector();});
$('newBtn').addEventListener('click',()=>{if(confirm('Start a new blank network?'))api('new').then(()=>{selected=null;diagnosticView=false;transportView=false;state.packetListView=false;connectStart=null;renderInspector();});});
$('presetSelect').addEventListener('change',e=>api('load_preset',{preset:e.target.value}).then(()=>{selected=null;diagnosticView=false;transportView=false;state.packetListView=false;connectStart=null;renderInspector();}));
$('saveBtn').addEventListener('click',async()=>{const data=await api('export');const blob=new Blob([JSON.stringify(data.state.document,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='netadapt-lab.json';a.click();URL.revokeObjectURL(a.href);toast('Topology saved');});
$('openBtn').addEventListener('click',()=>$('fileInput').click());$('fileInput').addEventListener('change',async e=>{const file=e.target.files[0];if(file)api('import',{document:JSON.parse(await file.text())});e.target.value='';});
$('undoBtn').addEventListener('click',()=>api('undo'));$('redoBtn').addEventListener('click',()=>api('redo'));
$('playBtn').addEventListener('click',async()=>{await api('running',{value:true});play();});$('pauseBtn').addEventListener('click',()=>{stop();api('running',{value:false});});$('stopBtn').addEventListener('click',()=>{stop();api('running',{value:false});});$('stepBtn').addEventListener('click',()=>api('step'));$('resetBtn').addEventListener('click',()=>{stop();api('reset');});$('speedSelect').addEventListener('change',e=>api('speed',{value:Number(e.target.value)}));
$('fitBtn').addEventListener('click',()=>{if(!state.devices.length)return;const xs=state.devices.map(d=>d.x),ys=state.devices.map(d=>d.y),minX=Math.min(...xs)-100,maxX=Math.max(...xs)+100,minY=Math.min(...ys)-100,maxY=Math.max(...ys)+100;canvas.setAttribute('viewBox',`${minX} ${minY} ${maxX-minX} ${maxY-minY}`);});
async function play(){stop();playTimer=setInterval(async()=>{if(!state?.running){stop();return;}try{await api('step');}catch(e){stop();}},Math.max(120,600/(state?.speed||1)));}function stop(){if(playTimer)clearInterval(playTimer);playTimer=null;}
document.addEventListener('keydown',e=>{if((e.key==='Delete'||e.key==='Backspace')&&selected?.kind==='device'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();api('delete_device',{id:selected.id});}if(e.key==='Escape'){selected=null;diagnosticView=false;transportView=false;connectStart=null;renderInspector();}});
loadState().catch(e=>toast(e.message,true));
