export default async (projectId) => {
  const gotoScan = async () => { try { await window.__TAURI__.core.invoke('open', { path: '/scan' }); } catch (_) {} };
  await gotoScan();
  const scans = await window.__TAURI__.core.invoke('get_scans', { projectId });
  const latestScan = scans?.[0];
  if (!latestScan) return { error: 'No scan found for project' };
  const violations = await window.__TAURI__.core.invoke('get_violations', { scanId: latestScan.id });
  if (!violations?.length) return { error: 'No violations available to fix' };
  for (const pick of violations) {
    try {
      const projects = await window.__TAURI__.core.invoke('get_projects');
      const project = projects.find(p => p.id === projectId);
      const basePath = (project?.path || '').replace(/\\/g, '/');
      const fullPath = basePath + '/' + pick.file_path;
      let content = null;
      try { content = await window.__TAURI__.fs.readTextFile(fullPath); } catch (_) {}
      if (!content || !content.includes(pick.code_snippet)) continue;
      let fix = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          fix = await window.__TAURI__.core.invoke('generate_fix', { violationId: pick.id });
          break;
        } catch (err) {
          const msg = String(err?.message || err || '').toLowerCase();
          if (msg.includes('rate limit')) {
            await new Promise(r => setTimeout(r, 8000));
            continue;
          }
          throw err;
        }
      }
      if (!fix) continue;
      await window.__TAURI__.core.invoke('apply_fix', { fixId: fix.id });
      const updated = await window.__TAURI__.core.invoke('get_violation', { violationId: pick.id });
      return { applied_at: updated?.fix?.applied_at || null, status: updated?.violation?.status, fixed_violation_id: pick.id, remaining: violations.length, attempts: violations.length };
    } catch (err) {
      const msg = String(err?.message || err || '').toLowerCase();
      if (msg.includes('original code not found') || msg.includes('failed to create grok client')) continue;
      return { error: msg };
    }
  }
  return { skipped: true, reason: 'no_violation_matched_snippet' };
};
