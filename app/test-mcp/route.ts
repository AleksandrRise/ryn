import { NextResponse } from 'next/server'

/**
 * Test endpoint to verify MCP execute_js functionality
 * This endpoint demonstrates using execute_js to modify gray text colors
 */
export async function POST(req: Request) {
  const { code } = await req.json()

  // This endpoint would normally call the MCP plugin through Tauri
  // For now, return instructions on how to test
  return NextResponse.json({
    status: 'success',
    message: 'MCP test endpoint - check browser console for results',
    code: code,
  })
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    message: 'MCP is initialized. Use Tauri MCP tools to test execute_js',
    socket: '/tmp/tauri-mcp.sock',
    tools: [
      'execute_js - Execute JavaScript in the webview',
      'get_dom - Get DOM structure',
      'take_screenshot - Take a screenshot',
    ],
  })
}
