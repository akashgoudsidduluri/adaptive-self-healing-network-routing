import React from 'react';
import { ArrowRight, ArrowUpRight, ShieldCheck } from 'lucide-react';
import HeroNetwork from './HeroNetwork';

export default function HeroSection({ onOpenLab }) {
  return (
    <section className="pt-28 pb-16 md:pt-36 md:pb-24 border-b border-ink-200 bg-white">
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Two-Column Grid: Headline & Details on Left, 3D Network Visualization on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          
          {/* Left Column (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            
            {/* Minimal Eyebrow */}
            <div className="inline-flex items-center space-x-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-forest" />
              <span className="font-mono text-[11px] uppercase tracking-wider font-semibold text-forest">
                NETWORK SIMULATION LABORATORY
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-[36px] sm:text-[48px] lg:text-[56px] xl:text-[62px] font-semibold text-ink-950 leading-[1.08] tracking-[-0.035em]">
              Networks that adapt.<br />
              <span className="text-ink-950">Packets that find a way.</span>
            </h1>

            {/* Description */}
            <p className="mt-6 text-[16px] md:text-[18px] text-ink-600 leading-relaxed max-w-xl">
              Simulate congestion, adapt routes, recover from failures, and measure network performance.
            </p>

            {/* Buttons: Open Network Lab (Deep Forest Green) & Explore Capabilities */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <a
                href="http://localhost:8765/lab"
                className="px-6 py-3 rounded-full bg-forest text-white text-[15px] font-medium hover:bg-forest-hover active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
              >
                <span>Open Network Lab</span>
                <ArrowRight className="w-4 h-4 opacity-80" />
              </a>

              <a
                href="#capabilities"
                className="px-6 py-3 rounded-full bg-white border border-ink-200 text-ink-900 text-[15px] font-medium hover:border-ink-300 hover:bg-ink-50 transition-all flex items-center justify-center"
              >
                Explore Capabilities
              </a>
            </div>

            {/* Minimal Engineering Telemetry Meta */}
            <div className="mt-8 pt-6 border-t border-ink-200 flex items-center space-x-4 text-xs font-mono text-ink-500">
              <div className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-forest"></span>
                <span className="text-ink-900 font-medium">DISCRETE EVENT CORE</span>
              </div>
              <span>&bull;</span>
              <span>CARRIER TOPOLOGY</span>
              <span>&bull;</span>
              <span className="text-forest font-semibold">STABLE</span>
            </div>

          </div>

          {/* Right Column: Compact, Realistic-Looking 3D Network Topology (7 cols) */}
          <div className="lg:col-span-7">
            <HeroNetwork />
          </div>

        </div>

      </div>
    </section>
  );
}
