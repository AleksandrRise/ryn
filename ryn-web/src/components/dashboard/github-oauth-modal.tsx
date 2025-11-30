"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Copy, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface GitHubOAuthModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

type OAuthState = "starting" | "waiting" | "polling" | "success" | "error";

export function GitHubOAuthModal({ onSuccess, onClose }: GitHubOAuthModalProps) {
  const supabase = createClient();
  const [state, setState] = useState<OAuthState>("starting");
  const [deviceCode, setDeviceCode] = useState("");
  const [userCode, setUserCode] = useState("");
  const [pollInterval, setPollInterval] = useState(5000);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Start OAuth flow
  useEffect(() => {
    const startOAuth = async () => {
      try {
        setState("starting");
        const response = await fetch("/api/github/device-code", {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Failed to get device code");
        }

        const data = await response.json();
        setDeviceCode(data.device_code);
        setUserCode(data.user_code);
        setPollInterval(data.interval * 1000 || 5000);
        setState("waiting");
      } catch (err: any) {
        setError(err.message || "Failed to start GitHub authorization");
        setState("error");
      }
    };

    startOAuth();
  }, []);

  // Poll for authorization completion
  useEffect(() => {
    if (state !== "waiting" && state !== "polling") return;

    const pollAuth = async () => {
      try {
        setState("polling");
        const response = await fetch("/api/github/device-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_code: deviceCode }),
        });

        if (!response.ok) {
          if (response.status === 400 || response.status === 401) {
            // Still waiting for user authorization
            return;
          }
          throw new Error("Failed to check authorization");
        }

        const data = await response.json();

        // Save GitHub connection to database
        const { data: { user } } = await supabase.auth.getUser();
        if (user && data.access_token) {
          await supabase
            .from("github_connections")
            .upsert({
              user_id: user.id,
              access_token: data.access_token,
              github_username: data.github_username,
              connected_at: new Date().toISOString(),
            });
        }

        setState("success");
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } catch (err: any) {
        setError(err.message || "Authorization failed");
        setState("error");
      }
    };

    const interval = setInterval(pollAuth, pollInterval);
    return () => clearInterval(interval);
  }, [state, deviceCode, pollInterval, supabase, onSuccess]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(userCode);
    setCopied(true);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenGitHub = () => {
    window.open(
      `https://github.com/login/device?user_code=${userCode}`,
      "_blank"
    );
  };

  const handleRetry = () => {
    setError(null);
    setState("starting");
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={state === "error" ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-gradient-to-br from-[#0f0f16] to-[#1a1a24] border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-lg font-semibold">Connect GitHub</h2>
            <p className="text-xs text-white/50 mt-1">
              {state === "success"
                ? "Authorization complete"
                : "Authorize with GitHub"}
            </p>
          </div>
          {state !== "polling" && state !== "waiting" && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {state === "starting" && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-12 h-12 rounded-full border-2 border-blue-400/50 border-t-blue-400 animate-spin mb-4" />
              <p className="text-white/70">Initializing...</p>
            </div>
          )}

          {state === "waiting" && userCode && (
            <div className="space-y-6">
              {/* Step 1: Copy Code */}
              <div className="space-y-3">
                <p className="text-sm text-white/80">
                  Copy your authorization code:
                </p>
                <div className="relative">
                  <input
                    type="text"
                    value={userCode}
                    readOnly
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-center font-mono font-bold text-lg text-white/90 cursor-pointer"
                  />
                  <button
                    onClick={handleCopyCode}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded transition-colors"
                  >
                    {copied ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-white/60" />
                    )}
                  </button>
                </div>
              </div>

              {/* Step 2: Open GitHub */}
              <div className="space-y-3">
                <p className="text-sm text-white/80">
                  Go to GitHub and enter the code above:
                </p>
                <button
                  onClick={handleOpenGitHub}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <i className="lab la-github text-lg" />
                  Open GitHub
                </button>
              </div>

              {/* Step 3: Wait */}
              <p className="text-xs text-white/50 text-center">
                We're waiting for you to authorize on GitHub...
              </p>
            </div>
          )}

          {state === "polling" && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="space-y-4 w-full">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-2 bg-white/20 rounded-full overflow-hidden"
                  >
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{
                        animation: `slideIn 1s ease-in-out infinite`,
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-white/70 mt-6 text-center text-sm">
                Checking authorization...
              </p>
            </div>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white">
                  Connected!
                </h3>
                <p className="text-sm text-white/60 mt-1">
                  Your GitHub account is now connected
                </p>
              </div>
            </div>
          )}

          {state === "error" && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-400">
                    Authorization failed
                  </p>
                  <p className="text-sm text-white/60 mt-1">{error}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleRetry}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          0% {
            width: 0%;
          }
          50% {
            width: 100%;
          }
          100% {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}
