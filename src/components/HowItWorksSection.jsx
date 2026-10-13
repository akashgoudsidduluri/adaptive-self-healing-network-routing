import React from 'react';
import { Network, Activity, ShieldCheck, BarChart4 } from 'lucide-react';

export default function HowItWorksSection() {
  const steps = [
    {
      num: '01',
      title: 'Configure the Network',
      description: 'Select carrier topology presets or construct custom graphs of PCs, switches, and routers with explicit bandwidth, latency, and queue constraints.',
      icon: Network,
      tag: 'TOPOLOGY & SEED',
    },
    {
      num: '02',
      title: 'Generate Traffic',
      description: 'Inject concurrent CBR, Poisson, or bursty traffic flows with differentiated QoS markings across client workstations and server clusters.',
      icon: Activity,
      tag: 'FLOW INJECTION',
    },
    {
      num: '03',
      title: 'Adapt and Recover',
      description: 'Sever live links or induce port saturation. The routing engine isolates failures and computes loop-free alternate paths in milliseconds.',
      icon: ShieldCheck,
      tag: 'AUTONOMIC REROUTE',
    },
    {
      num: '04',
      title: 'Analyze Performance',
      description: 'Export granular per-flow telemetry, latency histograms, Packet Delivery Ratios (PDR), and queue depth variance for academic benchmarking.',
      icon: BarChart4,
      tag: 'TELEMETRY BENCHMARK',
    },
  ];

  return (
    <section id="how-it-works-steps" className="py-20 md:py-28 border-b border-ink-200 bg-white">
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="mb-14 md:mb-20">
          <div className="text-[11px] uppercase tracking-wider font-mono text-forest font-semibold mb-3">
            05 / METHODOLOGY & WORKFLOW
          </div>
          <h2 className="text-[34px] sm:text-[40px] md:text-[44px] font-semibold tracking-[-0.025em] text-ink-950 max-w-2xl">
            Simulate, stress, and observe.
          </h2>
          <p className="mt-4 text-[16px] md:text-[18px] text-ink-600 max-w-2xl leading-relaxed">
            A deterministic four-stage methodology for evaluating network resilience under controlled laboratory conditions.
          </p>
        </div>

        {/* 4 Steps in clean horizontal layout */}
        <div className="relative">
          {/* Horizontal connecting line on desktop */}
          <div className="hidden lg:block absolute top-[28px] left-[40px] right-[40px] h-[1px] bg-ink-200 -z-0" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 relative z-10">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className="flex flex-col">
                  {/* Step Header with Number Marker */}
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-14 h-14 rounded-full bg-white border border-ink-200 flex items-center justify-center font-mono text-[14px] font-bold text-ink-950 shrink-0">
                      <span className="text-forest">{step.num}</span>
                    </div>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-ink-500 block lg:hidden">
                      {step.tag}
                    </span>
                  </div>

                  {/* Step Card Content */}
                  <div className="border border-ink-200 rounded-lg p-6 bg-white flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-mono tracking-wider text-forest font-semibold mb-2 hidden lg:block">
                        {step.tag}
                      </div>
                      <h3 className="text-[18px] font-semibold text-ink-950 tracking-tight mb-2.5">
                        {step.num} — {step.title}
                      </h3>
                      <p className="text-[14px] text-ink-600 leading-relaxed">
                        {step.description}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-ink-200 flex items-center justify-between text-xs font-mono text-ink-500">
                      <span>STAGE 0{idx + 1}</span>
                      <Icon className="w-4 h-4 text-ink-800" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
