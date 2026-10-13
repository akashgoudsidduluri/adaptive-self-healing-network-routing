// NetAdapt Landing Page Interactivity & 3D Networking Graphics

document.addEventListener('DOMContentLoaded', () => {
  initHeroTopology();
  initFaultSimulation();
  initPathToggle();
  initQoSToggle();
  initMobileMenu();
});

// -------------------------------------------------------------
// 3D Isometric SVG Node Generators
// -------------------------------------------------------------
function generate3DNodeSVG(type, label, isDown = false) {
  // Common 3D isometric box projection helpers
  if (type === 'router') {
    return `
      <g class="node-group" style="cursor: pointer;">
        <!-- Base Shadow -->
        <ellipse cx="0" cy="24" rx="36" ry="14" fill="rgba(0,0,0,0.06)" />
        
        <!-- Router Cylindrical Isometric Chassis -->
        <!-- Bottom / Front curved body -->
        <path d="M -32,0 L -32,14 C -32,24 32,24 32,14 L 32,0 Z" 
              fill="${isDown ? '#991b1b' : '#1e293b'}" stroke="#0f172a" stroke-width="1.2" />
        
        <!-- Top Face -->
        <ellipse cx="0" cy="0" rx="32" ry="14" 
                 fill="${isDown ? '#ef4444' : '#334155'}" stroke="#0f172a" stroke-width="1.2" />
        <ellipse cx="0" cy="0" rx="26" ry="10" 
                 fill="${isDown ? '#b91c1c' : '#1e293b'}" />
        
        <!-- Cross Arrows Emblem (Networking Router Standard) -->
        <g stroke="${isDown ? '#fecaca' : '#38bdf8'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <line x1="-12" y1="0" x2="12" y2="0" />
          <line x1="0" y1="-5" x2="0" y2="5" />
          <polyline points="-8,-3 -12,0 -8,3" />
          <polyline points="8,-3 12,0 8,3" />
          <polyline points="-3,-3 0,-5 3,-3" />
          <polyline points="-3,3 0,5 3,3" />
        </g>
        
        <!-- Front Ports & Status LEDs -->
        <circle cx="-16" cy="12" r="2" fill="${isDown ? '#ef4444' : '#22c55e'}" />
        <circle cx="-10" cy="12" r="2" fill="${isDown ? '#ef4444' : '#22c55e'}" />
        <circle cx="-4" cy="12" r="2" fill="${isDown ? '#ef4444' : '#ff5e1f'}" />
        <rect x="4" y="9" width="6" height="5" rx="1" fill="#0f172a" stroke="#475569" stroke-width="0.8" />
        <rect x="13" y="9" width="6" height="5" rx="1" fill="#0f172a" stroke="#475569" stroke-width="0.8" />
        <rect x="22" y="9" width="6" height="5" rx="1" fill="#0f172a" stroke="#475569" stroke-width="0.8" />
        
        <!-- Label -->
        <text x="0" y="38" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="600" fill="#0f172a">${label}</text>
      </g>
    `;
  }

  if (type === 'switch') {
    return `
      <g class="node-group" style="cursor: pointer;">
        <!-- Base Shadow -->
        <polygon points="-36,20 0,34 36,20 0,6" fill="rgba(0,0,0,0.06)" />
        
        <!-- 3D Isometric Switch Box -->
        <!-- Left Face -->
        <polygon points="-34,0 0,16 0,26 -34,10" fill="${isDown ? '#7f1d1d' : '#0f172a'}" stroke="#020617" stroke-width="1.2" />
        <!-- Right Face with 8 Ports -->
        <polygon points="0,16 34,0 34,10 0,26" fill="${isDown ? '#991b1b' : '#1e293b'}" stroke="#020617" stroke-width="1.2" />
        <!-- Top Face -->
        <polygon points="0,-6 34,0 0,16 -34,0" fill="${isDown ? '#ef4444' : '#334155'}" stroke="#020617" stroke-width="1.2" />
        
        <!-- Switch Port Row on Right Face -->
        <g fill="#020617">
          <rect x="4" y="14" width="4" height="4" rx="0.5" transform="skewY(-25)" />
          <rect x="10" y="11.5" width="4" height="4" rx="0.5" transform="skewY(-25)" />
          <rect x="16" y="9" width="4" height="4" rx="0.5" transform="skewY(-25)" />
          <rect x="22" y="6.5" width="4" height="4" rx="0.5" transform="skewY(-25)" />
        </g>
        
        <!-- Port Activity LEDs -->
        <circle cx="5" cy="18" r="1.3" fill="${isDown ? '#ef4444' : '#22c55e'}" />
        <circle cx="11" cy="15" r="1.3" fill="${isDown ? '#ef4444' : '#22c55e'}" />
        <circle cx="17" cy="12" r="1.3" fill="${isDown ? '#ef4444' : '#ff5e1f'}" />
        <circle cx="23" cy="9" r="1.3" fill="${isDown ? '#ef4444' : '#22c55e'}" />
        
        <!-- Label -->
        <text x="0" y="42" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="600" fill="#0f172a">${label}</text>
      </g>
    `;
  }

  if (type === 'server') {
    return `
      <g class="node-group" style="cursor: pointer;">
        <!-- Base Shadow -->
        <polygon points="-28,26 0,38 28,26 0,14" fill="rgba(0,0,0,0.06)" />
        
        <!-- Tower / Rack Unit (Tall Isometric Cube) -->
        <!-- Left Face -->
        <polygon points="-24,-24 0,-12 0,22 -24,10" fill="${isDown ? '#7f1d1d' : '#1e293b'}" stroke="#0f172a" stroke-width="1.2" />
        <!-- Right Face (Front Bezel with Drives) -->
        <polygon points="0,-12 24,-24 24,10 0,22" fill="${isDown ? '#991b1b' : '#334155'}" stroke="#0f172a" stroke-width="1.2" />
        <!-- Top Face -->
        <polygon points="0,-32 24,-24 0,-12 -24,-24" fill="${isDown ? '#ef4444' : '#475569'}" stroke="#0f172a" stroke-width="1.2" />
        
        <!-- Drive Bays & LEDs -->
        <line x1="3" y1="-8" x2="20" y2="-17" stroke="#0f172a" stroke-width="2" />
        <line x1="3" y1="-1" x2="20" y2="-10" stroke="#0f172a" stroke-width="2" />
        <line x1="3" y1="6" x2="20" y2="-3" stroke="#0f172a" stroke-width="2" />
        <line x1="3" y1="13" x2="20" y2="4" stroke="#0f172a" stroke-width="2" />
        
        <circle cx="5" cy="-5" r="1.5" fill="${isDown ? '#ef4444' : '#045137'}" />
        <circle cx="5" cy="2" r="1.5" fill="${isDown ? '#ef4444' : '#22c55e'}" />
        <circle cx="5" cy="9" r="1.5" fill="${isDown ? '#ef4444' : '#ff5e1f'}" />
        
        <!-- Label -->
        <text x="0" y="44" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="600" fill="#0f172a">${label}</text>
      </g>
    `;
  }

  // Workstation PC / Laptop
  return `
    <g class="node-group" style="cursor: pointer;">
      <!-- Base Shadow -->
      <ellipse cx="0" cy="22" rx="26" ry="10" fill="rgba(0,0,0,0.06)" />
      
      <!-- 3D Monitor & Stand -->
      <path d="M -6,14 L 6,14 L 3,18 L -3,18 Z" fill="#475569" stroke="#1e293b" />
      <polygon points="-10,18 10,18 14,21 -14,21" fill="#64748b" />
      
      <!-- Monitor Frame -->
      <polygon points="-22,-14 22,-14 22,12 -22,12" rx="2" fill="#0f172a" stroke="#020617" stroke-width="1.2" />
      <!-- Screen Display -->
      <polygon points="-19,-11 19,-11 19,9 -19,9" fill="${isDown ? '#450a0a' : '#045137'}" />
      
      <!-- Screen Content (Terminal / Wave) -->
      <line x1="-15" y1="-5" x2="-2" y2="-5" stroke="${isDown ? '#f87171' : '#4ade80'}" stroke-width="1.5" />
      <line x1="-15" y1="0" x2="6" y2="0" stroke="${isDown ? '#f87171' : '#4ade80'}" stroke-width="1.5" />
      <line x1="-15" y1="5" x2="-8" y2="5" stroke="${isDown ? '#f87171' : '#ff5e1f'}" stroke-width="1.5" />
      
      <!-- Label -->
      <text x="0" y="38" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="600" fill="#0f172a">${label}</text>
    </g>
  `;
}

