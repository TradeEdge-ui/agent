import { ImageResponse } from "next/og";

export const alt = "ARyzz AI Solutions — Websites, AI Chatbots & Automation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "80px", background: "linear-gradient(135deg, #05060b 0%, #1c1240 55%, #0b2a3a 100%)", color: "#e8e9f3",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg,#8b5cf6,#22d3ee)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 700, color: "#fff" }}>A</div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>ARyzz AI Solutions</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>Websites & AI that win you customers.</div>
        <div style={{ marginTop: 28, fontSize: 30, color: "#a2a7c0" }}>Web development · AI chatbots · Automation · Malaysia</div>
      </div>
    ),
    size,
  );
}
