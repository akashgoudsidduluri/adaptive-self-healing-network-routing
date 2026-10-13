import React from 'react';
import { ArrowUpRight, Terminal } from 'lucide-react';

export default function FinalCTA({ onOpenLab }) {
  return (
    <section className="py-24 md:py-32 bg-ink-50/50 border-b border-ink-200">
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        {/* Subtle pill tag */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white border border-ink-200 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-forest" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-forest font-semibold">
            SIMULATION READY
          </span>
        </div>

        {/* Heading */}
        <h2 className="text-[36px] sm:text-[44px] md:text-[50px] font-semibold text-ink-950 tracking-[-0.03em] leading-tight max-w-3xl mx-auto">
          Put the network under pressure.
        </h2>

        {/* Description */}
        <p className="mt-4 text-[16px] md:text-[18px] text-ink-600 max-w-xl mx-auto leading-relaxed">
          Generate traffic. Introduce failures. Compare routing strategies.
        </p>

        {/* Action Button: Deep Forest Green Pill */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
          <a
            href="http://localhost:8765/lab"
            className="px-8 py-3.5 rounded-full bg-forest text-white text-[15px] font-medium hover:bg-forest-hover active:scale-[0.98] transition-all flex items-center space-x-2"
          >
            <span>Launch Network Lab</span>
            <ArrowUpRight className="w-4 h-4 opacity-80" />
          </a>
        </div>

        {/* CLI Quick command pill */}
        <div className="mt-8 inline-flex items-center space-x-2 font-mono text-xs text-ink-600 bg-white px-4 py-2 rounded-md border border-ink-200">
          <Terminal className="w-3.5 h-3.5 text-forest" />
          <span className="text-ink-900 font-medium">$ python lab_server.py --port 8765</span>
        </div>

      </div>
    </section>
  );
}