// -------------------------------------------------------------
// Interactive Hero Topology Canvas
// -------------------------------------------------------------
let isFaultInjected = false;

function initHeroTopology() {
  const container = document.getElementById('heroTopologySvg');
  if (!container) return;
  renderTopology();
}

function renderTopology() {
  const container = document.getElementById('heroTopologySvg');
  if (!container) return;

  // Node coordinates (W: 580, H: 380)
  const nodes = {
    PC1: { x: 70, y: 190, type: 'pc', label: 'Client-1' },
    R1: { x: 190, y: 110, type: 'router', label: 'Router-R1' },
    R2: { x: 190, y: 270, type: 'router', label: 'Router-R2 (Alt)' },
    SW1: { x: 380, y: 110, type: 'switch', label: 'Core-SW1' },
    SW2: { x: 380, y: 270, type: 'switch', label: 'Bypass-SW2' },
    SRV: { x: 500, y: 190, type: 'server', label: 'App-Server' },
  };

  // Determine active route paths based on fault state
  // Normal state: PC1 -> R1 -> SW1 -> SRV (Primary Path Alpha)
  // Fault state: Link R1-SW1 is DOWN! Packets reroute PC1 -> R2 -> SW2 -> SRV (Self-Healing Path Beta)
  
  const linkR1_SW1_down = isFaultInjected;
  
  let svgContent = `
    <!-- SVG Defs for Gradients & Markers -->
    <defs>
      <linearGradient id="linkActive" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ff5e1f" />
        <stop offset="100%" stop-color="#ff7830" />
      </linearGradient>
      <linearGradient id="linkHealed" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#045137" />
        <stop offset="100%" stop-color="#10b981" />
      </linearGradient>
      <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.08" />
      </filter>
    </defs>

    <!-- Background Links / Physical Topology -->
    <g class="topology-links">
      <!-- Link PC1 -> R1 -->
      <line x1="${nodes.PC1.x}" y1="${nodes.PC1.y}" x2="${nodes.R1.x}" y2="${nodes.R1.y}" 
            stroke="${!linkR1_SW1_down ? '#ff5e1f' : '#94a3b8'}" stroke-width="2.5" 
            class="${!linkR1_SW1_down ? 'packet-link packet-link-orange' : ''}" />
      
      <!-- Link PC1 -> R2 (Secondary Link) -->
      <line x1="${nodes.PC1.x}" y1="${nodes.PC1.y}" x2="${nodes.R2.x}" y2="${nodes.R2.y}" 
            stroke="${linkR1_SW1_down ? '#045137' : '#e2e8f0'}" stroke-width="2.5" 
            class="${linkR1_SW1_down ? 'packet-link packet-link-forest' : ''}" />

      <!-- Link R1 -> SW1 (PRIMARY PATH - FAULT TARGET) -->
      ${linkR1_SW1_down ? `
        <!-- Broken Link: Red Dashed Line with Alert Cross -->
        <line x1="${nodes.R1.x}" y1="${nodes.R1.y}" x2="${nodes.SW1.x}" y2="${nodes.SW1.y}" 
              stroke="#ef4444" stroke-width="2.5" stroke-dasharray="6 6" opacity="0.8" />
        <g transform="translate(${(nodes.R1.x + nodes.SW1.x)/2}, ${(nodes.R1.y + nodes.SW1.y)/2})">
          <circle cx="0" cy="0" r="11" fill="#fee2e2" stroke="#ef4444" stroke-width="1.5" />
          <line x1="-4" y1="-4" x2="4" y2="4" stroke="#b91c1c" stroke-width="2" stroke-linecap="round" />
          <line x1="4" y1="-4" x2="-4" y2="4" stroke="#b91c1c" stroke-width="2" stroke-linecap="round" />
          <text x="0" y="22" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="700" fill="#b91c1c">FAULT: LINK DOWN</text>
        </g>
      ` : `
        <!-- Normal Active Link -->
        <line x1="${nodes.R1.x}" y1="${nodes.R1.y}" x2="${nodes.SW1.x}" y2="${nodes.SW1.y}" 
              stroke="#ff5e1f" stroke-width="3" class="packet-link packet-link-orange" />
      `}

      <!-- Link R2 -> SW2 (SELF-HEALING BYPASS) -->
      <line x1="${nodes.R2.x}" y1="${nodes.R2.y}" x2="${nodes.SW2.x}" y2="${nodes.SW2.y}" 
            stroke="${linkR1_SW1_down ? '#045137' : '#e2e8f0'}" stroke-width="${linkR1_SW1_down ? '3' : '2'}" 
            class="${linkR1_SW1_down ? 'packet-link packet-link-forest' : ''}" />

      <!-- Cross Link R1 <-> R2 -->
      <line x1="${nodes.R1.x}" y1="${nodes.R1.y}" x2="${nodes.R2.x}" y2="${nodes.R2.y}" 
            stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4 4" />

      <!-- Cross Link SW1 <-> SW2 -->
      <line x1="${nodes.SW1.x}" y1="${nodes.SW1.y}" x2="${nodes.SW2.x}" y2="${nodes.SW2.y}" 
            stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4 4" />

      <!-- Link SW1 -> SRV -->
      <line x1="${nodes.SW1.x}" y1="${nodes.SW1.y}" x2="${nodes.SRV.x}" y2="${nodes.SRV.y}" 
            stroke="${!linkR1_SW1_down ? '#ff5e1f' : '#94a3b8'}" stroke-width="2.5" 
            class="${!linkR1_SW1_down ? 'packet-link packet-link-orange' : ''}" />

      <!-- Link SW2 -> SRV -->
      <line x1="${nodes.SW2.x}" y1="${nodes.SW2.y}" x2="${nodes.SRV.x}" y2="${nodes.SRV.y}" 
            stroke="${linkR1_SW1_down ? '#045137' : '#e2e8f0'}" stroke-width="2.5" 
            class="${linkR1_SW1_down ? 'packet-link packet-link-forest' : ''}" />
    </g>

    <!-- Node Elements with Isometric 3D Projection -->
    <g class="topology-nodes">
      ${Object.entries(nodes).map(([key, n]) => `
        <g transform="translate(${n.x}, ${n.y})">
          ${generate3DNodeSVG(n.type, n.label, (key === 'R1' && linkR1_SW1_down))}
        </g>
      `).join('')}
    </g>
  `;

  container.innerHTML = svgContent;

  // Update header status & footer telemetry
  const statusBadge = document.getElementById('heroStatusBadge');
  const pathStat = document.getElementById('heroActivePath');
  const latencyStat = document.getElementById('heroLatencyStat');
  const pdrStat = document.getElementById('heroPdrStat');

  if (statusBadge) {
    if (isFaultInjected) {
      statusBadge.className = 'status-pill status-fault';
      statusBadge.textContent = 'FAULT DETECTED · REROUTED';
    } else {
      statusBadge.className = 'status-pill status-live';
      statusBadge.textContent = 'NORMAL OPERATION · OPTIMAL';
    }
  }

  if (pathStat) {
    pathStat.textContent = isFaultInjected ? 'Path Beta (R2 → SW2)' : 'Path Alpha (R1 → SW1)';
    pathStat.style.color = isFaultInjected ? 'var(--forest)' : 'var(--orange)';
  }

  if (latencyStat) {
    latencyStat.textContent = isFaultInjected ? '16.4 ms (Self-Healed)' : '11.8 ms (Primary)';
  }

  if (pdrStat) {
    pdrStat.textContent = isFaultInjected ? '99.8% (0.2s reconverge)' : '100% (Lossless)';
  }
}

