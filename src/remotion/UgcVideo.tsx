import { AbsoluteFill, OffthreadVideo, Audio, Img } from "remotion";
import { Gif } from "@remotion/gif";
import type { RenderSpec } from "@/lib/jobs";
import React from "react";

export const UgcVideo: React.FC<{ spec: RenderSpec }> = ({ spec }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {spec.background.type === "video" ? (
        <OffthreadVideo
          src={spec.background.url}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <Img
          src={spec.background.url}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      <AbsoluteFill
        style={{
          background: "rgba(0,0,0,0.3)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 180,
          left: 70,
          right: 70,
          textAlign: "center",
          color: "white",
          fontSize: 78,
          fontWeight: 800,
          lineHeight: 1.05,
          textShadow: "0 4px 18px rgba(0,0,0,0.7)",
          fontFamily: "system-ui, sans-serif"
        }}
      >
        {spec.overlayText.top}
      </div>

      <Gif
        src={spec.gifOverlay.url}
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          height: 1000,
          objectFit: "contain",
          objectPosition: "bottom",
        }}
      />

      {spec.overlayText.bottom ? (
        <div
          style={{
            position: "absolute",
            bottom: 120,
            left: 80,
            right: 80,
            textAlign: "center",
            color: "white",
            fontSize: 52,
            fontWeight: 700,
            textShadow: "0 4px 18px rgba(0,0,0,0.7)",
            fontFamily: "system-ui, sans-serif"
          }}
        >
          {spec.overlayText.bottom}
        </div>
      ) : null}

      <Audio src={spec.audio.url} />
    </AbsoluteFill>
  );
};
