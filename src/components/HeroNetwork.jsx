import React, { useState, useEffect } from 'react';
import { PCNode3D, SwitchNode3D, RouterNode3D, ServerNode3D, DeviceGradients } from './NetworkNodes';
import { Activity, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function HeroNetwork() {
  const [faultSimulated, setFaultSimulated] = useState(false);
  const [packetProgress, setPacketProgress] = useState(0);

  // Smooth packet motion loop
  useEffect(() => {
    let animationFrame;
    let start = performance.now();
    const duration = 2800; // 2.8s loop

    const tick = (now) => {
      const elapsed = (now - start) % duration;
      setPacketProgress(elapsed / duration);
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  // 3D Path coordinates connecting device ports
  // Device centers:
  // PC: (60, 135) -> cable port around (75, 145)
  // SW1: (155, 135)
  // R_Alpha: (280, 75)
  // R_Beta: (280, 195)
  // R_Gamma: (405, 135)
  // SW2: (495, 135)
  // Server: (580, 135)
  const getPacketCoord = (progress, isAlternate) => {
    const points = isAlternate
      ? [
          { x: 60, y: 135 },
          { x: 155, y: 135 },
          { x: 280, y: 195 },
          { x: 405, y: 135 },
          { x: 495, y: 135 },
          { x: 580, y: 135 },
        ]
      : [
          { x: 60, y: 135 },
          { x: 155, y: 135 },
          { x: 280, y: 75 },
          { x: 405, y: 135 },
          { x: 495, y: 135 },
          { x: 580, y: 135 },
        ];

    const safeP = ((Number(progress) % 1) + 1) % 1;
    const totalSegments = points.length - 1;
    const scaled = safeP * totalSegments;
    const segIdx = Math.max(0, Math.min(Math.floor(scaled), totalSegments - 1));
    const segProgress = Math.max(0, Math.min(1, scaled - segIdx));

    const pA = points[segIdx] || points[0];
    const pB = points[segIdx + 1] || points[points.length - 1];

    if (!pA || !pB) return { x: 60, y: 135 };

    return {
      x: pA.x + (pB.x - pA.x) * segProgress,
      y: pA.y + (pB.y - pA.y) * segProgress,
    };
  };

  const packet1 = getPacketCoord(packetProgress, faultSimulated);
  const packet2 = getPacketCoord((packetProgress + 0.5) % 1, faultSimulated);

  return (
    <div className="w-full bg-white border border-ink-200 rounded-lg overflow-hidden flex flex-col">
      
      {/* Studio Header Bar */}
      <div className="px-4 py-2.5 bg-ink-50/80 border-b border-ink-200 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-forest"></span>
          <span className="font-mono uppercase tracking-wider text-[11px] font-semibold text-ink-900">
            3D TOPOLOGY &bull; CARRIER MESH
          </span>
          <span className="text-ink-500 font-mono text-[11px] hidden sm:inline">
            | 7 HARDWARE NODES
          </span>
        </div>

        <div>
          <button
            onClick={() => setFaultSimulated(!faultSimulated)}
            className={`text-[11px] font-mono px-2.5 py-1 rounded transition-colors flex items-center space-x-1.5 ${
              faultSimulated
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-white text-ink-800 border border-ink-200 hover:border-forest hover:text-forest'
            }`}
            title="Toggle link failure simulation"
          >
            {faultSimulated ? (
              <>
                <AlertTriangle className="w-3 h-3 text-red-600" />
                <span>LINK SEVERED (FAILOVER ACTIVE)</span>
              </>
            ) : (
              <>
                <Activity className="w-3 h-3 text-ink-500" />
                <span>SIMULATE LINK FAULT</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3D Network Diagram Canvas */}
      <div className="relative p-3 sm:p-5 md:p-6 bg-white overflow-x-auto flex justify-center">
        <svg
          viewBox="0 0 640 280"
          className="w-full max-w-[640px] h-auto select-none"
          style={{ minWidth: '480px' }}
        >
          {/* Gradients definitions */}
          <DeviceGradients />

          {/* Subtle Isometric Ground Grid */}
          <g stroke="#F1F5F9" strokeWidth="0.8">
            {/* Horizontal studio ground guidelines */}
            <line x1="20" y1="90" x2="620" y2="90" strokeDasharray="3 3" />
            <line x1="20" y1="150" x2="620" y2="150" strokeDasharray="3 3" />
            <line x1="20" y1="210" x2="620" y2="210" strokeDasharray="3 3" />
          </g>

          {/* Optical & Copper Network Links */}
          {/* Link: PC1 to SW1 */}
          <line
            x1="60"
            y1="135"
            x2="155"
            y2="135"
            stroke="#334155"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Primary Route: SW1 -> R-Alpha */}
          <line
            x1="155"
            y1="135"
            x2="280"
            y2="75"
            stroke={faultSimulated ? '#CBD5E1' : '#FF5E1F'}
            strokeWidth={faultSimulated ? '1.2' : '1.8'}
            strokeDasharray={faultSimulated ? '3 3' : 'none'}
          />

          {/* Link: R-Alpha -> R-Gamma (This link breaks during fault) */}
          <line
            x1="280"
            y1="75"
            x2="405"
            y2="135"
            stroke={faultSimulated ? '#EF4444' : '#FF5E1F'}
            strokeWidth={faultSimulated ? '1.8' : '1.8'}
            strokeDasharray={faultSimulated ? '4 3' : 'none'}
          />

          {/* Standby / Failover Route: SW1 -> R-Beta */}
          <line
            x1="155"
            y1="135"
            x2="280"
            y2="195"
            stroke={faultSimulated ? '#FF5E1F' : '#94A3B8'}
            strokeWidth={faultSimulated ? '1.8' : '1.2'}
            strokeDasharray={faultSimulated ? 'none' : '3 3'}
          />

          {/* Link: R-Beta -> R-Gamma */}
          <line
            x1="280"
            y1="195"
            x2="405"
            y2="135"
            stroke={faultSimulated ? '#FF5E1F' : '#94A3B8'}
            strokeWidth={faultSimulated ? '1.8' : '1.2'}
            strokeDasharray={faultSimulated ? 'none' : '3 3'}
          />

          {/* Cross Trunk: R-Alpha <-> R-Beta */}
          <line
            x1="280"
            y1="75"
            x2="280"
            y2="195"
            stroke="#CBD5E1"
            strokeWidth="1"
            strokeDasharray="2 3"
          />

          {/* Link: R-Gamma to SW2 */}
          <line
            x1="405"
            y1="135"
            x2="495"
            y2="135"
            stroke="#334155"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Link: SW2 to Server */}
          <line
            x1="495"
            y1="135"
            x2="580"
            y2="135"
            stroke="#334155"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Status Badges on Links */}
          {/* Failed Link Marker */}
          {faultSimulated && (
            <g transform="translate(345, 98)">
              <rect
                x="-36"
                y="-10"
                width="72"
                height="19"
                rx="3"
                fill="#FEF2F2"
                stroke="#FCA5A5"
                strokeWidth="1"
              />
              <text
                x="0"
                y="3"
                textAnchor="middle"
                className="font-mono text-[9px] font-bold fill-red-600"
              >
                LINK DOWN
              </text>
            </g>
          )}

          {/* Active Alternate Route Badge */}
          {faultSimulated ? (
            <g transform="translate(215, 172)">
              <rect
                x="-40"
                y="-9"
                width="80"
                height="18"
                rx="3"
                fill="#FFF3ED"
                stroke="#FFD4C2"
                strokeWidth="1"
              />
              <text
                x="0"
                y="3"
                textAnchor="middle"
                className="font-mono text-[9px] font-semibold fill-packet"
              >
                FAILOVER 10G-B
              </text>
            </g>
          ) : (
            <g transform="translate(215, 96)">
              <rect
                x="-38"
                y="-9"
                width="76"
                height="18"
                rx="3"
                fill="#F0FDF4"
                stroke="#BFE0D4"
                strokeWidth="1"
              />
              <text
                x="0"
                y="3"
                textAnchor="middle"
                className="font-mono text-[9px] font-semibold fill-forest"
              >
                PRIMARY 10G-A
              </text>
            </g>
          )}

          {/* Discrete Orange Packet Markers Moving Along Active Route */}
          <circle cx={packet1.x} cy={packet1.y} r="3.5" fill="#FF5E1F" />
          <circle cx={packet1.x} cy={packet1.y} r="1.2" fill="#FFFFFF" />

          <circle cx={packet2.x} cy={packet2.y} r="3.5" fill="#FF5E1F" />
          <circle cx={packet2.x} cy={packet2.y} r="1.2" fill="#FFFFFF" />

          {/* 3D Hardware Equipment Nodes */}
          {/* PC 1 (Workstation) */}
          <PCNode3D x={60} y={135} label="Client-01" ip="192.168.1.10" active={true} />

          {/* Switch 1 (Access Switch) */}
          <SwitchNode3D x={155} y={135} label="SW-Access" ip="10.0.0.2" active={true} />

          {/* Core Router Alpha (Primary) */}
          <RouterNode3D
            x={280}
            y={75}
            label="R-Alpha (Core)"
            ip="10.0.1.1"
            state={faultSimulated ? 'failed' : 'healthy'}
            active={!faultSimulated}
          />

          {/* Core Router Beta (Failover/Standby) */}
          <RouterNode3D
            x={280}
            y={195}
            label="R-Beta (Core)"
            ip="10.0.2.1"
            state="healthy"
            active={faultSimulated}
          />

          {/* Edge Gateway Router Gamma */}
          <RouterNode3D x={405} y={135} label="R-Gamma (GW)" ip="10.0.3.1" active={true} />

          {/* Switch 2 (Datacenter ToR) */}
          <SwitchNode3D x={495} y={135} label="SW-Cluster" ip="10.0.4.2" active={true} />

          {/* Enterprise Application Server */}
          <ServerNode3D x={580} y={135} label="App-Host" ip="192.168.20.50" active={true} />
        </svg>
      </div>

      {/* Telemetry Strip with Deep Forest Green Accent */}
      <div className="px-4 py-3 bg-ink-50/50 border-t border-ink-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="block text-[11px] uppercase tracking-wider font-mono text-ink-500">
            FORWARDING TRUNK
          </span>
          <span className="font-mono font-semibold text-[13px] text-ink-900 flex items-center space-x-1.5 mt-0.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                faultSimulated ? 'bg-packet' : 'bg-forest'
              }`}
            />
            <span>{faultSimulated ? 'CORE-BETA (FAILOVER)' : 'CORE-ALPHA (PRIMARY)'}</span>
          </span>
        </div>

        <div>
          <span className="block text-[11px] uppercase tracking-wider font-mono text-ink-500">
            ROUND-TRIP DELAY
          </span>
          <span className="font-mono font-semibold text-[13px] text-ink-900 mt-0.5 block">
            {faultSimulated ? '14.2 ms' : '11.8 ms'}
          </span>
        </div>

        <div>
          <span className="block text-[11px] uppercase tracking-wider font-mono text-ink-500">
            PACKET LOSS
          </span>
          <span className="font-mono font-semibold text-[13px] text-ink-900 mt-0.5 block">
            0.00% (Lossless FRR)
          </span>
        </div>

        <div>
          <span className="block text-[11px] uppercase tracking-wider font-mono text-ink-500">
            CONVERGENCE TIME
          </span>
          <span
            className={`font-mono font-semibold text-[13px] mt-0.5 block ${
              faultSimulated ? 'text-packet' : 'text-forest'
            }`}
          >
            {faultSimulated ? '18.4 ms (Self-Healed)' : 'STABLE (0.0 ms)'}
          </span>
        </div>
      </div>

    </div>
  );
}
