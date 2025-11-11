"use client"

export function AuditTrail() {
  const events = [
    {
      id: 1,
      type: "scan",
      description: "Completed full project scan",
      timestamp: "2024-01-15 14:23:45",
      details: "247 files scanned, 28 violations detected",
    },
    {
      id: 2,
      type: "fix",
      description: "Applied fix to config/settings.py",
      timestamp: "2024-01-15 14:08:12",
      details: "Moved hardcoded API key to environment variable",
    },
    {
      id: 3,
      type: "violation",
      description: "Critical violation detected in auth/views.py",
      timestamp: "2024-01-15 13:45:33",
      details: "Missing authentication decorator on admin endpoint",
    },
    {
      id: 4,
      type: "scan",
      description: "Started monitoring session",
      timestamp: "2024-01-15 11:12:00",
      details: "Continuous monitoring enabled for project",
    },
  ]

  return (
    <div className="px-8 py-12">
      <div className="flex items-baseline justify-between mb-12 pb-8 border-b border-[#1a1a1a]">
        <div>
          <h1 className="text-[48px] font-bold leading-none tracking-tighter mb-3">Audit Trail</h1>
          <p className="text-[13px] text-[#aaaaaa]">Complete compliance activity log</p>
        </div>
        <button className="text-[13px] hover:underline">Export Report →</button>
      </div>

      <table className="w-full">
        <thead>
          <tr>
            <th className="w-48">Timestamp</th>
            <th className="w-32">Type</th>
            <th>Event</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="hover:bg-[#0a0a0a]">
              <td className="text-[12px] font-mono text-[#aaaaaa]">{event.timestamp}</td>
              <td className="text-[12px] uppercase tracking-wider text-[#aaaaaa]">{event.type}</td>
              <td className="text-[14px]">{event.description}</td>
              <td className="text-[13px] text-[#aaaaaa]">{event.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
