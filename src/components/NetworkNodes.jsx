import React from 'react';

/**
 * Realistic 3D Networking Hardware in Isometric Perspective.
 * Modeled with precise proportions, neutral studio lighting, material shaders,
 * tactile hardware details (RJ45 ports, SFP+ transceivers, drive bays, rack ears),
 * specular edge chamfers, and multi-layered contact shadows.
 */

export function DeviceGradients() {
  return (
    <defs>
      {/* Studio Key Light from top-left */}
      <linearGradient id="chassisTopAlum" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="30%" stopColor="#F8FAFC" />
        <stop offset="70%" stopColor="#E2E8F0" />
        <stop offset="100%" stopColor="#CBD5E1" />
      </linearGradient>

      {/* Dark Matte Enterprise Chassis Top */}
      <linearGradient id="chassisTopDark" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="40%" stopColor="#1E293B" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>

      {/* Front Face Neutral Studio Fill */}
      <linearGradient id="frontFascia" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#1E293B" />
        <stop offset="50%" stopColor="#0F172A" />
        <stop offset="100%" stopColor="#020617" />
      </linearGradient>

      {/* Side Face Ambient Shadow */}
      <linearGradient id="sideShadow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0F172A" />
        <stop offset="100%" stopColor="#020617" />
      </linearGradient>

      {/* Monitor Display Glass Anti-Reflective Sheen */}
      <linearGradient id="displayGlass" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0B1329" />
        <stop offset="60%" stopColor="#030712" />
        <stop offset="100%" stopColor="#020617" />
      </linearGradient>

      {/* Soft Studio Contact Shadow Filter */}
      <filter id="studioShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" />
        <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.14 0" />
        <feBlend in="SourceGraphic" in2="blurOut" mode="normal" />
      </filter>
    </defs>
  );
}

/**
 * 3D Client Workstation PC (Ultra-thin monitor, cast aluminum stand, mechanical keyboard & mouse)
 */
export function PCNode3D({ x, y, label, ip, active = false }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="cursor-pointer select-none group">
      {/* Multi-layered Soft Contact Shadow */}
      <ellipse cx="0" cy="34" rx="34" ry="9" fill="#000000" fillOpacity="0.06" filter="url(#studioShadow)" />
      <ellipse cx="0" cy="33" rx="22" ry="5.5" fill="#000000" fillOpacity="0.10" />

      {/* 3D Slim Keyboard on Desk */}
      <g transform="translate(-18, 22)">
        {/* Base plate */}
        <polygon points="0,5 22,-1 34,3 12,9" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="0.5" />
        <polygon points="0,5 12,9 12,10.5 0,6.5" fill="#94A3B8" />
        <polygon points="12,9 34,3 34,4.5 12,10.5" fill="#64748B" />
        {/* Keycap clusters */}
        <polygon points="3,5 10,3 13,4 6,6" fill="#334155" />
        <polygon points="11,3 18,1 21,2 14,4" fill="#334155" />
        <polygon points="19,1 26,-1 29,0 22,2" fill="#334155" />
        {/* Spacebar */}
        <line x1="8" y1="7.5" x2="20" y2="4.2" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
      </g>

      {/* 3D Mouse */}
      <ellipse cx="23" cy="26" rx="3.5" ry="2.2" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="0.5" />
      <line x1="23" y1="24.2" x2="23" y2="26" stroke="#94A3B8" strokeWidth="0.5" />

      {/* Cast Aluminum Stand Base & Pivot Stem */}
      <polygon points="-11,22 11,22 15,25.5 -7,25.5" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.5" />
      <polygon points="-7,25.5 15,25.5 15,27 -7,27" fill="#64748B" />
      {/* Vertical Column */}
      <polygon points="-2.5,11 2.5,11 3.5,22 -1.5,22" fill="#94A3B8" />
      <polygon points="2.5,11 3.5,11 4.5,22 3.5,22" fill="#64748B" />

      {/* 3D Widescreen Monitor Housing */}
      {/* Rear housing depth extrusion */}
      <polygon points="-28,-20 26,-26 30,-8 -24,-2" fill="#1E293B" stroke="#0F172A" strokeWidth="0.7" />
      {/* Top chamfer edge highlight */}
      <polygon points="-28,-20 26,-26 27,-24 -27,-18" fill="#64748B" />
      {/* Right side shadow */}
      <polygon points="26,-26 30,-8 28,-7 24,-25" fill="#0F172A" />
      
      {/* Front Screen Bezel */}
      <polygon
        points="-27,-18 25,-24 28,-7 -24,-1"
        fill="#0F172A"
        stroke={active ? '#FF5E1F' : '#020617'}
        strokeWidth={active ? '1.4' : '0.8'}
      />

      {/* Screen Inset Display (Anti-reflective glass) */}
      <polygon points="-25,-16 23,-21.5 26,-8.5 -22,-3" fill="url(#displayGlass)" />
      
      {/* Live Technical Console & Topology Waveform on Screen */}
      <line x1="-20" y1="-12" x2="2" y2="-17" stroke="#38BDF8" strokeWidth="1" strokeLinecap="round" />
      <line x1="-20" y1="-8" x2="-8" y2="-10.5" stroke="#4ADE80" strokeWidth="1" strokeLinecap="round" />
      <line x1="-20" y1="-4" x2="16" y2="-11.5" stroke={active ? '#FF5E1F' : '#94A3B8'} strokeWidth="1.2" strokeLinecap="round" />
      {/* Sub-pixel data grid lines */}
      <line x1="8" y1="-19" x2="22" y2="-16" stroke="#64748B" strokeWidth="0.6" strokeDasharray="1 1" />
      <line x1="8" y1="-16" x2="22" y2="-13" stroke="#64748B" strokeWidth="0.6" strokeDasharray="1 1" />

      {/* Power / Status Micro-LED on lower bezel */}
      <circle cx="25.5" cy="-5.5" r="0.9" fill={active ? '#FF5E1F' : '#10B981'} />

      {/* Technical Labels */}
      <text x="0" y="47" textAnchor="middle" className="font-sans text-[11px] font-semibold fill-ink-950">
        {label}
      </text>
      {ip && (
        <text x="0" y="58" textAnchor="middle" className="font-mono text-[9px] fill-ink-500">
          {ip}
        </text>
      )}
    </g>
  );
}

