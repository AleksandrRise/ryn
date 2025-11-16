'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AlertCircleIcon, BrainCircuitIcon, ZapIcon, ScanSearchIcon } from 'lucide-react'

type ScanMode = 'regex_only' | 'smart' | 'analyze_all'

interface ScanModeOnboardingProps {
  open: boolean
  onComplete: (scanMode: ScanMode, costLimit: number) => void
}

export function ScanModeOnboarding({ open, onComplete }: ScanModeOnboardingProps) {
  const [selectedMode, setSelectedMode] = useState<ScanMode>('smart')
  const [costLimit, setCostLimit] = useState<string>('5.00')
  const [error, setError] = useState<string>('')

  const handleSubmit = () => {
    // Validate cost limit
    const parsedCostLimit = parseFloat(costLimit)

    if (isNaN(parsedCostLimit) || parsedCostLimit < 0) {
      setError('Please enter a valid cost limit (minimum $0.00)')
      return
    }

    if (parsedCostLimit > 1000) {
      setError('Cost limit cannot exceed $1,000.00')
      return
    }

    // Clear any errors
    setError('')

    // Call completion handler
    onComplete(selectedMode, parsedCostLimit)
  }

  return (
    <Dialog open={open} onOpenChange={() => {}} modal>
      <DialogContent className="sm:max-w-[600px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to Ryn</DialogTitle>
          <DialogDescription className="text-base">
            Choose how Ryn scans your code for SOC 2 compliance violations.
            You can change these settings later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Scanning Mode Selection */}
          <div className="grid gap-4">
            <Label className="text-base font-semibold">Scanning Mode</Label>
            <RadioGroup value={selectedMode} onValueChange={(value) => setSelectedMode(value as ScanMode)}>
              {/* Pattern-Only Mode */}
              <div className="border border-white/10 bg-white/5 rounded-lg p-4 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer"
                   onClick={() => setSelectedMode('regex_only')}>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="regex_only" id="regex_only" className="mt-1" />
                  <div className="grid gap-2 flex-1">
                    <div className="flex items-center gap-2">
                      <ZapIcon className="size-4 text-yellow-500" />
                      <Label htmlFor="regex_only" className="font-semibold text-base cursor-pointer">
                        Pattern-Only (Free)
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Fast regex-based detection using hardcoded patterns. No AI analysis.
                      Great for quick scans but may miss complex security issues.
                    </p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>• Instant results</span>
                      <span>• No cost</span>
                      <span>• Pattern matching only</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Smart Mode (Recommended) */}
              <div className="border border-white/20 bg-white/10 rounded-lg p-4 hover:bg-white/15 hover:border-white/30 transition-all duration-300 cursor-pointer"
                   onClick={() => setSelectedMode('smart')}>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="smart" id="smart" className="mt-1" />
                  <div className="grid gap-2 flex-1">
                    <div className="flex items-center gap-2">
                      <BrainCircuitIcon className="size-4 text-blue-500" />
                      <Label htmlFor="smart" className="font-semibold text-base cursor-pointer">
                        Smart (Recommended)
                      </Label>
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Combines regex patterns with AI analysis for security-relevant files.
                      Analyzes ~30-40% of files using Claude Haiku for semantic understanding.
                    </p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>• Best balance</span>
                      <span>• Catches semantic issues</span>
                      <span>• Cost-effective</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analyze All Mode */}
              <div className="border border-white/10 bg-white/5 rounded-lg p-4 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer"
                   onClick={() => setSelectedMode('analyze_all')}>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="analyze_all" id="analyze_all" className="mt-1" />
                  <div className="grid gap-2 flex-1">
                    <div className="flex items-center gap-2">
                      <ScanSearchIcon className="size-4 text-purple-500" />
                      <Label htmlFor="analyze_all" className="font-semibold text-base cursor-pointer">
                        Analyze All (Comprehensive)
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      AI analyzes every file for maximum accuracy. Best for critical applications
                      or first-time comprehensive audits. Higher cost.
                    </p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>• Maximum accuracy</span>
                      <span>• Every file analyzed</span>
                      <span>• Higher cost</span>
                    </div>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Cost Limit (only shown for AI modes) */}
          {(selectedMode === 'smart' || selectedMode === 'analyze_all') && (
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="cost_limit" className="text-base font-semibold">
                  Cost Limit Per Scan
                </Label>
                <div className="text-xs text-muted-foreground">
                  (AI analysis uses Claude Haiku)
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="cost_limit"
                      type="number"
                      min="0"
                      max="1000"
                      step="0.01"
                      value={costLimit}
                      onChange={(e) => setCostLimit(e.target.value)}
                      className="pl-7"
                      placeholder="5.00"
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-1.5 mt-2 text-sm text-destructive">
                      <AlertCircleIcon className="size-4" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Ryn will pause and ask for approval if a scan approaches this limit.
                Typical costs: $0.50-$2.00 for most projects in Smart mode.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} className="w-full sm:w-auto">
            Continue with {selectedMode === 'regex_only' ? 'Pattern-Only' : selectedMode === 'smart' ? 'Smart' : 'Analyze All'} Mode
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
