import React from 'react';
import { ArrowUpRight, Github } from 'lucide-react';

export default function Footer({ onOpenLab }) {
  return (
    <footer id="docs" className="bg-white border-t border-ink-200 py-16 text-ink-600">
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-ink-200">
          
          {/* Brand & Description (5 cols) */}
          <div className="md:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-forest text-white">
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none">
                    <circle cx="4" cy="4" r="1.8" fill="white" />
                    <circle cx="12" cy="4" r="1.8" fill="white" />
                    <circle cx="8" cy="12" r="1.8" fill="#FF5E1F" />
                    <line x1="4" y1="4" x2="8" y2="12" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                    <line x1="12" y1="4" x2="8" y2="12" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="font-sans font-bold text-[18px] tracking-[-0.03em] text-ink-950">
                  NETADAPT
                </span>
              </div>

              <p className="text-[14px] leading-relaxed text-ink-600 max-w-sm">
                An event-driven network routing simulation laboratory designed for evaluating dynamic congestion adaptation, autonomic self-healing, and multi-queue QoS policies.
              </p>
            </div>

            <div className="mt-6 flex items-center space-x-2 text-xs font-mono text-ink-500">
              <span className="w-2 h-2 rounded-full bg-forest"></span>
              <span>CARRIER SIMULATION SUITE</span>
            </div>
          </div>

          {/* Column 2: Navigation Links (2 cols) */}
          <div className="md:col-span-2">
            <h4 className="font-mono text-[11px] uppercase tracking-wider text-ink-900 font-semibold mb-4">
              NAVIGATION
            </h4>
            <ul className="space-y-2.5 text-[14px]">
              <li>
                <a href="#overview" className="hover:text-forest transition-colors">Overview</a>
              </li>
              <li>
                <a href="#capabilities" className="hover:text-forest transition-colors">Capabilities</a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-forest transition-colors">Self-Healing</a>
              </li>
              <li>
                <a href="#metrics" className="hover:text-forest transition-colors">QoS & Metrics</a>
              </li>
              <li>
                <a href="#how-it-works-steps" className="hover:text-forest transition-colors">Methodology</a>
              </li>
            </ul>
          </div>

          {/* Column 3: Algorithms & Docs (3 cols) */}
          <div className="md:col-span-3">
            <h4 className="font-mono text-[11px] uppercase tracking-wider text-ink-900 font-semibold mb-4">
              DOCUMENTATION
            </h4>
            <ul className="space-y-2.5 text-[14px]">
              <li>
                <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-forest transition-colors flex items-center space-x-1">
                  <span>Dijkstra Dynamic Weighting</span>
                  <ArrowUpRight className="w-3 h-3 text-ink-400" />
                </a>
              </li>
              <li>
                <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-forest transition-colors flex items-center space-x-1">
                  <span>Fast Reroute (FRR) Loop-Free</span>
                  <ArrowUpRight className="w-3 h-3 text-ink-400" />
                </a>
              </li>
              <li>
                <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-forest transition-colors flex items-center space-x-1">
                  <span>WFQ Deficit Round Robin</span>
                  <ArrowUpRight className="w-3 h-3 text-ink-400" />
                </a>
              </li>
              <li>
                <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-forest transition-colors flex items-center space-x-1">
                  <span>CLI Laboratory Spec</span>
                  <ArrowUpRight className="w-3 h-3 text-ink-400" />
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Laboratory Access (2 cols) */}
          <div className="md:col-span-2">
            <h4 className="font-mono text-[11px] uppercase tracking-wider text-ink-900 font-semibold mb-4">
              RESOURCES
            </h4>
            <ul className="space-y-2.5 text-[14px]">
              <li>
                <a
                  href="http://localhost:8765/lab"
                  className="hover:text-forest text-left transition-colors font-medium text-ink-900 block"
                >
                  Network Lab UI &rarr;
                </a>
              </li>
              <li>
                <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-forest transition-colors flex items-center space-x-1">
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub Repository</span>
                </a>
              </li>
              <li>
                <span className="font-mono text-[12px] text-ink-500">Python 3.10+ / RFC 791</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-ink-500 space-y-4 sm:space-y-0">
          <div>
            &copy; {new Date().getFullYear()} NETADAPT Research &middot; MIT Academic License
          </div>

          <div className="flex items-center space-x-6 font-mono text-[11px]">
            <span>PRECISION: 1&mu;s</span>
            <span>TOPOLOGIES: DETERMINISTIC</span>
            <span>CONVERGENCE: &lt;50ms</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
