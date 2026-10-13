import React, { useState, useEffect } from 'react';
import { RouterNode3D, ServerNode3D, SwitchNode3D, DeviceGradients } from './NetworkNodes';
import { RotateCcw, Clock } from 'lucide-react';

export default function SelfHealingSection() {
  const [isBroken, setIsBroken] = useState(true);
  const [packetProgress, setPacketProgress] = useState(0);

  // Packet loop
  useEffect(() => {
    let animId;
    let start = performance.now();
    const duration = 2500;

    const tick = (now) => {
      const elapsed = (now - start) % duration;
      setPacketProgress(elapsed / duration);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Compute packet coordinates along path in 3D perspective
  // SW1: (60, 130)
  // R1 (Direct / Fails): (240, 65)
  // R2 (Failover / Alt): (240, 195)
  // SRV: (420, 130)
  const getPktCoord = (p, broken) => {
    const mid = broken ? { x: 240, y: 195 } : { x: 240, y: 65 };
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

  const pkt1 = getPktCoord(packetProgress, isBroken);
  const pkt2 = getPktCoord((packetProgress + 0.5) % 1, isBroken);

  return (
    <section id="how-it-works" className="py-20 md:py-28 border-b border-ink-200 bg-ink-50/40">
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Reversed Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: 3D Network Failure Diagram & Visual Animation */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div className="border border-ink-200 rounded-lg bg-white overflow-hidden">
              <div className="px-4 py-2.5 bg-ink-50 border-b border-ink-200 flex items-center justify-between font-mono text-xs">
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${isBroken ? 'bg-red-500' : 'bg-forest'}`} />
                  <span className="text-ink-900 uppercase font-semibold text-[11px]">
                    {isBroken ? 'STATUS: HARDWARE FAULT DETECTED' : 'STATUS: ALL ADJACENCIES UP'}
                  </span>
                </div>

                <button
                  onClick={() => setIsBroken(!isBroken)}
                  className="px-2.5 py-1 text-[11px] font-mono rounded border border-ink-200 bg-white hover:border-forest text-ink-800 transition-colors flex items-center space-x-1"
                >
                  <RotateCcw className="w-3 h-3 text-ink-500" />
                  <span>{isBroken ? 'RESTORE DIRECT LINK' : 'SEVER DIRECT LINK'}</span>
                </button>
              </div>

              <div className="p-4 md:p-8 flex justify-center bg-white overflow-x-auto">
                <svg viewBox="0 0 480 270" className="w-full max-w-[480px] h-auto select-none" style={{ minWidth: '380px' }}>
                  <DeviceGradients />

                  {/* Ground reference lines */}
                  <line x1="30" y1="80" x2="450" y2="80" stroke="#F1F5F9" strokeWidth="0.8" strokeDasharray="3 3" />
                  <line x1="30" y1="145" x2="450" y2="145" stroke="#F1F5F9" strokeWidth="0.8" strokeDasharray="3 3" />
                  <line x1="30" y1="210" x2="450" y2="210" stroke="#F1F5F9" strokeWidth="0.8" strokeDasharray="3 3" />

                  {/* Direct Link (Top Branch): SW1 -> R1 -> SRV */}
                  <line
                    x1="60"
                    y1="130"
                    x2="240"
                    y2="65"
                    stroke={isBroken ? '#CBD5E1' : '#FF5E1F'}
                    strokeWidth={isBroken ? '1.2' : '1.8'}
                    strokeDasharray={isBroken ? '3 3' : 'none'}
                  />
                  {/* Failing segment */}
                  <line
                    x1="240"
                    y1="65"
                    x2="420"
                    y2="130"
                    stroke={isBroken ? '#EF4444' : '#FF5E1F'}
                    strokeWidth="1.8"
                    strokeDasharray={isBroken ? '4 3' : 'none'}
                  />

                  {/* Alternative Link (Bottom Branch): SW1 -> R2 -> SRV */}
                  <line
                    x1="60"
                    y1="130"
                    x2="240"
                    y2="195"
                    stroke={isBroken ? '#FF5E1F' : '#CBD5E1'}
                    strokeWidth={isBroken ? '2' : '1.2'}
                    strokeDasharray={isBroken ? 'none' : '3 3'}
                  />
                  <line
                    x1="240"
                    y1="195"
                    x2="420"
                    y2="130"
                    stroke={isBroken ? '#FF5E1F' : '#CBD5E1'}
                    strokeWidth={isBroken ? '2' : '1.2'}
                    strokeDasharray={isBroken ? 'none' : '3 3'}
                  />

                  {/* Clearly Marked Failed Link Cross / Status */}
                  {isBroken && (
                    <g transform="translate(330, 92)">
                      <rect x="-38" y="-11" width="76" height="22" rx="3" fill="#FEF2F2" stroke="#FCA5A5" strokeWidth="1" />
                      <g stroke="#EF4444" strokeWidth="1.6" strokeLinecap="round">
                        <line x1="-30" y1="-3" x2="-22" y2="5" />
                        <line x1="-22" y1="-3" x2="-30" y2="5" />
                      </g>
                      <text x="5" y="4" textAnchor="middle" className="font-mono text-[9px] font-bold fill-red-600">
                        LINK DOWN
                      </text>
                    </g>
                  )}

                  {/* Active Alternative Route Badge */}
                  <g transform="translate(330, 168)">
                    <rect
                      x="-42"
                      y="-10"
                      width="84"
                      height="20"
                      rx="3"
                      fill={isBroken ? '#FFF3ED' : '#F8FAFC'}
                      stroke={isBroken ? '#FFD4C2' : '#E2E8F0'}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      className={`font-mono text-[9px] font-semibold ${
                        isBroken ? 'fill-packet' : 'fill-ink-500'
                      }`}
                    >
                      {isBroken ? 'REROUTED PATH' : 'STANDBY LINK'}
                    </text>
                  </g>

                  {/* Discrete Small Packets along active route */}
                  <circle cx={pkt1.x} cy={pkt1.y} r="3.5" fill="#FF5E1F" />
                  <circle cx={pkt1.x} cy={pkt1.y} r="1.2" fill="#FFFFFF" />

                  <circle cx={pkt2.x} cy={pkt2.y} r="3.5" fill="#FF5E1F" />
                  <circle cx={pkt2.x} cy={pkt2.y} r="1.2" fill="#FFFFFF" />

                  {/* 3D Hardware Nodes */}
                  <SwitchNode3D x={60} y={130} label="Ingress SW" ip="VLAN 100" active={true} />

                  <RouterNode3D
                    x={240}
                    y={65}
                    label="Core-Alpha"
                    ip="10.1.1.1"
                    state={isBroken ? 'failed' : 'healthy'}
                    active={!isBroken}
                  />

                  <RouterNode3D
                    x={240}
                    y={195}
                    label="Core-Backup"
                    ip="10.2.1.1"
                    state="healthy"
                    active={isBroken}
                  />

                  <ServerNode3D x={420} y={130} label="Target Host" ip="10.3.0.50" active={true} />
                </svg>
              </div>

              {/* Status footer with telemetry */}
              <div className="px-4 py-3 bg-ink-50 border-t border-ink-200 grid grid-cols-3 gap-2 font-mono text-center text-xs">
                <div>
                  <span className="text-[10px] text-ink-500 uppercase block">FAULT DETECTED</span>
                  <span className="text-[13px] font-semibold text-ink-900">3.2 ms</span>
                </div>
                <div>
                  <span className="text-[10px] text-ink-500 uppercase block">RECOVERY TIME</span>
                  <span className="text-[13px] font-semibold text-forest">18.4 ms</span>
                </div>
                <div>
                  <span className="text-[10px] text-ink-500 uppercase block">DROPPED FRAMES</span>
                  <span className="text-[13px] font-semibold text-forest">0 (Lossless FRR)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Heading, description, compact event timeline */}
          <div className="lg:col-span-5 order-1 lg:order-2 flex flex-col justify-center">
            <div className="text-[11px] uppercase tracking-wider font-mono text-forest font-semibold mb-3">
              03 / AUTONOMIC HEALING
            </div>

            <h2 className="text-[34px] sm:text-[38px] md:text-[42px] font-semibold tracking-[-0.025em] text-ink-950 leading-[1.15]">
              Sub-20ms link recovery without dropped frames.
            </h2>

            <p className="mt-4 text-[16px] md:text-[17px] text-ink-600 leading-relaxed">
              When physical fiber severs or optical transceivers fail, NetAdapt isolates the fault instantly. The engine diverts traffic along pre-computed loop-free alternates (LFA) before applications notice a timeout.
            </p>

            {/* Compact Event Timeline */}
            <div className="mt-8 border border-ink-200 rounded-lg bg-white p-4 font-mono text-xs">
              <div className="flex items-center space-x-2 pb-2.5 mb-3 border-b border-ink-200 text-ink-500 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-forest" />
                <span className="font-semibold text-ink-900 uppercase">HIGH-PRECISION EVENT LOG</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start space-x-3 text-[11px]">
                  <span className="text-ink-500 shrink-0 w-16">00.00 ms</span>
                  <div>
                    <span className="font-semibold text-red-600">LOS Detected</span>
                    <p className="text-ink-600 font-sans text-[12px] mt-0.5">Optics signal loss on port eth0/1 &bull; Core-Alpha</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 text-[11px]">
                  <span className="text-ink-500 shrink-0 w-16">03.20 ms</span>
                  <div>
                    <span className="font-semibold text-ink-900">Neighbor Purged</span>
                    <p className="text-ink-600 font-sans text-[12px] mt-0.5">BFD session collapsed; route withdrawn from FIB</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 text-[11px]">
                  <span className="text-ink-500 shrink-0 w-16">11.80 ms</span>
                  <div>
                    <span className="font-semibold text-ink-900">Alternate Path Activated</span>
                    <p className="text-ink-600 font-sans text-[12px] mt-0.5">Pre-computed LFA route via Core-Backup injected</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 text-[11px]">
                  <span className="text-forest shrink-0 w-16 font-semibold">18.40 ms</span>
                  <div>
                    <span className="font-semibold text-forest">Full Convergence</span>
                    <p className="text-ink-600 font-sans text-[12px] mt-0.5">100% flow traffic restored; 0 dropped packets</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