// -------------------------------------------------------------
// Interactive Fault Simulation Handlers
// -------------------------------------------------------------
function initFaultSimulation() {
  const faultBtn = document.getElementById('btnSimulateFault');
  const restoreBtn = document.getElementById('btnRestoreFault');

  if (faultBtn) {
    faultBtn.addEventListener('click', () => {
      isFaultInjected = true;
      faultBtn.classList.add('active');
      if (restoreBtn) restoreBtn.classList.remove('active');
      renderTopology();
    });
  }

  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => {
      isFaultInjected = false;
      if (faultBtn) faultBtn.classList.remove('active');
      restoreBtn.classList.add('active');
      renderTopology();
    });
  }
}

// -------------------------------------------------------------
// Path Alpha vs Beta Comparison Toggle
// -------------------------------------------------------------
function initPathToggle() {
  const btnAlpha = document.getElementById('btnPathAlpha');
  const btnBeta = document.getElementById('btnPathBeta');
  const pathDetail = document.getElementById('pathDetailText');

  if (!btnAlpha || !btnBeta || !pathDetail) return;

  btnAlpha.addEventListener('click', () => {
    btnAlpha.classList.add('active');
    btnBeta.classList.remove('active');
    pathDetail.innerHTML = `
      <strong>Path Alpha (Primary)</strong> routes through Core Router R1. 
      Under normal load, latency is 11.8 ms with 0 hops penalty. Under heavy load, queue delay scales to 142 ms.
    `;
  });

  btnBeta.addEventListener('click', () => {
    btnBeta.classList.add('active');
    btnAlpha.classList.remove('active');
    pathDetail.innerHTML = `
      <strong>Path Beta (Adaptive Bypass)</strong> routes through Edge Router R2. 
      Dynamically absorbs burst traffic with 16.4 ms latency and zero packet loss.
    `;
  });
}

