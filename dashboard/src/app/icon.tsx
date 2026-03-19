import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: "#131313",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
        }}
      >
        <div
          style={{
            color: "#7C3AED",
            fontWeight: "bold",
            fontSize: "22px",
          }}
        >
          O
        </div>
      </div>
    ),
    { ...size },
  );
}
