import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { device_code } = body;

    if (!device_code) {
      return NextResponse.json(
        { error: "device_code is required" },
        { status: 400 }
      );
    }

    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
        device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to get access token" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // If still waiting for authorization
    if (data.error === "authorization_pending" || data.error === "slow_down") {
      return NextResponse.json(
        { error: data.error },
        { status: 400 }
      );
    }

    if (data.error) {
      return NextResponse.json(
        { error: data.error },
        { status: 401 }
      );
    }

    if (!data.access_token) {
      return NextResponse.json(
        { error: "No access token received" },
        { status: 400 }
      );
    }

    // Get GitHub user info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
        Accept: "application/json",
      },
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: "Failed to get GitHub user info" },
        { status: 500 }
      );
    }

    const userData = await userResponse.json();

    return NextResponse.json({
      access_token: data.access_token,
      github_username: userData.login,
      github_user_id: userData.id,
      avatar_url: userData.avatar_url,
    });
  } catch (error: any) {
    console.error("Token exchange error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to exchange device code for token" },
      { status: 500 }
    );
  }
}
