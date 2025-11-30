import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const response = await fetch("https://github.com/login/device/code", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
        scope: "repo read:user",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get device code from GitHub");
    }

    const data = await response.json();

    return NextResponse.json({
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      expires_in: data.expires_in,
      interval: data.interval || 5,
    });
  } catch (error: any) {
    console.error("Device code error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initiate GitHub authorization" },
      { status: 500 }
    );
  }
}
