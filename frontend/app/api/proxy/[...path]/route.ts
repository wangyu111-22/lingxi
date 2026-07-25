import { NextRequest, NextResponse } from "next/server";

/**
 * API 代理 — 将前端 /api/proxy/xxx 请求转发到后端 localhost:8000/xxx
 * 这样只需穿透前端一个端口，外网用户的 API 请求通过 Next.js 服务端代理到本地后端
 */
export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request);
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request);
}

async function proxyRequest(request: NextRequest) {
  // 从 /api/proxy/xxx 中提取 xxx 部分
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/proxy", "");
  const targetUrl = `http://127.0.0.1:8000${path}${url.search}`;

  try {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (key !== "host" && key !== "connection") {
        headers[key] = value;
      }
    });

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      fetchOptions.body = await request.text();
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get("content-type") || "";

    // 流式响应直接透传
    if (contentType.includes("text/plain") || contentType.includes("text/event-stream")) {
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "content-type": contentType,
          "cache-control": "no-cache",
        },
      });
    }

    // 二进制响应（音频/图片等）用 arrayBuffer 防止数据损坏
    const isBinary = /audio|image|video|octet-stream|pdf|zip|font|protobuf/.test(contentType);
    if (isBinary) {
      const buffer = await response.arrayBuffer();
      const responseHeaders: Record<string, string> = { "content-type": contentType };
      const contentLength = response.headers.get("content-length");
      if (contentLength) responseHeaders["content-length"] = contentLength;
      return new NextResponse(buffer, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: { "content-type": contentType },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Backend unavailable", detail: String(error) },
      { status: 502 }
    );
  }
}
