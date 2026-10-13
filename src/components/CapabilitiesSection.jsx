import React from 'react';
import { Route, Zap, Sliders, BarChart3, CheckCircle2, ArrowRight } from 'lucide-react';

export default function CapabilitiesSection() {
  return (
    <section id="capabilities" className="py-20 md:py-28 border-b border-ink-200 bg-white">
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="mb-14 md:mb-18">
          <div className="text-[11px] uppercase tracking-wider font-mono text-forest font-semibold mb-3">
            01 / SYSTEM CAPABILITIES
          </div>
          <h2 className="text-[34px] sm:text-[40px] md:text-[44px] font-semibold tracking-[-0.025em] text-ink-950 max-w-2xl leading-[1.15]">
            Built for changing network conditions.
          </h2>
          <p className="mt-4 text-[16px] md:text-[18px] text-ink-600 max-w-2xl leading-relaxed">
            Deterministic topologies meet volatile traffic demand. NetAdapt continuously samples link latencies, queue fill levels, and convergence states to maintain maximum throughput.
          </p>
        </div>

        {/* Editorial Layout: Distinct technical layout instead of repetitive cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Capability 1: Adaptive Routing (Spans 7 cols) */}
          <div className="lg:col-span-7 border border-ink-200 rounded-md p-6 md:p-8 bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 bg-forest-subtle border border-forest-border text-forest font-semibold rounded">
                  ENGINE 01
                </span>
                <span className="font-mono text-[11px] text-ink-500">DYNAMIC COST DIJKSTRA</span>
              </div>
              <h3 className="text-[22px] md:text-[24px] font-semibold text-ink-950 tracking-[-0.015em] mb-3">
                Adaptive Routing
              </h3>
              <p className="text-[15px] md:text-[16px] text-ink-600 leading-relaxed mb-6">
                Dynamically diverts flows from saturated links to low-latency alternate paths before packet queues overflow and trigger TCP window collapse.
              </p>
            </div>

            {/* Technical Illustration: Real-time trunk metrics */}
            <div className="bg-ink-50 border border-ink-200 rounded p-4 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-ink-200 text-[11px] text-ink-500">
                <span>CANDIDATE TRUNK</span>
                <span>UTILIZATION</span>
                <span>METRIC COST</span>
                <span>STATUS</span>
              </div>
              <div className="space-y-2 mt-2.5">
                <div className="flex items-center justify-between text-[12px] bg-white p-2.5 rounded border border-ink-200">
                  <span className="font-semibold text-ink-900 flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-forest"></span>
                    <span>Core-Alpha &rarr; Edge-GW</span>
                  </span>
                  <span className="text-ink-600">32% (3.2 Gbps)</span>
                  <span className="text-ink-900 font-medium">10 [Optimal]</span>
                  <span className="text-forest font-semibold text-[11px]">ACTIVE</span>
                </div>
                <div className="flex items-center justify-between text-[12px] p-2 text-ink-500">
                  <span className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-ink-300"></span>
                    <span>Core-Beta &rarr; Edge-GW</span>
                  </span>
                  <span>14% (1.4 Gbps)</span>
                  <span>18 [Backup]</span>
                  <span className="text-ink-400 text-[11px]">STANDBY</span>
                </div>
              </div>
            </div>
          </div>

          {/* Capability 2: Self-Healing Networks (Spans 5 cols) */}
          <div className="lg:col-span-5 border border-ink-200 rounded-md p-6 md:p-8 bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 bg-forest-subtle border border-forest-border text-forest font-semibold rounded">
                  ENGINE 02
                </span>
                <span className="font-mono text-[11px] text-forest font-semibold">&lt; 20ms REROUTE</span>
              </div>
              <h3 className="text-[22px] md:text-[24px] font-semibold text-ink-950 tracking-[-0.015em] mb-3">
                Self-Healing Networks
              </h3>
              <p className="text-[15px] md:text-[16px] text-ink-600 leading-relaxed mb-6">
                Hardware link dropouts and transceiver failures trigger automated neighborhood recalculation with zero dropped TCP sessions.
              </p>
            </div>

            {/* Convergence Timeline */}
            <div className="bg-ink-50 border border-ink-200 rounded p-4 font-mono text-[11px]">
              <div className="text-ink-500 uppercase text-[10px] mb-2 tracking-wider">FAILOVER CONVERGENCE</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">0.0ms</span>
                  <span className="text-ink-800">Heartbeat loss on eth0/1</span>
                  <span className="text-red-600 font-semibold">FAIL</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">4.2ms</span>
                  <span className="text-ink-800">Neighbor adjacency purge</span>
                  <span className="text-ink-500">UPDATE</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-ink-900">
                  <span className="text-forest">18.4ms</span>
                  <span>Backup route converged</span>
                  <span className="text-forest">HEALED</span>
                </div>
              </div>
            </div>
          </div>

          {/* Capability 3: Quality of Service (Spans 5 cols) */}
          <div className="lg:col-span-5 border border-ink-200 rounded-md p-6 md:p-8 bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 bg-forest-subtle border border-forest-border text-forest font-semibold rounded">
                  ENGINE 03
                </span>
                <span className="font-mono text-[11px] text-ink-500">FIFO / PQ / WFQ</span>
              </div>
              <h3 className="text-[22px] md:text-[24px] font-semibold text-ink-950 tracking-[-0.015em] mb-3">
                Quality of Service
              </h3>
              <p className="text-[15px] md:text-[16px] text-ink-600 leading-relaxed mb-6">
                Class-based queue scheduling guarantees bounded jitter for mission-critical UDP voice packets ahead of bulk TCP streams.
              </p>
            </div>

            {/* Multi-queue buffer visual */}
            <div className="bg-ink-50 border border-ink-200 rounded p-4 font-mono text-xs space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-16 text-[10px] text-ink-500 uppercase">HIGH (VOIP)</span>
                <div className="flex-1 bg-white border border-ink-200 h-5 rounded flex items-center px-1.5 space-x-1">
                  <div className="w-3 h-3 rounded-sm bg-forest" title="Voice Packet"></div>
                  <div className="w-3 h-3 rounded-sm bg-forest" title="Voice Packet"></div>
                  <div className="w-3 h-3 rounded-sm bg-forest" title="Voice Packet"></div>
                </div>
                <span className="text-[10px] text-forest font-semibold">0ms JITTER</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-16 text-[10px] text-ink-500 uppercase">NORM (HTTP)</span>
                <div className="flex-1 bg-white border border-ink-200 h-5 rounded flex items-center px-1.5 space-x-1">
                  <div className="w-3 h-3 rounded-sm bg-ink-800" title="Web Flow"></div>
                  <div className="w-3 h-3 rounded-sm bg-ink-800" title="Web Flow"></div>
                  <div className="w-3 h-3 rounded-sm bg-ink-500" title="Web Flow"></div>
                </div>
                <span className="text-[10px] text-ink-500">BUFFERED</span>
              </div>
            </div>
          </div>

          {/* Capability 4: Performance Analysis (Spans 7 cols) */}
          <div className="lg:col-span-7 border border-ink-200 rounded-md p-6 md:p-8 bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 bg-forest-subtle border border-forest-border text-forest font-semibold rounded">
                  ENGINE 04
                </span>
                <span className="font-mono text-[11px] text-ink-500">PDR & LATENCY ENVELOPES</span>
              </div>
              <h3 className="text-[22px] md:text-[24px] font-semibold text-ink-950 tracking-[-0.015em] mb-3">
                Performance Analysis
              </h3>
              <p className="text-[15px] md:text-[16px] text-ink-600 leading-relaxed mb-6">
                Real-time telemetry computes Packet Delivery Ratio (PDR), per-hop transit variance, tail latency percentiles, and buffer queue depth.
              </p>
            </div>

            {/* Key Analytics Metrics */}
            <div className="bg-ink-50 border border-ink-200 rounded p-4 grid grid-cols-3 gap-3 font-mono text-center">
              <div className="bg-white border border-ink-200 p-2.5 rounded">
                <div className="text-[10px] uppercase text-ink-500">DELIVERY RATIO</div>
                <div className="text-[17px] font-semibold text-ink-950 mt-0.5">99.98%</div>
                <div className="text-[9px] text-forest font-medium">&plusmn; 0.01% variance</div>
              </div>
              <div className="bg-white border border-ink-200 p-2.5 rounded">
                <div className="text-[10px] uppercase text-ink-500">P99 LATENCY</div>
                <div className="text-[17px] font-semibold text-ink-950 mt-0.5">18.6ms</div>
                <div className="text-[9px] text-ink-500">at 95% line rate</div>
              </div>
              <div className="bg-white border border-ink-200 p-2.5 rounded">
                <div className="text-[10px] uppercase text-ink-500">QUEUE OCCUPANCY</div>
                <div className="text-[17px] font-semibold text-forest mt-0.5">12 pkts</div>
                <div className="text-[9px] text-ink-500">under RED ceiling</div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
