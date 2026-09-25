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
let lastPacketId = null;
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
  if (state.last_packet?.route) for (let i=0;i<state.last_packet.route.length-1;i++) edges.add(key(state.last_packet.route[i],state.last_packet.route[i+1]));
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
        selected = {kind: 'link', id: el.dataset.source, other: el.dataset.target};
        renderInspector();
      }
    });
  });
  nodeLayer.querySelectorAll('[data-id]').forEach(el=>bindNode(el));
  $('backendName').textContent=state.name;
  $('topologyName').textContent=state.name;
  $('clock').textContent=clock(state.time);
  $('statSent').textContent=Math.round(state.metrics.sent); $('statDelivered').textContent=Math.round(state.metrics.delivered); $('statDropped').textContent=Math.round(state.metrics.dropped); $('statPdr').textContent=`${fmt(state.metrics.pdr,1)}%`; $('statLatency').textContent=`${fmt(state.metrics.latency,1)} ms`; $('statRouteChanges').textContent=state.metrics.route_changes;
  const q=state.queue||{}; $('queueLength').textContent=`${Math.round(q.length||0)} packets`; $('queueWait').textContent=`${fmt((q.average_wait||0)*1000,1)} ms average wait`; $('flowCount').textContent=`${state.flows?.length||0} active flows`; $('queueBar').style.width=`${Math.min(100,(q.length||0)*10)}%`;
  if (state.last_packet && state.last_packet.id!==lastPacketId) animatePacket(state.last_packet);
  lastPacketId=state.last_packet?.id || null;
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
    const point=canvasPoint(e); drag={id,dx:point.x-state.devices.find(d=>d.id===id).x,dy:point.y-state.devices.find(d=>d.id===id).y,moved:false}; el.setPointerCapture?.(e.pointerId); selected={kind:'device',id}; renderInspector();
  });
  el.addEventListener('pointermove',(e)=>{if(!drag||drag.id!==id)return;const p=canvasPoint(e);let x=p.x-drag.dx,y=p.y-drag.dy;if($('snapToggle').checked){x=Math.round(x/16)*16;y=Math.round(y/16)*16;}drag.moved=true;el.setAttribute('transform',`translate(${x},${y})`);origin={x,y};});
  el.addEventListener('pointerup',async()=>{if(!drag||drag.id!==id)return;const d=drag;drag=null;if(d.moved) await api('move_device',{id,x:origin.x,y:origin.y}); else renderInspector();});
  el.addEventListener('click',(e)=>{e.stopPropagation();if(mode==='select'&&!drag){selected={kind:'device',id};renderInspector();}});
}
function canvasPoint(event) { const point=canvas.createSVGPoint(); point.x=event.clientX;point.y=event.clientY; return point.matrixTransform(canvas.getScreenCTM().inverse()); }
function animatePacket(packet) {
  const route=packet.route||[]; if(route.length<2)return; const points=route.map(id=>state.devices.find(d=>d.id===id)).filter(Boolean); if(points.length<2)return;
  const id=`packetPath-${packet.id}-${Date.now()}`; const d=points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' '); const color=packet.status==='DROPPED'?'#f16c7a':COLORS[packet.traffic_type]||'#56d9e8';
  packetLayer.insertAdjacentHTML('beforeend',`<path id="${id}" d="${d}" fill="none" stroke="none"/><g class="packet ${packet.status==='DROPPED'?'dropped':''}" data-packet="${packet.id}" style="color:${color}"><circle class="packet-ring" r="8"/><circle class="packet-core" r="3"/><text class="packet-label" y="-13">P${packet.id}</text><animateMotion dur="${Math.max(900,route.length*430)}ms" repeatCount="1" fill="freeze"><mpath href="#${id}"/></animateMotion></g>`);
  packetLayer.querySelectorAll('[data-packet]').forEach(el=>el.addEventListener('click',()=>{selected={kind:'packet',data:packet};renderInspector();}));
  setTimeout(()=>{const el=document.getElementById(id);if(el)el.remove();},Math.max(1000,route.length*430)+300);
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
function packetInspector(packet){return `<div class="device-hero"><div class="device-symbol" style="color:${COLORS[packet.traffic_type]||'#56d9e8'}">●</div><div><b>Packet #${packet.id}</b><span>${esc(packet.status)} · ${esc(packet.traffic_type)}</span></div></div><div class="inspector-section">${property('Source',packet.source)}${property('Destination',packet.destination)}${property('Protocol','IP / ICMP')}${property('TTL',packet.ttl)}${property('Size',`${packet.size} bytes`)}${property('Latency',packet.latency==null?'pending':`${fmt(packet.latency*1000,2)} ms`)}${property('Next hop',packet.next_hop||'—')}${property('Route',(packet.route||[]).join(' → '))}</div><div class="inspector-section"><div class="section-title">Event history</div>${(packet.events||[]).map(e=>`<div class="timeline-item" style="grid-template-columns:58px 1fr;padding:5px 0"><span class="timeline-time">${clock(e.time)}</span><span>${esc(e.event)}</span></div>`).join('')||'<p class="hint">No packet events.</p>'}</div>`;}
function eventInspector(event){return `<div class="device-hero"><div class="device-symbol">!</div><div><b>${esc(event.event)}</b><span>${clock(event.time)} simulation time</span></div></div><div class="console-output">${esc(JSON.stringify(event,null,2))}</div>`;}
function labSettings(){
  const routing=state.routing||{},qos=state.qos||{},weights=routing.weights||{},classes=Object.keys(qos.priorities||{});
  const routingFields=Object.entries(weights).map(([name,value])=>`<label>${esc(name)}<input data-routing-weight="${esc(name)}" type="number" min="0" step="0.1" value="${value}"/></label>`).join('');
  const classFields=classes.map(name=>`<div class="policy-row"><b>${esc(name)}</b><label>Priority<input data-priority="${esc(name)}" type="number" step="0.1" value="${qos.priorities[name]}"/></label><label>WFQ weight<input data-weight="${esc(name)}" type="number" min="0.1" step="0.1" value="${(qos.weights||{})[name]||1}"/></label></div>`).join('');
  return `<div class="device-hero"><div class="device-symbol">⚙</div><div><b>Lab policies</b><span>Live engine configuration</span></div></div><div class="inspector-section"><div class="section-title">Routing</div><label>Algorithm<select id="routingAlgorithm"><option value="dijkstra" ${routing.algorithm==='dijkstra'?'selected':''}>Dijkstra</option><option value="bellman-ford" ${routing.algorithm==='bellman-ford'?'selected':''}>Bellman–Ford</option></select></label><div class="policy-grid">${routingFields}</div><button data-action="apply-routing">Apply routing policy</button></div><div class="inspector-section"><div class="section-title">Quality of Service</div><label>Scheduler<select id="schedulerSelect"><option value="fifo" ${qos.scheduler==='fifo'?'selected':''}>FIFO</option><option value="priority" ${qos.scheduler==='priority'?'selected':''}>Priority Queue</option><option value="wfq" ${qos.scheduler==='wfq'?'selected':''}>Weighted Fair Queuing</option></select></label><div class="policy-list">${classFields}</div><button data-action="apply-qos">Apply QoS policy</button></div>`;
}
function renderInspector(){let html=labSettings();if(selected?.kind==='device'){const d=state.devices.find(x=>x.id===selected.id);if(d)html=deviceInspector(d);}if(selected?.kind==='link'){const l=state.links.find(x=>key(x.source,x.target)===key(selected.id,selected.other));if(l)html=linkInspector(l);}if(selected?.kind==='packet')html=packetInspector(selected.data);if(selected?.kind==='event')html=eventInspector(selected.data);inspectorBody.innerHTML=html;bindInspectorActions();}
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
      if (action === 'console') { selected = {kind:'console', id:selected.id}; renderConsole(); }
    });
  });
}
function renderConsole(){const d=selected.id;inspectorBody.innerHTML=`<div class="device-hero"><div class="device-symbol">›_</div><div><b>${esc(d)} console</b><span>Real backend commands only</span></div></div><div class="console-output" id="consoleOutput">${esc(d)}&gt; _</div><div class="console-form"><input id="consoleInput" value="show interfaces"/><button data-console>Run</button></div><div class="button-row"><button data-action="close-console">Back to device</button></div>`;inspectorBody.querySelector('[data-console]').addEventListener('click',runConsole);inspectorBody.querySelector('[data-action="close-console"]').addEventListener('click',()=>{selected={kind:'device',id:d};renderInspector();});}
async function runConsole(){const command=$('consoleInput').value;const output=$('consoleOutput');output.textContent+=`\n${command}`;try{const result=await api('console',{id:selected.id,command});output.textContent+=`\n${result.state.output}`;}catch(error){output.textContent+=`\n${error.message}`;}}
function setMode(next){mode=next;connectStart=null;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));toast(`${next[0].toUpperCase()+next.slice(1)} tool active`);}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
document.querySelectorAll('[data-menu]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.menu;if(action==='file'){$('newBtn').click();}else if(action==='simulation'){$('playBtn').click();}else if(action==='view'){$('fitBtn').click();$('gridToggle').checked=!$('gridToggle').checked;renderCanvas();}else{toast('Build a topology, connect devices, start traffic, then inject faults to observe self-healing.');}}));
document.querySelectorAll('.palette-item').forEach(item=>item.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',item.dataset.type)));
canvas.addEventListener('dragover',e=>e.preventDefault());canvas.addEventListener('drop',e=>{e.preventDefault();const type=e.dataTransfer.getData('text/plain');if(type) {const p=canvasPoint(e);api('add_device',{type,x:p.x,y:p.y});}});
canvas.addEventListener('click',e=>{if(e.target===canvas||e.target.id==='gridRect'||e.target.id==='connectPreview'){selected=null;connectStart=null;connectPreview.setAttribute('d','');renderInspector();}});
canvas.addEventListener('pointermove',e=>{if(connectStart&&state){const from=state.devices.find(d=>d.id===connectStart),p=canvasPoint(e);if(from)connectPreview.setAttribute('d',`M ${from.x} ${from.y} L ${p.x} ${p.y}`);}});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.65,Math.min(1.5,zoom+(e.deltaY<0?.05:-.05)));canvas.style.transform=`scale(${zoom})`;},{passive:false});
$('gridToggle').addEventListener('change',renderCanvas);$('snapToggle').addEventListener('change',()=>{});
$('clearSelection').addEventListener('click',()=>{selected=null;renderInspector();});
$('newBtn').addEventListener('click',()=>{if(confirm('Start a new blank network?'))api('new').then(()=>{selected=null;connectStart=null;renderInspector();});});
$('presetSelect').addEventListener('change',e=>api('load_preset',{preset:e.target.value}).then(()=>{selected=null;connectStart=null;renderInspector();}));
$('saveBtn').addEventListener('click',async()=>{const data=await api('export');const blob=new Blob([JSON.stringify(data.state.document,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='netadapt-lab.json';a.click();URL.revokeObjectURL(a.href);toast('Topology saved');});
$('openBtn').addEventListener('click',()=>$('fileInput').click());$('fileInput').addEventListener('change',async e=>{const file=e.target.files[0];if(file)api('import',{document:JSON.parse(await file.text())});e.target.value='';});
$('undoBtn').addEventListener('click',()=>api('undo'));$('redoBtn').addEventListener('click',()=>api('redo'));
$('playBtn').addEventListener('click',async()=>{await api('running',{value:true});play();});$('pauseBtn').addEventListener('click',()=>{stop();api('running',{value:false});});$('stopBtn').addEventListener('click',()=>{stop();api('running',{value:false});});$('stepBtn').addEventListener('click',()=>api('step'));$('resetBtn').addEventListener('click',()=>{stop();api('reset');});$('speedSelect').addEventListener('change',e=>api('speed',{value:Number(e.target.value)}));
$('fitBtn').addEventListener('click',()=>{if(!state.devices.length)return;const xs=state.devices.map(d=>d.x),ys=state.devices.map(d=>d.y),minX=Math.min(...xs)-100,maxX=Math.max(...xs)+100,minY=Math.min(...ys)-100,maxY=Math.max(...ys)+100;canvas.setAttribute('viewBox',`${minX} ${minY} ${maxX-minX} ${maxY-minY}`);});
async function play(){stop();playTimer=setInterval(async()=>{if(!state?.running){stop();return;}try{await api('step');}catch(e){stop();}},Math.max(120,600/(state?.speed||1)));}function stop(){if(playTimer)clearInterval(playTimer);playTimer=null;}
document.addEventListener('keydown',e=>{if((e.key==='Delete'||e.key==='Backspace')&&selected?.kind==='device'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();api('delete_device',{id:selected.id});}if(e.key==='Escape'){selected=null;connectStart=null;renderInspector();}});
loadState().catch(e=>toast(e.message,true));