/**
 * 3D 1U Enterprise Switch (Dual 12-port RJ45 banks, SFP+ cages, rackmount ears, activity LEDs)
 */
export function SwitchNode3D({ x, y, label, ip, active = false }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="cursor-pointer select-none group">
      {/* Soft Contact Shadow */}
      <ellipse cx="0" cy="27" rx="38" ry="9" fill="#000000" fillOpacity="0.07" filter="url(#studioShadow)" />
      <ellipse cx="0" cy="26" rx="26" ry="5.5" fill="#000000" fillOpacity="0.10" />

      {/* 3D Rackmount Ears (Left & Right with countersunk screw holes) */}
      <polygon points="-36,1 -32,3 -32,14 -36,12" fill="#64748B" stroke="#475569" strokeWidth="0.5" />
      <circle cx="-34" cy="5.5" r="0.9" fill="#1E293B" />
      <circle cx="-34" cy="9.5" r="0.9" fill="#1E293B" />

      <polygon points="32,3 36,1 36,12 32,14" fill="#334155" stroke="#1E293B" strokeWidth="0.5" />
      <circle cx="34" cy="5.5" r="0.9" fill="#0F172A" />
      <circle cx="34" cy="9.5" r="0.9" fill="#0F172A" />

      {/* Chassis Top Lid (Studio Aluminum Highlight) */}
      <polygon
        points="-32,3 0,-13 32,3 0,19"
        fill="url(#chassisTopAlum)"
        stroke={active ? '#FF5E1F' : '#94A3B8'}
        strokeWidth={active ? '1.4' : '0.7'}
      />
      {/* Top Edge Specular Chamfer */}
      <line x1="-32" y1="3" x2="0" y2="-13" stroke="#FFFFFF" strokeWidth="0.8" />
      <line x1="0" y1="-13" x2="32" y2="3" stroke="#FFFFFF" strokeWidth="0.8" />

      {/* Front Face: High-Density Port Array */}
      <polygon
        points="-32,3 0,19 0,29 -32,13"
        fill="url(#frontFascia)"
        stroke="#0F172A"
        strokeWidth="0.8"
      />

      {/* Right Side: Ventilation Louvers */}
      <polygon
        points="0,19 32,3 32,13 0,29"
        fill="url(#sideShadow)"
        stroke="#0F172A"
        strokeWidth="0.8"
      />

      {/* 12-Port RJ45 Banks (Realistic port cavities with copper pins) */}
      {[-27, -22, -17, -12, -7].map((px, idx) => (
        <g key={idx} transform={`translate(${px}, ${6.5 + idx * 2.2})`}>
          {/* Upper Port */}
          <rect width="3.4" height="2.5" fill="#020617" stroke="#475569" strokeWidth="0.4" rx="0.3" />
          <line x1="0.8" y1="0.6" x2="2.6" y2="0.6" stroke="#F59E0B" strokeWidth="0.4" />
          {/* Lower Port */}
          <rect y="3.2" width="3.4" height="2.5" fill="#020617" stroke="#475569" strokeWidth="0.4" rx="0.3" />
          <line x1="0.8" y1="3.8" x2="2.6" y2="3.8" stroke="#F59E0B" strokeWidth="0.4" />
          {/* Green / Orange Link Activity LEDs */}
          <circle cx="1.7" cy="-1.4" r="0.6" fill={active ? '#FF5E1F' : '#10B981'} />
        </g>
      ))}

      {/* SFP+ 10G Optical Uplink Cages with Blue Wire Latches */}
      <g transform="translate(-2, 18.5)">
        <rect width="2.6" height="4.5" fill="#020617" stroke="#38BDF8" strokeWidth="0.5" rx="0.3" />
        <line x1="0.6" y1="1" x2="2" y2="1" stroke="#38BDF8" strokeWidth="0.4" />
      </g>

      {/* Side Ventilation Hex Slits */}
      <line x1="6" y1="18" x2="26" y2="8" stroke="#1E293B" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
      <line x1="6" y1="21" x2="26" y2="11" stroke="#1E293B" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
      <line x1="6" y1="24" x2="26" y2="14" stroke="#1E293B" strokeWidth="0.8" strokeDasharray="1.5 1.5" />

      {/* Technical Labels */}
      <text x="0" y="44" textAnchor="middle" className="font-sans text-[11px] font-semibold fill-ink-950">
        {label}
      </text>
      {ip && (
        <text x="0" y="55" textAnchor="middle" className="font-mono text-[9px] fill-ink-500">
          {ip}
        </text>
      )}
    </g>
  );
}

