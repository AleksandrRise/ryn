"use client";

import React, { useState, useEffect, useRef } from "react";
import { TopNav } from "@/components/layout/top-nav";
import { useLenis } from "@/hooks/useLenis";
import {
  Shield,
  Zap,
  Terminal,
  CheckCircle,
  XCircle,
  Lock,
  FileCode,
  Download,
  Server,
  Database,
  Eye,
  Cpu,
  Code2,
  AlertTriangle,
  Infinity,
  Unlock,
  Github,
  Sparkles,
} from "lucide-react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { DownloadButton } from "@/components/download-button";

// --- ANIMATION UTILS ---

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

const ScrollReveal = ({ children, delay = 0, className = "" }: ScrollRevealProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    className={className}
  >
    {children}
  </motion.div>
);

interface ScrambleTextProps {
  text: string;
  className?: string;
}

const ScrambleText = ({ text, className }: ScrambleTextProps) => {
  const [displayedText, setDisplayedText] = useState(text);
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;':,./<>?";

  useEffect(() => {
    let iterations = 0;
    const interval = setInterval(() => {
      setDisplayedText(
        text
          .split("")
          .map((letter, index) => {
            if (index < iterations) {
              return text[index];
            }
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("")
      );

      if (iterations >= text.length) {
        clearInterval(interval);
      }
      iterations += 1 / 3;
    }, 30);

    return () => clearInterval(interval);
  }, [text]);

  return <span className={className}>{displayedText}</span>;
};

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
}

const GradientText = ({ children, className = "" }: GradientTextProps) => (
  <span
    className={`bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 ${className}`}
  >
    {children}
  </span>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline";
  className?: string;
}

const Button = ({
  children,
  variant = "primary",
  className = "",
  onClick,
  disabled,
  type = "button",
}: ButtonProps) => {
  const baseStyle =
    "inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black relative overflow-hidden group";
  const variants = {
    primary: "bg-white text-black hover:bg-gray-200 focus:ring-white",
    secondary:
      "bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/10 focus:ring-gray-500",
    outline:
      "bg-transparent text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 200, damping: 30 }}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      <span className="relative z-10 flex items-center">{children}</span>
      {variant === "primary" && (
        <motion.div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
      )}
    </motion.button>
  );
};

// --- BOOT SEQUENCE COMPONENT ---

interface BootLoaderProps {
  onComplete: () => void;
}

const BootLoader = ({ onComplete }: BootLoaderProps) => {
  const [logs, setLogs] = useState<string[]>([]);
  const logLines = React.useMemo(() => [
    "INITIALIZING RYN KERNEL...",
    "LOADING SECURITY MODULES [CC6.1, CC6.7]...",
    "CONNECTING TO LOCAL DAEMON...",
    "BYPASSING AUDITOR PROTOCOLS...",
    "ESTABLISHING SECURE ENVIRONMENT...",
    "SYSTEM READY.",
  ], []);

  useEffect(() => {
    let delay = 0;
    logLines.forEach((line, index) => {
      delay += Math.random() * 300 + 100;
      setTimeout(() => {
        setLogs((prev) => [...prev, line]);
        if (index === logLines.length - 1) {
          setTimeout(onComplete, 800);
        }
      }, delay);
    });
  }, [logLines, onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center font-mono text-xs sm:text-sm text-green-500/80 p-8"
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="w-full max-w-lg">
        {logs.map((log, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-1"
          >
            <span className="text-gray-600 mr-2">{`>`}</span>
            {log}
          </motion.div>
        ))}
        <motion.div
          animate={{ opacity: [0, 1, 0] }}
          transition={{ repeatType: "loop", duration: 0.8 }}
          className="h-4 w-2 bg-green-500 mt-2 inline-block"
        />
      </div>
    </motion.div>
  );
};

// --- BACKGROUND: ACTIVE SCAN GRID ---

const SecurityGridBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Grid Settings
    const gridSize = 40;

    // Anomalies (The "bugs" that get fixed)
    interface Anomaly {
      x: number;
      y: number;
      life: number;
      opacity: number;
      spawnTime: number;
    }
    let anomalies: Anomaly[] = [];
    const maxAnomalies = 8;

    const spawnAnomaly = () => {
      const x = Math.floor(Math.random() * (width / gridSize)) * gridSize;
      const y = Math.floor(Math.random() * (height / gridSize)) * gridSize;

      anomalies.push({
        x,
        y,
        life: 0,
        opacity: 0,
        spawnTime: Date.now(),
      });
    };

    let animationId: number;

    const animate = () => {
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, width, height);

      // Draw Grid Points (Subtle Engineering feel)
      ctx.fillStyle = "#1A1A1A";
      for (let x = 0; x < width; x += gridSize) {
        for (let y = 0; y < height; y += gridSize) {
          // Draw faint crosshair
          ctx.fillRect(x - 1, y, 3, 1);
          ctx.fillRect(x, y - 1, 1, 3);
        }
      }

      // Handle Anomalies
      if (anomalies.length < maxAnomalies && Math.random() > 0.98) {
        spawnAnomaly();
      }

      // Draw Anomalies
      for (let i = anomalies.length - 1; i >= 0; i--) {
        const a = anomalies[i];
        a.life++;

        // Pulse Red (Violation)
        const pulse = (Math.sin((Date.now() - a.spawnTime) / 500) + 1) / 2;
        ctx.fillStyle = `rgba(239, 68, 68, ${0.2 + pulse * 0.3})`; // Red

        // Draw the block
        ctx.fillRect(a.x + 1, a.y + 1, gridSize - 2, gridSize - 2);

        // Clean up old anomalies
        if (a.life > 400) {
          anomalies.splice(i, 1);
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ filter: "blur(20px)", zIndex: -1 }}
    />
  );
};

