import React, { useState } from 'react';
import { Layers, Activity, Gauge, CheckCircle2 } from 'lucide-react';

export default function QoSMetricsSection() {
  const [scheduler, setScheduler] = useState('PQ'); // 'FIFO' | 'PQ' | 'WFQ'

  // Metric profiles per scheduler
  const data = {
    FIFO: {
      name: 'First In, First Out (FIFO)',
      badge: 'BEST-EFFORT FIFO',
      description: 'Single queue buffer. All packet classes share buffer capacity equally. Under congestion, high-priority voice packets suffer head-of-line blocking and jitter.',
      latency: '48.6 ms',
      latencyTrend: '+34ms under queue congestion',
      throughput: '890 Mbps',
      packetLoss: '3.82%',
      pdr: '96.18%',
      recoveryTime: '32.4 ms',
      chartPoints: [20, 24, 30, 48, 46, 52, 49, 50, 48],
      queueAlloc: [
        { label: 'Voice (High)', count: 2, color: '#FF5E1F' },
        { label: 'HTTP (Bulk)', count: 6, color: '#1E293B' },
        { label: 'Video (Med)', count: 4, color: '#64748B' },
      ],
    },
    PQ: {
      name: 'Priority Queue (PQ)',
      badge: 'STRICT EXPEDITED FORWARDING',
      description: 'Strict priority classes. High-priority voice and telemetry buffers are emptied completely before medium or bulk queues transmit a single byte.',
      latency: '4.2 ms',
      latencyTrend: '-44ms for critical flows',
      throughput: '942 Mbps',
      packetLoss: '0.00% (High) / 1.2% (Bulk)',
      pdr: '99.84%',
      recoveryTime: '18.4 ms',
      chartPoints: [22, 14, 8, 4, 4, 4, 5, 4, 4],
      queueAlloc: [
        { label: 'High Priority (Q0)', count: 4, color: '#FF5E1F', note: 'Priority 1' },
        { label: 'Medium Priority (Q1)', count: 3, color: '#045137', note: 'Priority 2' },
        { label: 'Best Effort (Q2)', count: 2, color: '#1E293B', note: 'Priority 3' },
      ],
    },
    WFQ: {
      name: 'Weighted Fair Queuing (WFQ)',
      badge: 'WEIGHTED BANDWIDTH FAIRNESS',
      description: 'Dynamic packet scheduling allocates bandwidth proportionally (e.g. 50% Voice, 30% Video, 20% Data) eliminating buffer starvation while guaranteeing latency bounds.',
      latency: '11.8 ms',
      latencyTrend: 'Deterministic bounds',
      throughput: '978 Mbps',
      packetLoss: '0.08%',
      pdr: '99.92%',
      recoveryTime: '21.0 ms',
      chartPoints: [18, 16, 14, 12, 11, 12, 11, 12, 11],
      queueAlloc: [
        { label: 'Voice (Weight 50%)', count: 3, color: '#FF5E1F', note: '50% BW' },
        { label: 'Video (Weight 30%)', count: 3, color: '#045137', note: '30% BW' },
        { label: 'Bulk (Weight 20%)', count: 3, color: '#1E293B', note: '20% BW' },
      ],
    },
  };

  const current = data[scheduler];

  return (
    <section id="metrics" className="py-20 md:py-28 border-b border-ink-200 bg-white">
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 md:mb-16">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-mono text-forest font-semibold mb-3">
              04 / SCHEDULERS & TELEMETRY
            </div>
            <h2 className="text-[34px] sm:text-[40px] md:text-[44px] font-semibold tracking-[-0.025em] text-ink-950">
              QoS and performance telemetry.
            </h2>
            <p className="mt-3 text-[16px] md:text-[18px] text-ink-600 max-w-2xl leading-relaxed">
              Verify how queue scheduling policies service congested egress ports under heavy cross-traffic.
            </p>
          </div>

          {/* Scheduler Switcher Tabs */}
          <div className="mt-6 md:mt-0 flex p-1 bg-ink-50 border border-ink-200 rounded-md font-mono text-xs">
            {['FIFO', 'PQ', 'WFQ'].map((key) => (
              <button
                key={key}
                onClick={() => setScheduler(key)}
                className={`px-4 py-2 rounded font-medium transition-all ${
                  scheduler === key
                    ? 'bg-white text-ink-950 border border-ink-200 shadow-none'
                    : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {key === 'PQ' ? 'Priority Queue' : key}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Shell */}
        <div className="border border-ink-200 rounded-lg bg-white overflow-hidden">
          
          {/* Active Scheduler Telemetry Banner */}
          <div className="px-6 py-4 bg-ink-50/80 border-b border-ink-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-white border border-forest-border text-forest font-semibold">
                {current.badge}
              </span>
              <span className="font-semibold text-sm text-ink-950">
                {current.name}
              </span>
            </div>
            <div className="text-xs font-mono text-ink-500">
              EGRESS LINK BANDWIDTH: <strong className="text-ink-900">1.0 Gbps FULL DUPLEX</strong>
            </div>
          </div>

          {/* Queue Architecture Preview */}
          <div className="p-6 border-b border-ink-200 bg-white">
            <p className="text-sm text-ink-600 mb-4 max-w-3xl leading-relaxed">
              {current.description}
            </p>

            {/* Buffer Queue Lane Graphic */}
            <div className="bg-ink-50/60 border border-ink-200 rounded p-4">
              <div className="flex items-center justify-between text-xs font-mono text-ink-500 mb-3">
                <span className="uppercase text-[11px] font-medium">EGRESS BUFFER QUEUE STATE</span>
                <span className="text-[11px]">TRANSMISSION FIFO POINTER &rarr;</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {current.queueAlloc.map((q, i) => (
                  <div key={i} className="bg-white border border-ink-200 p-3 rounded">
                    <div className="flex justify-between items-center text-xs font-mono mb-2">
                      <span className="text-ink-900 font-semibold">{q.label}</span>
                      {q.note && (
                        <span className="text-[10px] text-forest font-semibold">{q.note}</span>
                      )}
                    </div>
                    {/* Visual packet items inside queue */}
                    <div className="flex items-center space-x-1.5 h-6 bg-ink-50 p-1 rounded border border-ink-200">
                      {Array.from({ length: q.count }).map((_, idx) => (
                        <div
                          key={idx}
                          className="h-full flex-1 rounded-sm"
                          style={{ backgroundColor: q.color }}
                          title="Buffered Packet Frame"
                        />
                      ))}
                      {Array.from({ length: Math.max(0, 6 - q.count) }).map((_, idx) => (
                        <div
                          key={`empty-${idx}`}
                          className="h-full flex-1 rounded-sm bg-white border border-dashed border-ink-300"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 5 Compact Metric Panels with clean aligned typography and subtle data charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-ink-200 bg-white">
            
            {/* Metric 1: Latency */}
            <div className="p-6 flex flex-col justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-mono text-ink-500 mb-1">
                  LATENCY
                </div>
                <div className="text-[28px] font-mono font-semibold text-ink-950 tracking-tight">
                  {current.latency}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-ink-200">
                {/* SVG Sparkline */}
                <svg viewBox="0 0 100 24" className="w-full h-6 select-none">
                  <path
                    d={`M 0,${current.chartPoints[0]} L 12,${current.chartPoints[1]} L 25,${current.chartPoints[2]} L 37,${current.chartPoints[3]} L 50,${current.chartPoints[4]} L 62,${current.chartPoints[5]} L 75,${current.chartPoints[6]} L 87,${current.chartPoints[7]} L 100,${current.chartPoints[8]}`}
                    fill="none"
                    stroke="#045137"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="text-[10px] font-mono text-ink-500 mt-1">
                  {current.latencyTrend}
                </div>
              </div>
            </div>

            {/* Metric 2: Throughput */}
            <div className="p-6 flex flex-col justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-mono text-ink-500 mb-1">
                  THROUGHPUT
                </div>
                <div className="text-[28px] font-mono font-semibold text-ink-950 tracking-tight">
                  {current.throughput}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-ink-200">
                <div className="w-full bg-ink-100 h-2 rounded overflow-hidden">
                  <div
                    className="bg-forest h-full"
                    style={{ width: `${(parseInt(current.throughput) / 1000) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] font-mono text-ink-500 mt-2">
                  Line rate efficiency
                </div>
              </div>
            </div>

            {/* Metric 3: Packet Loss */}
            <div className="p-6 flex flex-col justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-mono text-ink-500 mb-1">
                  PACKET LOSS
                </div>
                <div className="text-[28px] font-mono font-semibold text-ink-950 tracking-tight">
                  {current.packetLoss.split(' ')[0]}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-ink-200">
                <div className="text-[11px] font-mono text-ink-600">
                  {current.packetLoss}
                </div>
                <div className="text-[10px] font-mono text-forest mt-1">
                  RED early discard active
                </div>
              </div>
            </div>

            {/* Metric 4: Packet Delivery Ratio (PDR) */}
            <div className="p-6 flex flex-col justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-mono text-ink-500 mb-1">
                  PACKET DELIVERY RATIO
                </div>
                <div className="text-[28px] font-mono font-semibold text-ink-950 tracking-tight">
                  {current.pdr}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-ink-200">
                <div className="flex items-center space-x-1.5 text-[10px] font-mono text-forest">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>SLA Verified</span>
                </div>
                <div className="text-[10px] font-mono text-ink-500 mt-1">
                  99.9% target met
                </div>
              </div>
            </div>

            {/* Metric 5: Recovery Time */}
            <div className="p-6 flex flex-col justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-mono text-ink-500 mb-1">
                  RECOVERY TIME
                </div>
                <div className="text-[28px] font-mono font-semibold text-forest tracking-tight">
                  {current.recoveryTime}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-ink-200">
                <div className="text-[10px] font-mono text-ink-500">
                  Mean time to heal (MTTH)
                </div>
                <div className="text-[10px] font-mono text-ink-900 font-medium mt-1">
                  Sub-50ms carrier standard
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
