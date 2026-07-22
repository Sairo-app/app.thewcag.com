import { ImageResponse } from "next/og";

export const alt = "Audit what people see with TheWCAG";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f0df",
          color: "#1f2933",
          padding: "64px 72px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: "#d9480f", color: "white", fontSize: 25, fontWeight: 800 }}>W</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>TheWCAG</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
            <div style={{ fontSize: 76, lineHeight: 1.02, letterSpacing: "-3px", fontWeight: 800 }}>Audit what people see.</div>
            <div style={{ marginTop: 24, color: "#556170", fontSize: 28, lineHeight: 1.35 }}>Capture the barrier, keep the evidence, and deliver a defensible WCAG audit.</div>
          </div>
          <div style={{ width: 250, height: 150, display: "flex", alignItems: "center", justifyContent: "center", border: "5px solid #ffffff", borderRadius: 15, outline: "8px solid #d9480f", background: "#fffdf7", color: "#a73509", fontSize: 24, fontWeight: 800 }}>Issue 1</div>
        </div>
        <div style={{ display: "flex", gap: 22, color: "#556170", fontSize: 21 }}>
          <span>macOS</span><span>Windows</span><span>Chrome</span><span>WCAG 2.2</span><span>Local-first</span>
        </div>
      </div>
    ),
    size,
  );
}
