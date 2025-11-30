"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { ScanResults } from "@/components/scan/scan-results"
import type { Project } from "@/lib/types"

export default function ScanPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("user_id", user.id)

        if (!error && data && data.length > 0) {
          setProjects(data)
          setSelectedProject(data[0])
        }
      } catch (error) {
        console.error("Failed to load projects:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProjects()
  }, [supabase])

  if (isLoading) {
    return (
      <div className="px-8 py-8 max-w-[1800px] mx-auto">
        <p className="text-white/60">Loading projects...</p>
      </div>
    )
  }

  if (!selectedProject) {
    return (
      <div className="px-8 py-8 max-w-[1800px] mx-auto">
        <div className="mb-4">
          <h1 className="text-5xl font-bold leading-none tracking-tight mb-2">Scan Results</h1>
          <p className="text-white/60">No projects found. Create a project to get started.</p>
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-white/60">Upload or connect a project to scan for SOC 2 violations.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {projects.length > 1 && (
        <div className="px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="max-w-[1400px] mx-auto">
            <label className="text-xs text-white/60 mr-3">Project:</label>
            <select
              value={selectedProject.id}
              onChange={(e) => {
                const project = projects.find(p => p.id === e.target.value)
                if (project) setSelectedProject(project)
              }}
              className="px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/30"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-black text-white">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <ScanResults projectId={selectedProject.id} projectName={selectedProject.name} />
    </>
  )
}
