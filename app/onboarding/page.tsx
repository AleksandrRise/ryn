'use client'

import React, { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence, easeOut, easeIn } from "framer-motion"
import { Button } from "@/components/ui/button"
import { RadioGroup } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Folder,
  ZapIcon,
  BrainCircuitIcon,
  ScanSearchIcon,
  Bell,
  CheckCircle2,
  ChevronRight,
  Shield,
} from "lucide-react"
import { open } from "@tauri-apps/plugin-dialog"
import { create_project, detect_framework, get_settings, complete_onboarding } from "@/lib/tauri/commands"
import { useProjectStore } from "@/lib/stores/project-store"
import { handleTauriError, showSuccess, showInfo } from "@/lib/utils/error-handler"
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification"
import { useScanRunner } from "@/components/scan/hooks/use-scan-runner"
import { ScanProgressCard } from "@/components/scan/scan-progress-card"
import { FrameworkBadge } from "@/components/ui/framework-badge"

type ScanMode = "regex_only" | "smart" | "analyze_all"

const isTauri = typeof window !== "undefined" && Boolean((window as any).__TAURI__)

interface Step {
  id: string
  title: string
  description: string
}

const steps: Step[] = [
  { id: "project", title: "Choose your codebase", description: "Pick the folder you want Ryn to scan." },
  { id: "scan", title: "Set how deep to scan", description: "Select scan mode and guardrails for cost." },
  { id: "notify", title: "Stay informed", description: "Enable desktop alerts for scans and cost limits." },
  { id: "finish", title: "Launch", description: "Review choices and start your first scan." },
]

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { selectedProject, setSelectedProject } = useProjectStore()
  const {
    isScanning,
    startScan,
    progress,
  } = useScanRunner(selectedProject?.id, {
    onScanCompleted: () => router.replace("/scan"),
    onScanStopped: () => router.replace("/scan"),
  })

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [selectedMode, setSelectedMode] = useState<ScanMode>("smart")
  const [costLimit, setCostLimit] = useState<string>("5.00")
  const [error, setError] = useState<string>("")
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [notificationStatus, setNotificationStatus] = useState<"unknown" | "granted" | "denied">("unknown")
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showStartPrompt, setShowStartPrompt] = useState(false)
  const [showIntro, setShowIntro] = useState(true)

  useEffect(() => {
    let mounted = true
    const check = async () => {
      if (!isTauri) {
        setCheckingStatus(false)
        return
      }
      try {
        const settings = await get_settings()
        const onboardingCompleted = settings.find((s) => s.key === "onboarding_completed")
        const force = searchParams?.get("force") === "1"
        if (onboardingCompleted?.value === "true" && !force) {
          router.replace("/")
          return
        }
      } catch (err) {
        console.warn("[onboarding] failed to check onboarding", err)
      } finally {
        if (mounted) setCheckingStatus(false)
      }
    }
    void check()
    return () => {
      mounted = false
    }
  }, [router, searchParams])

  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 1200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const checkPermission = async () => {
      if (!isTauri) return
      try {
        const granted = await isPermissionGranted()
        setNotificationStatus(granted ? "granted" : "unknown")
      } catch (err) {
        console.warn("[onboarding] notification permission check failed", err)
      }
    }
    void checkPermission()
  }, [])

  const currentStep = steps[currentStepIndex]

  const canContinueProject = useMemo(() => {
    if (!isTauri) return true
    return Boolean(selectedProject)
  }, [selectedProject])

  const handleSelectProject = async () => {
    if (!isTauri) {
      setError("Project selection is available in the desktop app.")
      return
    }

    setError("")
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder",
      })

      if (selected && typeof selected === "string") {
        showInfo("Detecting project details...")
        const framework = await detect_framework(selected)
        const project = await create_project(selected, undefined, framework)
        setSelectedProject(project)
        showSuccess(`Project "${project.name}" loaded`)
      }
    } catch (err) {
      handleTauriError(err, "Failed to select project")
    }
  }

  const validateCost = () => {
    const parsed = parseFloat(costLimit)
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Enter a valid cost limit (min $0.00).")
      return null
    }
    if (parsed > 1000) {
      setError("Cost limit cannot exceed $1,000.00.")
      return null
    }
    setError("")
    return parsed
  }

  const requestNotifications = async () => {
    if (!isTauri) {
      setNotificationStatus("unknown")
      return
    }
    setIsRequestingPermission(true)
    try {
      let granted = await isPermissionGranted()
      if (!granted) {
        const result = await requestPermission()
        granted = result === "granted"
      }
      if (granted) {
        await sendNotification({ title: "Notifications enabled", body: "Ryn will alert you about scans here." })
        setNotificationStatus("granted")
      } else {
        setNotificationStatus("denied")
      }
    } catch (err) {
      console.error("[onboarding] notification request failed", err)
      setNotificationStatus("denied")
    } finally {
      setIsRequestingPermission(false)
    }
  }

  const handleNext = () => {
    if (currentStep.id === "project" && isTauri && !selectedProject) {
      setError("Pick a project to continue.")
      return
    }
    if (currentStep.id === "scan") {
      const parsed = validateCost()
      if (parsed === null) return
    }
    setError("")
    setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1))
  }

  const handleBack = () => {
    setError("")
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0))
  }

  const handleFinish = async () => {
    const parsedCost = validateCost()
    if (parsedCost === null) return

    if (!showStartPrompt) {
      setShowStartPrompt(true)
      return
    }

    setIsSaving(true)
    try {
      if (isTauri) {
        await complete_onboarding(selectedMode, parsedCost)
        showSuccess("Onboarding saved. You’re ready to scan.")
        if (selectedProject) {
          showInfo("Starting your first scan...")
          await startScan()
          return
        }
      }
      router.replace("/scan")
    } catch (err) {
      handleTauriError(err, "Failed to save onboarding")
    } finally {
      setIsSaving(false)
    }
  }

  if (checkingStatus) return null

  const stepVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.25, ease: easeIn } },
  }

  const cardVariants = {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: easeOut } },
    whileHover: { scale: 1.01 },
    whileTap: { scale: 0.99 },
  }

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <AnimatePresence>{showIntro && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.45 } }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.35 } }}
            className="flex flex-col items-center gap-3"
          >
            <div className="text-4xl font-bold tracking-tight">ryn</div>
            <div className="text-sm text-white/60">Welcome. Let’s set you up.</div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm">Welcome to Ryn</p>
            <h1 className="text-4xl font-semibold tracking-tight mt-1">Secure your project in minutes</h1>
            <p className="text-white/50 mt-2 text-sm">
              A short guided setup: pick your codebase, choose how deep to scan, enable alerts, and run your first scan.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-sm text-white/70">
            <Shield className="w-4 h-4" />
            Data stays on your machine when scanning locally.
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
          <aside className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {steps.map((step, index) => {
                  const isActive = index === currentStepIndex
                  const isDone = index < currentStepIndex
                  return (
                    <motion.div
                      key={step.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                        isActive ? "bg-white/10 border border-white/15" : "bg-transparent"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                          isDone ? "bg-emerald-500/30 text-emerald-200" : isActive ? "bg-white/20" : "bg-white/5 text-white/50"
                        }`}
                      >
                        {isDone ? "✓" : index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{step.title}</div>
                        <div className="text-xs text-white/60">{step.description}</div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </aside>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-6 overflow-hidden">
            <AnimatePresence mode="wait">
              {currentStep.id === "project" && (
                <motion.div key="step-project" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Folder className="w-5 h-5 text-blue-300" />
                  <div>
                    <h2 className="text-xl font-semibold">Choose your project</h2>
                    <p className="text-white/60 text-sm">Pick the folder Ryn should scan. You can change this later.</p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white/60">Current selection</div>
                        <div className="text-lg font-semibold">
                          {selectedProject?.name || "No project selected"}
                        </div>
                        <div className="text-xs text-white/50 truncate max-w-xl">
                          {selectedProject?.path || "Choose a folder to continue."}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSelectProject} variant="outline" className="gap-2" disabled={!isTauri}>
                          <Folder className="w-4 h-4" />
                          Choose folder
                        </Button>
                        {selectedProject && <FrameworkBadge framework={selectedProject.framework} />}
                      </div>
                    </div>
                    {!isTauri && (
                      <div className="text-xs text-amber-300/80">
                        Connect a project in the desktop app to run scans. You can still explore the UI here.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 text-sm text-white/60">
                  <div>• Keep the app open while scanning large repos.</div>
                  <div>• We only read files inside the folder you pick.</div>
                  <div>• You can add ignores later in settings.</div>
                </div>

                {error && <div className="text-sm text-red-300">{error}</div>}
              </div>
                </motion.div>
              )}

              {currentStep.id === "scan" && (
                <motion.div key="step-scan" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold">Pick how deep to scan</h2>
                  <p className="text-white/60 text-sm">Choose a mode and set a cost limit for AI scans.</p>
                </div>

                <RadioGroup value={selectedMode} onValueChange={(v) => setSelectedMode(v as ScanMode)} className="space-y-3">
                  <ModeCard
                    value="regex_only"
                    selected={selectedMode === "regex_only"}
                    title="Pattern-only"
                    badge="Free"
                    icon={<ZapIcon className="w-4 h-4 text-yellow-400" />}
                    description="Fast regex-based detection. Great for quick, zero-cost passes."
                    bullets={["Instant results", "No AI cost", "May miss semantic issues"]}
                    onSelect={() => setSelectedMode("regex_only")}
                  />
                  <ModeCard
                    value="smart"
                    selected={selectedMode === "smart"}
                    title="Smart (recommended)"
                    badge="Balanced"
                    icon={<BrainCircuitIcon className="w-4 h-4 text-blue-300" />}
                    description="Combines patterns with AI on important files. Good coverage with sensible spend."
                    bullets={["Best balance", "Catches semantic issues", "Keeps costs low"]}
                    onSelect={() => setSelectedMode("smart")}
                  />
                  <ModeCard
                    value="analyze_all"
                    selected={selectedMode === "analyze_all"}
                    title="Analyze all"
                    badge="Thorough"
                    icon={<ScanSearchIcon className="w-4 h-4 text-purple-300" />}
                    description="AI analyzes every file. Use for first-time deep audits or high-risk code."
                    bullets={["Max coverage", "Higher cost", "Thorough review"]}
                    onSelect={() => setSelectedMode("analyze_all")}
                  />
                </RadioGroup>

                {(selectedMode === "smart" || selectedMode === "analyze_all") && (
                  <div className="space-y-2">
                    <Label htmlFor="cost_limit" className="text-sm font-semibold">Cost limit per scan</Label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">$</span>
                        <Input
                          id="cost_limit"
                          type="number"
                          min="0"
                          max="1000"
                          step="0.01"
                          value={costLimit}
                          onChange={(e) => setCostLimit(e.target.value)}
                          className="pl-7"
                        />
                      </div>
                      <div className="text-xs text-white/60">
                        Typical smart scans: $0.50–$2.00
                      </div>
                    </div>
                    {error && <div className="text-sm text-red-300">{error}</div>}
                  </div>
                )}
              </div>
                </motion.div>
              )}

              {currentStep.id === "notify" && (
                <motion.div key="step-notify" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-emerald-300" />
                  <div>
                    <h2 className="text-xl font-semibold">Stay in the loop</h2>
                    <p className="text-white/60 text-sm">Desktop alerts for scan progress and cost limits.</p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/40 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Desktop notifications</div>
                      <div className="text-xs text-white/60">We’ll ping when scans finish or approach the cost cap.</div>
                    </div>
                    <Button
                      onClick={requestNotifications}
                      variant="outline"
                      className="gap-2"
                      disabled={!isTauri || isRequestingPermission}
                    >
                      <Bell className="w-4 h-4" />
                      {notificationStatus === "granted" ? "Enabled" : "Enable"}
                    </Button>
                  </div>
                  <div className="text-xs text-white/60">
                    Status: {notificationStatus === "granted" ? "Granted" : notificationStatus === "denied" ? "Denied" : "Not requested"}
                  </div>
                  {!isTauri && (
                    <div className="text-xs text-amber-300/80">
                      Enable desktop notifications from the installed app to get OS-level alerts.
                    </div>
                  )}
                </div>
              </div>
                </motion.div>
              )}

              {currentStep.id === "finish" && (
                <motion.div key="step-finish" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                  <div>
                    <h2 className="text-xl font-semibold">You’re set</h2>
                    <p className="text-white/60 text-sm">We’ll save these choices and launch the scan workspace.</p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/40 p-4 grid gap-3">
                  <SummaryRow label="Project" value={selectedProject?.name || "None yet"} />
                  <SummaryRow label="Scan mode" value={
                    selectedMode === "regex_only"
                      ? "Pattern-only"
                      : selectedMode === "smart"
                        ? "Smart"
                        : "Analyze all"
                  } />
                  <SummaryRow
                    label="Cost limit"
                    value={selectedMode === "regex_only" ? "No AI cost" : `$${costLimit || "5.00"}`}
                  />
                  <SummaryRow
                    label="Notifications"
                    value={
                      isTauri
                        ? notificationStatus === "granted"
                          ? "Enabled"
                          : "Not enabled"
                        : "Available in desktop app"
                    }
                  />
                </div>

                {showStartPrompt && (
                  <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-white/80">Choose a scan type to start</div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <motion.button
                        onClick={() => { setSelectedMode("regex_only"); void handleFinish(); }}
                        variants={cardVariants}
                        initial="initial"
                        animate="animate"
                        whileHover="whileHover"
                        whileTap="whileTap"
                        className="rounded-lg border border-white/10 bg-black/40 p-3 text-left"
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <ZapIcon className="w-4 h-4 text-yellow-300" /> Pattern-only
                        </div>
                        <div className="text-xs text-white/60 mt-1">Fast, zero-cost regex pass.</div>
                      </motion.button>
                      <motion.button
                        onClick={() => { setSelectedMode("smart"); void handleFinish(); }}
                        variants={cardVariants}
                        initial="initial"
                        animate="animate"
                        whileHover="whileHover"
                        whileTap="whileTap"
                        className="rounded-lg border border-white/10 bg-black/40 p-3 text-left"
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <BrainCircuitIcon className="w-4 h-4 text-blue-300" /> Smart
                        </div>
                        <div className="text-xs text-white/60 mt-1">Balanced coverage with AI on key files.</div>
                      </motion.button>
                      <motion.button
                        onClick={() => { setSelectedMode("analyze_all"); void handleFinish(); }}
                        variants={cardVariants}
                        initial="initial"
                        animate="animate"
                        whileHover="whileHover"
                        whileTap="whileTap"
                        className="rounded-lg border border-white/10 bg-black/40 p-3 text-left"
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <ScanSearchIcon className="w-4 h-4 text-purple-300" /> Analyze all
                        </div>
                        <div className="text-xs text-white/60 mt-1">AI on every file for maximum depth.</div>
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
                </motion.div>
              )}

            </AnimatePresence>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={currentStepIndex === 0}
                className="text-white/70 hover:text-white"
              >
                Back
              </Button>

              {currentStep.id !== "finish" ? (
                <Button onClick={handleNext} className="gap-2">
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={handleFinish} className="gap-2" disabled={isSaving || isScanning}>
                  {isScanning ? "Starting first scan..." : "Start using Ryn"}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>

            {isScanning && (
              <div className="pt-4 border-t border-white/10">
                <ScanProgressCard progress={progress} onCancel={() => undefined} />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingContent />
    </Suspense>
  )
}

interface ModeCardProps {
  value: ScanMode
  selected: boolean
  title: string
  description: string
  bullets: string[]
  badge: string
  icon: React.ReactNode
  onSelect: () => void
}

function ModeCard({ selected, title, description, bullets, badge, icon, onSelect }: ModeCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`border rounded-xl p-4 cursor-pointer transition-colors ${
        selected ? "border-white/30 bg-white/10" : "border-white/10 bg-black/30 hover:border-white/20"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/10">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{title}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 border border-white/15">{badge}</span>
            </div>
            <p className="text-sm text-white/60">{description}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 text-xs text-white/60">
        {bullets.map((b) => (
          <span key={b} className="px-2 py-1 rounded-full bg-white/5 border border-white/10">{b}</span>
        ))}
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm text-white/80">
      <span className="text-white/60">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