// -------------------------------------------------------------
// QoS Queue Scheduler Switcher
// -------------------------------------------------------------
function initQoSToggle() {
  const qosButtons = document.querySelectorAll('[data-qos-mode]');
  const fillVoice = document.querySelector('.fill-voice');
  const fillVideo = document.querySelector('.fill-video');
  const fillBest = document.querySelector('.fill-best');

  qosButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      qosButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.qosMode;

      if (mode === 'pq') {
        if (fillVoice) fillVoice.style.width = '10%';
        if (fillVideo) fillVideo.style.width = '45%';
        if (fillBest) fillBest.style.width = '85%';
      } else if (mode === 'wfq') {
        if (fillVoice) fillVoice.style.width = '30%';
        if (fillVideo) fillVideo.style.width = '40%';
        if (fillBest) fillBest.style.width = '55%';
      } else {
        // FIFO
        if (fillVoice) fillVoice.style.width = '65%';
        if (fillVideo) fillVideo.style.width = '65%';
        if (fillBest) fillBest.style.width = '65%';
      }
    });
  });
}

// -------------------------------------------------------------
// Mobile Menu Navigation Drawer
// -------------------------------------------------------------
function initMobileMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav-links');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isVisible = nav.style.display === 'flex';
      nav.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        nav.style.flexDirection = 'column';
        nav.style.position = 'absolute';
        nav.style.top = '72px';
        nav.style.left = '0';
        nav.style.right = '0';
        nav.style.background = '#ffffff';
        nav.style.padding = '20px';
        nav.style.borderBottom = '1px solid #e5e7eb';
        nav.style.gap = '16px';
      }
    });
  }
}