// --- SIMULATED APP UI COMPONENT ---

const RynInterface = () => {
  const [step, setStep] = useState(0); // 0: Scanning, 1: Violation, 2: Fixing, 3: Fixed
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % 4);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (step === 0) {
      // Reset progress when returning to scanning state
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScanProgress(0);
      const scanner = setInterval(() => {
        setScanProgress((p) => Math.min(p + 5, 100));
      }, 50);
      return () => clearInterval(scanner);
    }
  }, [step]);

  return (
    <div className="relative w-full max-w-4xl mx-auto rounded-xl overflow-hidden border border-white/10 bg-[#0A0A0A] shadow-2xl shadow-blue-900/10">
      {/* Title Bar */}
      <div className="h-10 bg-[#111] border-b border-white/5 flex items-center px-4 space-x-2">
        <div className="flex space-x-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
        </div>
        <div className="flex-1 text-center text-xs font-mono text-gray-500">
          Ryn — ~/projects/backend-api
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-12 h-[400px]">
        {/* Sidebar */}
        <div className="col-span-3 bg-[#0E0E0E] border-r border-white/5 p-4 flex flex-col space-y-4">
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-gray-600 font-bold mb-2">
              Controls
            </div>
            {["CC6.1 Access", "CC6.7 Secrets", "CC7.2 Logs", "A1.2 Resilience"].map(
              (item, i) => (
                <div
                  key={i}
                  className={`flex items-center space-x-2 text-sm px-2 py-1.5 rounded ${
                    step > 0 && i === 0
                      ? "bg-red-500/10 text-red-400"
                      : "text-gray-400"
                  }`}
                >
                  {step > 0 && i === 0 ? (
                    <AlertTriangle size={12} />
                  ) : (
                    <div className="w-3" />
                  )}
                  <span>{item}</span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Code/Dashboard Area */}
        <div className="col-span-9 bg-[#0A0A0A] p-6 relative font-mono text-sm">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full space-y-4"
              >
                <div className="w-16 h-16 rounded-full border-2 border-blue-500/30 flex items-center justify-center relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeatType: "loop", ease: "linear" }}
                    className="absolute inset-0 border-t-2 border-blue-500 rounded-full"
                  />
                  <Shield size={24} className="text-blue-500" />
                </div>
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Scanning codebase...</span>
                    <span>{scanProgress}%</span>
                  </div>
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-blue-500"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {(step === 1 || step === 2) && (
              <motion.div
                key="violation"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center space-x-2 text-red-400">
                    <XCircle size={16} />
                    <span className="font-bold">Missing Authentication (CC6.1)</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    src/api/routes/users.py:42
                  </div>
                </div>

                <div className="bg-[#111] p-4 rounded border border-white/5 relative overflow-hidden group">
                  {/* The Code Snippet */}
                  <div className="text-gray-300 space-y-1">
                    <div className="text-gray-600">
                      @app.route(&quot;/api/v1/users/export&quot;, methods=[&quot;POST&quot;])
                    </div>
                    <div className="relative">
                      {step === 2 && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "100%" }}
                          className="absolute inset-0 bg-green-500/10 border-l-2 border-green-500 z-0"
                        />
                      )}
                      <div className="relative z-10 flex">
                        <span className={step === 2 ? "text-green-400" : "text-purple-400"}>
                          def
                        </span>
                        <span className="text-blue-300 ml-2">export_user_data</span>
                        (user_id):
                      </div>
                    </div>
                    <div className="pl-4 text-gray-500"># TODO: Add auth check</div>
                    <div className="pl-4 text-gray-300">
                      data = db.get_user(user_id)
                    </div>
                    <div className="pl-4 text-gray-300">return jsonify(data)</div>
                  </div>

                  {/* Fix Overlay */}
                  {step === 1 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute bottom-4 right-4"
                    >
                      <div className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow-lg flex items-center space-x-2 animate-pulse">
                        <Zap size={12} />
                        <span>Generating Fix...</span>
                      </div>
                    </motion.div>
                  )}
                  {step === 2 && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute top-8 right-10 bg-[#1A1A1A] border border-green-500/30 p-3 rounded shadow-xl"
                    >
                      <div className="text-xs text-green-400 mb-1 flex items-center">
                        <CheckCircle size={10} className="mr-1" /> Fix Applied
                      </div>
                      <code className="text-[10px] text-gray-400">
                        @login_required added
                      </code>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="fixed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-500" />
                </div>
                <div className="text-center">
                  <h3 className="text-white font-bold">Fix Committed</h3>
                  <p className="text-gray-500 text-xs mt-1">
                    c82a1b9 • Added auth decorator to user export
                  </p>
                </div>
                <div className="flex space-x-2 text-xs text-gray-400 bg-white/5 px-3 py-1 rounded-full">
                  <span>Evidence Logged</span>
                  <span className="text-gray-600">|</span>
                  <span>Audit Trail Updated</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// --- SECTIONS ---

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  controlId: string;
  description: string;
  codeSnippet: string;
  delay: number;
}

const FeatureCard = ({
  icon: Icon,
  title,
  controlId,
  description,
  codeSnippet,
  delay,
}: FeatureCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -5, transition: { type: "spring", stiffness: 300, damping: 20 } }}
      className="group relative p-6 bg-[#0E0E0E] rounded-xl border border-white/10 hover:border-white/20 transition-colors overflow-hidden"
    >
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-white/5 rounded-lg inline-flex text-blue-400">
            <Icon size={20} />
          </div>
          <span className="text-xs font-mono text-gray-500 border border-white/10 px-2 py-1 rounded">
            {controlId}
          </span>
        </div>

        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">{description}</p>

        <div className="bg-[#050505] rounded-lg p-3 font-mono text-xs text-gray-300 border border-white/10 group-hover:border-white/20 transition-colors">
          <div className="flex space-x-1.5 mb-2 opacity-50">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
          </div>
          <pre className="overflow-x-auto">
            <code>{codeSnippet}</code>
          </pre>
        </div>
      </div>
    </motion.div>
  );
};

