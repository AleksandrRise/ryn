"use client"

import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  start_github_oauth,
  poll_github_oauth,
  type DeviceCodeResponse,
} from "@/lib/tauri/commands"
import { open } from "@tauri-apps/plugin-shell"

interface GitHubOAuthModalProps {
  onSuccess: () => void
  onClose: () => void
}

const isActivationKey = (event: KeyboardEvent) => event.key === "Enter" || event.key === " "

export function GitHubOAuthModal({ onSuccess, onClose }: GitHubOAuthModalProps) {
  const [step, setStep] = useState<"starting" | "waiting" | "polling" | "success" | "error">("starting")
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startOAuth = useCallback(async () => {
    try {
      const response = await start_github_oauth()
      setDeviceCode(response)
      setStep("waiting")

      await open(response.verification_uri)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStep("error")
    }
  }, [])

  useEffect(() => {
    // Starting OAuth on mount is intentional to avoid requiring an extra user click
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void startOAuth()
  }, [startOAuth])

  const startPolling = useCallback(() => {
    if (!deviceCode) {
      setError("Authorization device code missing. Please restart GitHub connect.")
      setStep("error")
      return
    }

    setStep("polling")

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const completed = await poll_github_oauth()
        if (completed) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
          }
          setStep("success")
          setTimeout(() => {
            onSuccess()
          }, 1500)
        }
      } catch (err) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
        }
        setError(err instanceof Error ? err.message : String(err))
        setStep("error")
      }
    }, (deviceCode.interval || 5) * 1000)
  }, [deviceCode, onSuccess])

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const copyCode = () => {
    if (deviceCode?.user_code) {
      navigator.clipboard.writeText(deviceCode.user_code)
    }
  }

  const canDismissOverlay = step === "error"

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/82 backdrop-blur-[10px] animate-fadeIn"
        onClick={canDismissOverlay ? onClose : undefined}
        role={canDismissOverlay ? "button" : undefined}
        tabIndex={canDismissOverlay ? 0 : undefined}
        aria-label={canDismissOverlay ? "Close GitHub OAuth dialog" : undefined}
        onKeyDown={
          canDismissOverlay
            ? (event) => {
                if (isActivationKey(event)) {
                  event.preventDefault()
                  onClose()
                }
              }
            : undefined
        }
        aria-hidden={!canDismissOverlay}
      />
      <div
        className="relative w-full max-w-xl overflow-hidden animate-fadeIn rounded-3xl border border-white/12 shadow-[0_40px_160px_rgba(0,0,0,0.65)]"
        style={{
          background: "radial-gradient(120% 140% at 20% 20%, rgba(37,244,187,0.08), transparent), radial-gradient(120% 160% at 80% 10%, rgba(6,182,212,0.08), transparent), rgba(6,8,12,0.96)",
        }}
      >
        <div className="px-7 py-5 flex items-center justify-between bg-white/[0.04] border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 flex items-center justify-center text-white shadow-[0_10px_35px_rgba(16,185,129,0.35)]">
              <i className="lab la-github text-2xl drop-shadow"></i>
            </div>
            <div>
              <h2 className="font-semibold text-lg tracking-tight">Connect GitHub</h2>
              <p className="text-xs text-white/55">
                {step === "starting" && "Initializing…"}
                {step === "waiting" && "Authorize in browser"}
                {step === "polling" && "Waiting for authorization…"}
                {step === "success" && "Connected successfully!"}
                {step === "error" && "Connection failed"}
              </p>
            </div>
          </div>
          {step !== "polling" && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl hover:bg-white/[0.08] flex items-center justify-center transition-colors text-white/50"
            >
              <i className="las la-times text-lg"></i>
            </button>
          )}
        </div>

        <div className="px-7 py-8">
          {step === "starting" && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 flex items-center justify-center animate-pulse">
                <i className="lab la-github text-3xl text-emerald-400"></i>
              </div>
              <p className="text-sm text-white/50">Starting OAuth flow...</p>
            </div>
          )}

          {step === "waiting" && deviceCode && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 flex items-center justify-center">
                <i className="lab la-github text-4xl text-emerald-400"></i>
              </div>
              <h3 className="font-semibold mb-2">Enter this code</h3>
              <p className="text-sm text-white/50 mb-4">A browser window should have opened. Enter this code:</p>

              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="px-6 py-4 bg-white/[0.06] rounded-xl border border-white/[0.08]">
                  <div className="text-2xl font-mono font-bold tracking-widest">{deviceCode.user_code}</div>
                </div>
                <button
                  onClick={copyCode}
                  className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                  title="Copy code"
                >
                  <i className="las la-copy text-white/60"></i>
                </button>
              </div>

              <div className="space-y-2 mb-6">
                <button
                  onClick={() => open(deviceCode.verification_uri)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-sm"
                >
                  <i className="las la-external-link-alt mr-2"></i>
                  Open GitHub Authorization
                </button>
              </div>

              <button
                onClick={startPolling}
                className="group relative w-full px-6 py-3 rounded-xl font-medium text-sm overflow-hidden transition-all hover:scale-[1.02]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 opacity-90 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative text-white">I&apos;ve authorized, continue</span>
              </button>
            </div>
          )}

          {step === "polling" && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 flex items-center justify-center">
                <i className="lab la-github text-3xl text-emerald-400 animate-pulse"></i>
              </div>
              <h3 className="font-semibold mb-2">Checking authorization...</h3>
              <p className="text-sm text-white/50">This may take a few seconds</p>
              <div className="mt-4 flex items-center justify-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/15 border border-white/8 flex items-center justify-center shadow-[0_20px_60px_rgba(16,185,129,0.35)]">
                <i className="las la-check text-4xl text-emerald-400"></i>
              </div>
              <h3 className="font-semibold mb-2">Successfully Connected!</h3>
              <p className="text-sm text-white/50">Loading your repositories...</p>
            </div>
          )}

          {step === "error" && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-red-500/28 to-orange-500/18 border border-white/8 flex items-center justify-center shadow-[0_18px_55px_rgba(248,113,113,0.25)]">
                <i className="las la-exclamation-triangle text-4xl text-red-200"></i>
              </div>
              <h3 className="font-semibold text-lg mb-2">Connection Failed</h3>
              <p className="text-sm text-white/60 mb-6 leading-relaxed">{error || "An error occurred"}</p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 border-white/12 bg-white/6 hover:bg-white/10" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 border-0 shadow-[0_12px_40px_rgba(16,185,129,0.4)] hover:brightness-110"
                  onClick={startOAuth}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