/**
 * 3D Modular Carrier Router (Routing direction engine glyph, line cards, optical LC transceivers)
 */
export function RouterNode3D({ x, y, label, ip, state = 'healthy', active = false }) {
  const isFailed = state === 'failed';

  return (
    <g transform={`translate(${x}, ${y})`} className="cursor-pointer select-none group">
      {/* Soft Contact Shadow */}
      <ellipse
        cx="0"
        cy="29"
        rx="36"
        ry="9"
        fill="#000000"
        fillOpacity={isFailed ? '0.04' : '0.08'}
        filter="url(#studioShadow)"
      />
      <ellipse cx="0" cy="28" rx="24" ry="5.5" fill="#000000" fillOpacity={isFailed ? '0.05' : '0.10'} />

      {/* Chassis Depth Extrusion */}
      <polygon
        points="-30,6 0,21 30,6 30,17 0,32 -30,17"
        fill={isFailed ? '#450A0A' : 'url(#frontFascia)'}
        stroke={isFailed ? '#991B1B' : '#0F172A'}
        strokeWidth="0.8"
      />

      {/* Front Left Shaded Line Card Face */}
      <polygon
        points="-30,6 0,21 0,32 -30,17"
        fill={isFailed ? '#7F1D1D' : '#1E293B'}
      />

      {/* Front Right Exhaust Face */}
      <polygon
        points="0,21 30,6 30,17 0,32"
        fill={isFailed ? '#450A0A' : '#0B132B'}
      />

      {/* Router Top Lid Plane */}
      <polygon
        points="-30,6 0,-9 30,6 0,21"
        fill={isFailed ? '#FEF2F2' : active ? '#F0FDF4' : 'url(#chassisTopAlum)'}
        stroke={isFailed ? '#EF4444' : active ? '#FF5E1F' : '#94A3B8'}
        strokeWidth={isFailed || active ? '1.5' : '0.8'}
      />
      {/* Edge highlight chamfer */}
      <line x1="-30" y1="6" x2="0" y2="-9" stroke="#FFFFFF" strokeWidth="0.8" />
      <line x1="0" y1="-9" x2="30" y2="6" stroke="#FFFFFF" strokeWidth="0.8" />

      {/* Routing Engine Geometric Vector Glyphs */}
      {isFailed ? (
        // Hardware Alarm Disconnect Cross
        <g stroke="#DC2626" strokeWidth="2.4" strokeLinecap="round">
          <line x1="-11" y1="2" x2="11" y2="10" />
          <line x1="11" y1="2" x2="-11" y2="10" />
        </g>
      ) : (
        // Dynamic Autonomous Routing Arrow Paths
        <g stroke={active ? '#FF5E1F' : '#045137'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <line x1="0" y1="-2" x2="0" y2="14" />
          <polyline points="-3.5,1 0,-2 3.5,1" />
          <polyline points="-3.5,11 0,14 3.5,11" />
          <line x1="-13" y1="3" x2="13" y2="9" />
          <polyline points="-10,2 -13,3 -11,5.5" />
          <polyline points="11,6.5 13,9 10,10" />
        </g>
      )}

      {/* Front Line Card Ports & Status Light Pipes */}
      <g transform="translate(-25, 11)">
        {/* Optical Transceiver LC Duplex Bay */}
        <rect x="2" y="3" width="5.5" height="3" fill="#020617" rx="0.3" stroke="#475569" strokeWidth="0.4" />
        <rect x="9.5" y="6.5" width="5.5" height="3" fill="#020617" rx="0.3" stroke="#475569" strokeWidth="0.4" />
        {/* Optical status indicator LED */}
        <circle cx="4.8" cy="1" r="1.1" fill={isFailed ? '#EF4444' : active ? '#FF5E1F' : '#045137'} />
        <circle cx="12.2" cy="4.5" r="0.9" fill={isFailed ? '#991B1B' : '#10B981'} />
      </g>

      {/* Technical Labels */}
      <text
        x="0"
        y="45"
        textAnchor="middle"
        className={`font-sans text-[11px] font-semibold ${isFailed ? 'fill-red-600' : 'fill-ink-950'}`}
      >
        {label}
      </text>
      {ip && (
        <text x="0" y="56" textAnchor="middle" className="font-mono text-[9px] fill-ink-500">
          {ip}
        </text>
      )}
    </g>
  );
}

/**
 * 3D 2U Enterprise Rack Server (Hot-swap SAS/NVMe drive bays with latches, status LCD, dual power)
 */
export function ServerNode3D({ x, y, label, ip, active = false }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="cursor-pointer select-none group">
      {/* Soft Contact Shadow */}
      <ellipse cx="0" cy="31" rx="38" ry="9" fill="#000000" fillOpacity="0.08" filter="url(#studioShadow)" />
      <ellipse cx="0" cy="30" rx="26" ry="6" fill="#000000" fillOpacity="0.10" />

      {/* Lower Chassis Box Extrusion */}
      <polygon
        points="-30,0 0,15 30,0 30,17 0,32 -30,17"
        fill="url(#frontFascia)"
        stroke="#0F172A"
        strokeWidth="0.8"
      />

      {/* Top Brushed Steel Cover Plate */}
      <polygon
        points="-30,0 0,-15 30,0 0,15"
        fill="url(#chassisTopAlum)"
        stroke={active ? '#FF5E1F' : '#94A3B8'}
        strokeWidth={active ? '1.4' : '0.8'}
      />
      {/* Specular edge chamfers */}
      <line x1="-30" y1="0" x2="0" y2="-15" stroke="#FFFFFF" strokeWidth="0.8" />
      <line x1="0" y1="-15" x2="30" y2="0" stroke="#FFFFFF" strokeWidth="0.8" />

      {/* Front Face: Hot-Swap SAS/NVMe Drive Bays */}
      <polygon
        points="-30,0 0,15 0,32 -30,17"
        fill="#1E293B"
        stroke="#0F172A"
        strokeWidth="0.8"
      />

      {/* Right Face: Exhaust Fans */}
      <polygon
        points="0,15 30,0 30,17 0,32"
        fill="url(#sideShadow)"
        stroke="#0F172A"
        strokeWidth="0.8"
      />

      {/* Hot-Swap Drive Caddies with Spring Latches & Activity Light Pipes */}
      {/* Bay 1 */}
      <polygon points="-26,2.5 -16,7.5 -16,13.5 -26,8.5" fill="#334155" stroke="#0F172A" strokeWidth="0.5" />
      <rect x="-24" y="5.5" width="6" height="1.1" fill="#94A3B8" rx="0.3" />
      <circle cx="-18" cy="10.5" r="0.7" fill="#10B981" />

      {/* Bay 2 */}
      <polygon points="-14,8.5 -4,13.5 -4,19.5 -14,14.5" fill="#334155" stroke="#0F172A" strokeWidth="0.5" />
      <rect x="-12" y="11.5" width="6" height="1.1" fill="#94A3B8" rx="0.3" />
      <circle cx="-6" cy="16.5" r="0.7" fill={active ? '#FF5E1F' : '#10B981'} />

      {/* Bay 3 (Lower row) */}
      <polygon points="-26,10.5 -16,15.5 -16,21.5 -26,16.5" fill="#334155" stroke="#0F172A" strokeWidth="0.5" />
      <rect x="-24" y="13.5" width="6" height="1.1" fill="#94A3B8" rx="0.3" />
      <circle cx="-18" cy="18.5" r="0.7" fill="#10B981" />

      {/* System Status Cluster & Power LED */}
      <circle cx="-2" cy="17" r="1.1" fill={active ? '#FF5E1F' : '#045137'} />
      <circle cx="1" cy="18.5" r="0.8" fill="#38BDF8" />

      {/* Technical Labels */}
      <text x="0" y="46" textAnchor="middle" className="font-sans text-[11px] font-semibold fill-ink-950">
        {label}
      </text>
      {ip && (
        <text x="0" y="57" textAnchor="middle" className="font-mono text-[9px] fill-ink-500">
          {ip}
        </text>
      )}
    </g>
  );
}