const ArchitectureBlock = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-20">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      whileHover={{ y: -5, transition: { type: "spring", stiffness: 300, damping: 20 } }}
      transition={{ delay: 0, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="p-6 rounded-2xl bg-gradient-to-br from-[#111] to-[#050505] border border-white/10"
    >
      <div className="mb-4 text-emerald-400">
        <Zap />
      </div>
      <h3 className="text-white font-bold mb-2">Regex + Tree-sitter</h3>
      <p className="text-sm text-gray-400">
        Blazing fast initial scan. Ryn parses your AST to understand context
        (functions, classes) before AI ever touches it.
      </p>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      whileHover={{ y: -5, transition: { type: "spring", stiffness: 300, damping: 20 } }}
      transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="p-6 rounded-2xl bg-gradient-to-br from-[#111] to-[#050505] border border-white/10 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-blue-500/5" />
      <div className="mb-4 text-blue-400">
        <Cpu />
      </div>
      <h3 className="text-white font-bold mb-2">Hybrid AI Engine</h3>
      <p className="text-sm text-gray-400">
        Deterministic Rust fallbacks for common issues. LLM analysis only when
        semantic understanding is required.
      </p>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      whileHover={{ y: -5, transition: { type: "spring", stiffness: 300, damping: 20 } }}
      transition={{ delay: 0.2, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="p-6 rounded-2xl bg-gradient-to-br from-[#111] to-[#050505] border border-white/10"
    >
      <div className="mb-4 text-purple-400">
        <Server />
      </div>
      <h3 className="text-white font-bold mb-2">Local & Private</h3>
      <p className="text-sm text-gray-400">
        Your code never leaves your machine unless you opt-in for LLM fixes.
        Embedded SQLite database for audit trails.
      </p>
    </motion.div>
  </div>
);

// --- MAIN APP ---

export default function Home() {
  const [loading, setLoading] = useState(true);
  const { scrollYProgress } = useScroll();
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.5]);

  useLenis();

  const handleBootComplete = React.useCallback(() => {
    setLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30 overflow-x-hidden font-sans">
      <AnimatePresence>
        {loading && <BootLoader onComplete={handleBootComplete} />}
      </AnimatePresence>

      <SecurityGridBackground />

      {!loading && <TopNav />}

      {!loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >

          {/* Hero Section */}
          <section className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto">
            <div className="text-center max-w-4xl mx-auto mb-16 relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
                  <ScrambleText text="SOC 2 compliance that" className="block" />
                  <br />
                  <span className="text-gray-500 line-through decoration-red-500/50 decoration-2">
                    doesn&apos;t suck.
                  </span>
                  <br />
                  <GradientText>actually fixes code.</GradientText>
                </h1>
                <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
                  Find compliance violations in your codebase. Fix them in one click.{" "}
                  <br />
                  A local-first desktop app for developers, not auditors.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                  <DownloadButton
                    className="w-full sm:w-auto"
                  />
                  <a href="https://github.com/AleksandrRise/ryn" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                    <Button variant="secondary" className="w-full space-x-2">
                      <Terminal size={18} />
                      <span>View Source</span>
                    </Button>
                  </a>
                </div>
                <p className="mt-4 text-xs text-gray-500">
                  Free for developers. No credit card required.
                </p>
              </motion.div>
            </div>

            {/* Hero Visual - Simulated App */}
            <motion.div
              style={{ scale, opacity }}
              className="relative z-10 mx-auto max-w-5xl"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl opacity-20 blur-xl" />
              <RynInterface />
            </motion.div>
          </section>

          {/* Differentiation Strip */}
          <section className="border-y border-white/5 bg-white/[0.02] backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-6 py-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <ScrollReveal>
                  <h2 className="text-2xl font-bold mb-2">
                    Not another GRC dashboard.
                  </h2>
                  <p className="text-gray-400">
                    Ryn doesn&apos;t replace Vanta or Drata. It makes your code actually
                    match what those tools say you&apos;re doing. We generate the evidence
                    they ask for.
                  </p>
                </ScrollReveal>
                <ScrollReveal
                  delay={0.2}
                  className="flex justify-start md:justify-end space-x-8 opacity-50 grayscale hover:grayscale-0 transition-all"
                >
                  {/* Just visual placeholders for "compatibility" */}
                  <div className="text-sm font-mono border border-white/20 rounded px-3 py-1">
                    JSON Evidence Export
                  </div>
                  <div className="text-sm font-mono border border-white/20 rounded px-3 py-1">
                    SQLite Direct Access
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </section>

          {/* The Problem / Solution Split */}
          <section className="py-24 max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <ScrollReveal>
                  <h2 className="text-3xl md:text-4xl font-bold mb-6">
                    <ScrambleText
                      text="SOC 2 audits shouldn't require a law degree."
                      className=""
                    />
                  </h2>
                </ScrollReveal>
                <ScrollReveal delay={0.1}>
                  <p className="text-lg text-gray-400 mb-6">
                    Auditors speak in &quot;controls.&quot; Developers speak in code. Ryn
                    translates. It scans for the specific patterns that trigger audit
                    failures—missing auth, hardcoded secrets, and error swallowing—and
                    gives you the exact fix.
                  </p>
                </ScrollReveal>
                <ul className="space-y-4">
                  {[
                    "Maps violations directly to CC6.1, CC6.7, CC7.2",
                    "Generates auditor-friendly evidence trails",
                    "Works offline with local LLM fallbacks",
                    "Cost controls built-in per scan",
                  ].map((item, i) => (
                    <ScrollReveal key={i} delay={0.2 + i * 0.1}>
                      <li className="flex items-center space-x-3 text-gray-300">
                        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <CheckCircle size={12} className="text-blue-400" />
                        </div>
                        <span>{item}</span>
                      </li>
                    </ScrollReveal>
                  ))}
                </ul>
              </div>
              <ScrollReveal delay={0.3} className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-purple-500/10 blur-3xl" />
                <div className="relative bg-[#0A0A0A] border border-white/10 rounded-xl p-8 shadow-2xl">
                  <div className="space-y-6">
                    {/* Abstract representation of "The Old Way" vs "Ryn" */}
                    <div className="flex items-center space-x-4 opacity-40">
                      <div className="w-12 h-12 bg-gray-800 rounded flex items-center justify-center">
                        <FileCode />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="h-2 bg-gray-800 rounded w-3/4" />
                        <div className="h-2 bg-gray-800 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-900/30 text-blue-400 rounded flex items-center justify-center border border-blue-500/30">
                        <Zap />
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-mono text-sm mb-1">
                          Fix detected in src/auth.rs
                        </div>
                        <div className="text-xs text-gray-500">
                          Automated patch • CC6.1 Compliant
                        </div>
                      </div>
                      <Button variant="outline" className="h-8 text-xs px-3">
                        Apply
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* Mapped Controls Section */}
          <section className="py-24 bg-[#080808]">
            <div className="max-w-7xl mx-auto px-6">
              <ScrollReveal className="mb-16">
                <h2 className="text-3xl font-bold mb-4">
                  Mapped directly to controls.
                </h2>
                <p className="text-gray-400 max-w-2xl">
                  We don&apos;t just find bugs. We find the specific implementation gaps
                  that auditors look for, using a hybrid engine of regex rules and
                  semantic AI analysis.
                </p>
              </ScrollReveal>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FeatureCard
                  icon={Lock}
                  controlId="CC6.1"
                  title="Access Control"
                  description="Detects routes and endpoints missing authentication decorators or middleware checks."
                  codeSnippet={`@app.route("/admin") \n# Violation: Missing @login_required`}
                  delay={0}
                />
                <FeatureCard
                  icon={Eye}
                  controlId="CC6.7"
                  title="Secrets Management"
                  description="Identifies hardcoded keys, tokens, and connection strings before they hit production."
                  codeSnippet={`const stripeKey = "sk_live_..." \n// Violation: Hardcoded secret`}
                  delay={0.1}
                />
                <FeatureCard
                  icon={Database}
                  controlId="CC7.2"
                  title="Audit Logging"
                  description="Ensures critical data mutations (create/update/delete) have corresponding audit log entries."
                  codeSnippet={`db.users.delete(id) \n// Violation: No audit_log.create()`}
                  delay={0.2}
                />
                <FeatureCard
                  icon={Server}
                  controlId="A1.2"
                  title="Resilience"
                  description="Finds external API calls and database queries lacking timeouts or error handling."
                  codeSnippet={`requests.get(url) \n# Violation: Missing timeout=`}
                  delay={0.3}
                />
              </div>

              <ArchitectureBlock />
            </div>
          </section>

          {/* Pricing / Open Source */}
          <section className="py-40 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/10 via-transparent to-purple-900/10" />
              <div className="absolute top-20 left-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
            </div>


            <div className="max-w-5xl mx-auto px-6 relative z-10">
              {/* Main heading section */}
              <div className="text-center mb-20">
                <motion.h2
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ margin: "-100px" }}
                  transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="text-8xl md:text-9xl lg:text-[12rem] font-black tracking-tighter mb-6 leading-none uppercase"
                >
                  <motion.span
                    className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-blue-300 to-purple-300"
                    animate={{
                      backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                    }}
                    transition={{ duration: 3, repeatType: "loop" }}
                    style={{
                      backgroundSize: "200% 200%",
                    }}
                  >
                    Free
                  </motion.span>
                  <span className="text-white">.</span>
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ margin: "-100px" }}
                  transition={{ duration: 0.6, delay: 0.15 }}
                  className="text-xl text-gray-300 max-w-3xl mx-auto mb-12"
                >
                  No account. No credit card. No hidden costs. Your code stays local, always.
                </motion.p>

                {/* What's included */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ margin: "-50px" }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="flex flex-wrap justify-center gap-6 max-w-3xl mx-auto"
                >
                  {[
                    { icon: Zap, label: "Unlimited Scans" },
                    { icon: Github, label: "100% Open Source" },
                    { icon: Server, label: "Totally Private" },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ margin: "-50px" }}
                        transition={{ delay: 0.35 + i * 0.1, duration: 0.5 }}
                        className="flex items-center gap-2 text-gray-400"
                      >
                        <Icon size={18} className="text-emerald-400" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>

              {/* CTA Section */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ margin: "-50px" }}
                transition={{ duration: 0.8 }}
                className="flex flex-col items-center gap-6"
              >
                {/* Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <DownloadButton />
                  <motion.a
                    href="https://github.com/AleksandrRise/ryn"
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ x: 4 }}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <Github size={18} />
                    <span className="text-sm">View on GitHub</span>
                  </motion.a>
                </div>
              </motion.div>

              {/* Supporting text */}
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ margin: "-50px" }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="text-gray-500 text-sm text-center max-w-xl mx-auto mt-12"
              >
                Built by developers who got tired of $50k/year compliance tools. Ryn does both: scans <span className="text-white font-semibold">and</span> fixes.
              </motion.p>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-white/10 bg-black pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                <div className="col-span-2">
                  <div className="flex items-center space-x-2 mb-4">
                    <img src="/ryn-logo.svg" alt="Ryn" className="w-6 h-6" />
                  </div>
                  <p className="text-gray-500 text-sm max-w-sm">
                    A comprehensive compliance scanner built on Tauri, Rust, and
                    Next.js. Designed to make security audits invisible.
                  </p>
                </div>
                <div>
                  <h4 className="text-white font-bold mb-4">Product</h4>
                  <ul className="space-y-2 text-sm text-gray-500">
                    <li>
                      <a href="https://github.com/AleksandrRise/ryn/releases/tag/release-alpha" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">
                        Changelog
                      </a>
                    </li>
                    <li>
                      <a href="https://github.com/AleksandrRise/ryn#readme" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">
                        Documentation
                      </a>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-white font-bold mb-4">Community</h4>
                  <ul className="space-y-2 text-sm text-gray-500">
                    <li>
                      <a href="https://github.com/AleksandrRise/ryn" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">
                        GitHub
                      </a>
                    </li>
                    <li>
                      <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">
                        Discord
                      </a>
                    </li>
                    <li>
                      <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">
                        Twitter
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="flex flex-col md:flex-row justify-between items-center border-t border-white/5 pt-8">
                <p className="text-xs text-gray-600">
                  © 2024 Ryn Security Inc. All rights reserved.
                </p>
                <p className="text-xs text-gray-600 flex items-center mt-4 md:mt-0">
                  Built with Tauri, Rust, and spite. <Code2 size={12} className="ml-2" />
                </p>
              </div>
            </div>
          </footer>
        </motion.div>
      )}
    </div>
  );
}
