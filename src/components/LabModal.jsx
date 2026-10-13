import React, { useState } from 'react';
import { X, ExternalLink, Terminal, Copy, Check } from 'lucide-react';

export default function LabModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyCommand = () => {
    navigator.clipboard.writeText('python lab_server.py --port 8765');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-ink-200 rounded-lg max-w-lg w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-ink-50/80 border-b border-ink-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-forest"></span>
            <span className="font-mono text-xs uppercase tracking-wider font-semibold text-ink-950">
              NETADAPT SIMULATION WORKBENCH
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-ink-500 hover:text-ink-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-ink-950 tracking-tight">
              Launch Local Network Simulator
            </h3>
            <p className="mt-1 text-sm text-ink-600 leading-relaxed">
              NetAdapt includes a full interactive Python simulation server and browser workbench ready to run locally.
            </p>
          </div>

          {/* Terminal Command box */}
          <div className="bg-ink-950 text-white p-4 rounded-md font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-ink-400 text-[11px] pb-1 border-b border-ink-800">
              <span className="flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-forest-border" />
                <span>TERMINAL COMMAND</span>
              </span>
              <button
                onClick={copyCommand}
                className="text-white hover:text-forest-border flex items-center space-x-1 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
            <div className="pt-1 text-emerald-300 select-all">
              $ python lab_server.py --port 8765
            </div>
          </div>

          {/* Quick link action */}
          <div className="p-4 bg-ink-50 border border-ink-200 rounded-md space-y-2">
            <div className="text-xs font-semibold text-ink-900">
              Local simulation instance active
            </div>
            <p className="text-xs text-ink-600">
              The laboratory server is running at port 8765. Click below to connect directly.
            </p>
            <div className="pt-1">
              <a
                href="http://localhost:8765/lab"
                className="inline-flex items-center space-x-1.5 text-xs font-mono font-medium text-forest hover:underline"
              >
                <span>http://localhost:8765/lab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-ink-50/80 border-t border-ink-200 flex items-center justify-between text-xs">
          <span className="font-mono text-ink-500">PORT: 8765 &bull; HTTP/1.1</span>
          <a
            href="http://localhost:8765/lab"
            className="px-4 py-2 rounded-full bg-forest text-white font-medium hover:bg-forest-hover transition-colors flex items-center space-x-1.5"
          >
            <span>Open in Browser</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>
      </div>
    </div>
  );
}
