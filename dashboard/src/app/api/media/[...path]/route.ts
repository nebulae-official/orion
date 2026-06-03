import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const MEDIA_ROOT = "/data/media";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path: segments } = await params;
  const relativePath = segments.join("/");
  const fullPath = path.join(MEDIA_ROOT, relativePath);

  // Security: prevent path traversal outside /data/media
  if (!fullPath.startsWith(MEDIA_ROOT + "/")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(fullPath)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType =
    ext === ".mp4"
      ? "video/mp4"
      : ext === ".webm"
        ? "video/webm"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".png"
            ? "image/png"
            : ext === ".gif"
              ? "image/gif"
              : ext === ".webp"
                ? "image/webp"
                : "application/octet-stream";

  const fileBuffer = fs.readFileSync(fullPath);
  return new NextResponse(fileBuffer, {
    headers: { "Content-Type": contentType },
  });
}
