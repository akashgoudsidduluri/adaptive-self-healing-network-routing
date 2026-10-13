import React, { useState } from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import CapabilitiesSection from './components/CapabilitiesSection';
import AdaptiveRoutingSection from './components/AdaptiveRoutingSection';
import SelfHealingSection from './components/SelfHealingSection';
import QoSMetricsSection from './components/QoSMetricsSection';
import HowItWorksSection from './components/HowItWorksSection';
import FinalCTA from './components/FinalCTA';
import Footer from './components/Footer';
import LabModal from './components/LabModal';

export default function App() {
  const [isLabOpen, setIsLabOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-ink-950 font-sans antialiased flex flex-col selection:bg-forest selection:text-white">
      {/* 3. Header Navbar (72px) */}
      <Header onOpenLab={() => setIsLabOpen(true)} />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* 4. Hero Section */}
        <HeroSection onOpenLab={() => setIsLabOpen(true)} />

        {/* 5. Capabilities Section (Editorial Layout) */}
        <CapabilitiesSection />

        {/* 6. Adaptive Routing Section (Alternating Two-Column) */}
        <AdaptiveRoutingSection />

        {/* 7. Self-Healing Section (Reversed Two-Column Layout) */}
        <SelfHealingSection />

        {/* 8. QoS and Metrics Section (Technical Dashboard Preview) */}
        <QoSMetricsSection />

        {/* 9. How It Works Section (4 Steps Clean Horizontal) */}
        <HowItWorksSection />

        {/* 10. Final CTA Section (Subtly Tinted Background) */}
        <FinalCTA onOpenLab={() => setIsLabOpen(true)} />
      </main>

      {/* 11. Minimal Footer */}
      <Footer onOpenLab={() => setIsLabOpen(true)} />

      {/* Interactive Network Lab Launcher Modal */}
      <LabModal isOpen={isLabOpen} onClose={() => setIsLabOpen(false)} />
    </div>
  );
}
