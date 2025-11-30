export async function writeTextFile(path: string, contents: string): Promise<void> {
  if (typeof window === "undefined") return
  const blob = new Blob([contents], { type: "text/plain" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = path.split("/").pop() || "export.txt"
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}
