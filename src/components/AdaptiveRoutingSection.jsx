import React, { useState, useEffect } from 'react';
import { RouterNode3D, SwitchNode3D, DeviceGradients } from './NetworkNodes';

export default function AdaptiveRoutingSection() {
  const [selectedPath, setSelectedPath] = useState('pathA'); // 'pathA' or 'pathB'
  const [progress, setProgress] = useState(0);

  // Smooth packet motion
  useEffect(() => {
    let animId;
    let start = performance.now();
    const duration = 2200;

    const tick = (now) => {
      const elapsed = (now - start) % duration;
      setProgress(elapsed / duration);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Compute packet position along chosen path in 3D coordinate space
  // Ingress: (60, 130)
  // Path A intermediate: (240, 65)
  // Path B intermediate: (240, 195)
  // Egress: (420, 130)
  const getCoord = (p, path) => {
    const isA = path === 'pathA';
    const mid = isA ? { x: 240, y: 65 } : { x: 240, y: 195 };
    const p0 = { x: 60, y: 130 };
    const p1 = mid;
    const p2 = { x: 420, y: 130 };

    const safeP = ((Number(p) % 1) + 1) % 1;

    if (safeP < 0.5) {
      const segP = safeP * 2;
      return {
        x: p0.x + (p1.x - p0.x) * segP,
        y: p0.y + (p1.y - p0.y) * segP,
      };
    } else {
      const segP = (safeP - 0.5) * 2;
      return {
        x: p1.x + (p2.x - p1.x) * segP,
        y: p1.y + (p2.y - p1.y) * segP,
      };
    }
  };

  const pkt1 = getCoord(progress, selectedPath);
  const pkt2 = getCoord((progress + 0.5) % 1, selectedPath);

  return (
    <section id="overview" className="py-20 md:py-28 border-b border-ink-200 bg-white">
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Heading, description, technical labels, route-comparison panel */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="text-[11px] uppercase tracking-wider font-mono text-forest font-semibold mb-3">
              02 / ADAPTIVE FORWARDING
            </div>
            
            <h2 className="text-[34px] sm:text-[38px] md:text-[42px] font-semibold tracking-[-0.025em] text-ink-950 leading-[1.15]">
              Real-time route adaptation under dynamic load.
            </h2>
            
            <p className="mt-4 text-[16px] md:text-[17px] text-ink-600 leading-relaxed">
              When transit queues surge past capacity thresholds, NetAdapt recalculates edge metrics and reroutes flows around congested nodes before packet drops occur.
            </p>

            {/* Technical Specifications */}
            <div className="mt-6 pt-6 border-t border-ink-200 space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-ink-600">
                <span className="uppercase">Cost Function</span>
                <span className="text-ink-900 font-medium">C = Hop_Delay + (Queue_Depth &times; 1.4)</span>
              </div>
              <div className="flex justify-between text-ink-600">
                <span className="uppercase">Sampling Interval</span>
                <span className="text-ink-900 font-medium">50ms high-resolution tick</span>
              </div>
              <div className="flex justify-between text-ink-600">
                <span className="uppercase">Flap Damping</span>
                <span className="text-forest font-medium">&Delta; &ge; 15% hysteresis dampening</span>
              </div>
            </div>

            {/* Compact Route-Comparison Panel */}
            <div className="mt-8 border border-ink-200 rounded-lg overflow-hidden bg-white">
              <div className="px-4 py-2.5 bg-ink-50 border-b border-ink-200 flex items-center justify-between text-xs font-mono">
                <span className="text-ink-600 uppercase text-[11px] font-medium">CANDIDATE ROUTE MATRIX</span>
                <span className="text-forest font-semibold text-[11px]">SELECT TO SWITCH</span>
              </div>
              
              <div className="p-3 space-y-2">
                {/* Route A Option */}
                <div
                  onClick={() => setSelectedPath('pathA')}
                  className={`p-3 rounded border cursor-pointer transition-all ${
                    selectedPath === 'pathA'
                      ? 'border-packet bg-packet-subtle'
                      : 'border-ink-200 bg-white hover:border-ink-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${selectedPath === 'pathA' ? 'bg-packet' : 'bg-ink-400'}`} />
                      <span className="font-mono text-xs font-semibold text-ink-900">
                        PATH ALPHA &bull; Core-North (10.0.1.0/24)
                      </span>
                    </div>
                    {selectedPath === 'pathA' && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-packet text-white font-medium">
                        FORWARDING
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-ink-600 mt-2">
                    <div>Latency: <strong className="text-ink-900">11.4ms</strong></div>
                    <div>Loss: <strong className="text-forest">0.00%</strong></div>
                    <div>Cost: <strong className="text-ink-900">14.2</strong></div>
                  </div>
                </div>

                {/* Route B Option */}
                <div
                  onClick={() => setSelectedPath('pathB')}
                  className={`p-3 rounded border cursor-pointer transition-all ${
                    selectedPath === 'pathB'
                      ? 'border-packet bg-packet-subtle'
                      : 'border-ink-200 bg-white hover:border-ink-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${selectedPath === 'pathB' ? 'bg-packet' : 'bg-ink-400'}`} />
                      <span className="font-mono text-xs font-semibold text-ink-900">
                        PATH BETA &bull; Core-South (10.0.2.0/24)
                      </span>
                    </div>
                    {selectedPath === 'pathB' && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-packet text-white font-medium">
                        FORWARDING
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-ink-600 mt-2">
                    <div>Latency: <strong className="text-ink-900">24.8ms</strong></div>
                    <div>Loss: <strong className="text-ink-600">0.02%</strong></div>
                    <div>Cost: <strong className="text-ink-900">28.6</strong></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Network diagram showing two paths with selected route highlighted in orange */}
          <div className="lg:col-span-7">
            <div className="border border-ink-200 rounded-lg bg-white overflow-hidden">
              <div className="px-4 py-2.5 bg-ink-50 border-b border-ink-200 flex items-center justify-between font-mono text-xs">
                <span className="text-ink-600 uppercase text-[11px]">3D MULTI-PATH TOPOLOGY</span>
                <span className="text-ink-900 font-semibold text-[11px]">
                  ACTIVE ROUTE: {selectedPath === 'pathA' ? 'ALPHA (TOP)' : 'BETA (BOTTOM)'}
                </span>
              </div>

              <div className="p-4 md:p-8 flex justify-center bg-white overflow-x-auto">
                <svg viewBox="0 0 480 270" className="w-full max-w-[480px] h-auto select-none" style={{ minWidth: '380px' }}>
                  <DeviceGradients />

                  {/* Studio floor guidelines */}
                  <line x1="30" y1="80" x2="450" y2="80" stroke="#F1F5F9" strokeWidth="0.8" strokeDasharray="3 3" />
                  <line x1="30" y1="145" x2="450" y2="145" stroke="#F1F5F9" strokeWidth="0.8" strokeDasharray="3 3" />
                  <line x1="30" y1="210" x2="450" y2="210" stroke="#F1F5F9" strokeWidth="0.8" strokeDasharray="3 3" />

                  {/* Path A Lines (Top branch) */}
                  <line
                    x1="60"
                    y1="130"
                    x2="240"
                    y2="65"
                    stroke={selectedPath === 'pathA' ? '#FF5E1F' : '#E2E8F0'}
                    strokeWidth={selectedPath === 'pathA' ? '2.2' : '1.2'}
                    strokeDasharray={selectedPath === 'pathA' ? 'none' : '3 3'}
                  />
                  <line
                    x1="240"
                    y1="65"
                    x2="420"
                    y2="130"
                    stroke={selectedPath === 'pathA' ? '#FF5E1F' : '#E2E8F0'}
                    strokeWidth={selectedPath === 'pathA' ? '2.2' : '1.2'}
                    strokeDasharray={selectedPath === 'pathA' ? 'none' : '3 3'}
                  />

                  {/* Path B Lines (Bottom branch) */}
                  <line
                    x1="60"
                    y1="130"
                    x2="240"
                    y2="195"
                    stroke={selectedPath === 'pathB' ? '#FF5E1F' : '#E2E8F0'}
                    strokeWidth={selectedPath === 'pathB' ? '2.2' : '1.2'}
                    strokeDasharray={selectedPath === 'pathB' ? 'none' : '3 3'}
                  />
                  <line
                    x1="240"
                    y1="195"
                    x2="420"
                    y2="130"
                    stroke={selectedPath === 'pathB' ? '#FF5E1F' : '#E2E8F0'}
                    strokeWidth={selectedPath === 'pathB' ? '2.2' : '1.2'}
                    strokeDasharray={selectedPath === 'pathB' ? 'none' : '3 3'}
                  />

                  {/* Route Latency Badges */}
                  <g transform="translate(140, 85)">
                    <rect x="-28" y="-9" width="56" height="18" rx="3" fill="#FFFFFF" stroke={selectedPath === 'pathA' ? '#FF5E1F' : '#E2E8F0'} strokeWidth="1" />
                    <text x="0" y="3" textAnchor="middle" className={`font-mono text-[9px] font-semibold ${selectedPath === 'pathA' ? 'fill-packet' : 'fill-ink-400'}`}>
                      11.4 ms
                    </text>
                  </g>

                  <g transform="translate(140, 175)">
                    <rect x="-28" y="-9" width="56" height="18" rx="3" fill="#FFFFFF" stroke={selectedPath === 'pathB' ? '#FF5E1F' : '#E2E8F0'} strokeWidth="1" />
                    <text x="0" y="3" textAnchor="middle" className={`font-mono text-[9px] font-semibold ${selectedPath === 'pathB' ? 'fill-packet' : 'fill-ink-400'}`}>
                      24.8 ms
                    </text>
                  </g>

                  {/* Packets traveling on chosen path */}
                  <circle cx={pkt1.x} cy={pkt1.y} r="3.5" fill="#FF5E1F" />
                  <circle cx={pkt1.x} cy={pkt1.y} r="1.2" fill="#FFFFFF" />

                  <circle cx={pkt2.x} cy={pkt2.y} r="3.5" fill="#FF5E1F" />
                  <circle cx={pkt2.x} cy={pkt2.y} r="1.2" fill="#FFFFFF" />

                  {/* 3D Hardware Nodes */}
                  <RouterNode3D x={60} y={130} label="Ingress (R-In)" ip="10.0.0.1" active={true} />

                  <RouterNode3D
                    x={240}
                    y={65}
                    label="Core-North"
                    ip="10.0.1.1"
                    active={selectedPath === 'pathA'}
                  />

                  <RouterNode3D
                    x={240}
                    y={195}
                    label="Core-South"
                    ip="10.0.2.1"
                    active={selectedPath === 'pathB'}
                  />

                  <RouterNode3D x={420} y={130} label="Egress (R-Out)" ip="10.0.3.1" active={true} />
                </svg>
              </div>

              {/* Sub-bar */}
              <div className="px-4 py-3 bg-ink-50 border-t border-ink-200 flex items-center justify-between text-xs font-mono">
                <span className="text-ink-600">SELECTION METRIC</span>
                <span className="text-forest font-semibold">LEAST-COST DIJKSTRA CONVERGED</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
