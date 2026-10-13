import React, { useState, useEffect } from 'react';
import { Menu, X, ArrowUpRight } from 'lucide-react';

export default function Header({ onOpenLab }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Overview', href: '#overview' },
    { name: 'Capabilities', href: '#capabilities' },
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Metrics', href: '#metrics' },
    { name: 'Documentation', href: '#docs' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 h-[72px] bg-white transition-all duration-200 ${
        isScrolled ? 'border-b border-ink-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]' : 'border-b border-transparent'
      }`}
    >
      <div className="max-w-content mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        
        {/* Left: NETADAPT Wordmark */}
        <a href="#" className="flex items-center space-x-2.5 group">
          {/* Minimal Anchor-style geometric symbol */}
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
          <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-forest-subtle border border-forest-border text-forest font-medium">
            SIMULATION LAB
          </span>
        </a>

        {/* Center / Navigation Links */}
        <nav className="hidden md:flex items-center space-x-8">
          {navLinks.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="text-[14px] font-medium text-ink-600 hover:text-ink-950 transition-colors"
            >
              {item.name}
            </a>
          ))}
        </nav>

        {/* Right: Deep Forest Green Pill Button */}
        <div className="flex items-center space-x-3">
          <a
            href="http://localhost:8765/lab"
            className="px-5 py-2.5 rounded-full bg-forest text-white text-[14px] font-medium hover:bg-forest-hover active:scale-[0.98] transition-all flex items-center space-x-1.5 shadow-none"
          >
            <span>Open Network Lab</span>
            <ArrowUpRight className="w-4 h-4 opacity-80" />
          </a>

          {/* Mobile hamburger menu */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 md:hidden text-ink-600 hover:text-ink-900 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-ink-200 px-4 pt-3 pb-6 shadow-md">
          <div className="flex flex-col space-y-3">
            {navLinks.map((item) => (
              <a
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-[15px] font-medium text-ink-900 py-2 px-3 rounded hover:bg-ink-50 transition-colors"
              >
                {item.name}
              </a>
            ))}
            <div className="pt-2 border-t border-ink-200">
              <a
                href="http://localhost:8765/lab"
                className="w-full py-2.5 rounded-full bg-forest text-white text-center text-[14px] font-medium hover:bg-forest-hover transition-colors block"
              >
                Open Network Lab
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
