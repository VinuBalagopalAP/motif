import { AbsoluteFill, OffthreadVideo, Audio, Img, useCurrentFrame, useVideoConfig, spring, interpolate, delayRender, continueRender } from "remotion";
import { Gif } from "@remotion/gif";
import type { RenderSpec } from "@/lib/jobs";
import React, { useEffect, useState } from "react";
import { loadGoogleFont } from "@/lib/fonts";

export const UgcVideo: React.FC<{ spec: RenderSpec }> = ({ spec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const popInTop = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 150 },
  });

  const popInBottom = spring({
    frame: frame - 15,
    fps,
    config: { damping: 14, stiffness: 150 },
  });

  const popInGif = spring({
    frame: frame - 25,
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  const bgScale = interpolate(frame, [0, 300], [1, 1.15], {
    extrapolateRight: "clamp",
  });

  const topFontRaw = spec.overlayText.style?.topFontFamily || spec.overlayText.style?.fontFamily || "system-ui, -apple-system, sans-serif";
  const bottomFontRaw = spec.overlayText.style?.bottomFontFamily || spec.overlayText.style?.fontFamily || "system-ui, -apple-system, sans-serif";

  const isTopCustom = topFontRaw.startsWith("http");
  const isBottomCustom = bottomFontRaw.startsWith("http");

  const topFont = isTopCustom ? "CustomFontTop" : topFontRaw;
  const bottomFont = isBottomCustom ? "CustomFontBottom" : bottomFontRaw;

  const [handle] = useState(() => delayRender("Loading custom fonts"));

  useEffect(() => {
    const loadCustomFonts = async () => {
      try {
        const promises = [];
        if (isTopCustom) {
          const face = new FontFace("CustomFontTop", `url(${topFontRaw})`);
          promises.push(face.load().then(f => document.fonts.add(f)));
        }
        if (isBottomCustom && bottomFontRaw !== topFontRaw) {
          const face = new FontFace("CustomFontBottom", `url(${bottomFontRaw})`);
          promises.push(face.load().then(f => document.fonts.add(f)));
        }
        await Promise.all(promises);
      } catch (e) {
        console.error("Failed to load custom fonts", e);
      } finally {
        continueRender(handle);
      }
    };
    loadCustomFonts();
  }, [handle, isTopCustom, isBottomCustom, topFontRaw, bottomFontRaw]);

  if (!isTopCustom) loadGoogleFont(topFont);
  if (!isBottomCustom && topFont !== bottomFont) loadGoogleFont(bottomFont);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {spec.backgroundMode === 'color' ? (
        <AbsoluteFill style={{ backgroundColor: spec.backgroundColor || "black" }} />
      ) : (
        <AbsoluteFill style={{ transform: `scale(${bgScale})` }}>
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
        </AbsoluteFill>
      )}

      <AbsoluteFill
        style={{
          background: "rgba(0,0,0,0.2)",
        }}
      />

      {/* Top Text (TikTok Style Pill) */}
      {spec.overlayText.showTopText !== false && (
        <div style={{ position: "absolute", top: spec.overlayText.style?.topY ?? 180, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            backgroundColor: spec.overlayText.style?.showTopBackground !== false ? "rgba(0, 0, 0, 0.7)" : "transparent",
            padding: "16px 24px",
            borderRadius: "20px",
            color: spec.overlayText.style?.topTextColor || "white",
            opacity: spec.overlayText.style?.topTextOpacity ?? 1,
            fontSize: 68,
            fontWeight: 800,
            textAlign: "center",
            maxWidth: "85%",
            lineHeight: 1.25,
            fontFamily: `'${topFont}', system-ui, -apple-system, sans-serif`,
            transform: `scale(${popInTop})`,
            boxShadow: spec.overlayText.style?.showTopBackground !== false ? "0 8px 32px rgba(0,0,0,0.4)" : "none"
          }}
        >
          {spec.overlayText.top}
        </div>
      </div>
      )}

      {/* Center GIF */}
      {spec.gifOverlay.showGifLayer !== false && (
      <div style={{ 
        position: "absolute", 
        top: `calc(50% + ${spec.gifOverlay.style?.y || 0}px)`, 
        left: `calc(50% + ${spec.gifOverlay.style?.x || 0}px)`, 
        transform: `translate(-50%, -50%) scale(${popInGif * (spec.gifOverlay.style?.scale || 1)})`, 
        width: "70%", 
        height: "40%", 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center" 
      }}>
        <Gif
          src={spec.gifOverlay.url}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
          }}
        />
      </div>
      )}

      {/* Bottom Text (TikTok Red Pill) */}
      {spec.overlayText.showBottomText !== false && spec.overlayText.bottom ? (
        <div style={{ position: "absolute", bottom: spec.overlayText.style?.bottomY ?? 180, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div
            style={{
              backgroundColor: spec.overlayText.style?.showBottomBackground !== false ? (spec.overlayText.style?.backgroundColor || "rgba(234, 40, 78, 0.95)") : "transparent",
              padding: "20px 32px",
              borderRadius: "16px",
              color: spec.overlayText.style?.bottomTextColor || "white",
              opacity: spec.overlayText.style?.bottomTextOpacity ?? 1,
              fontSize: 58,
              fontWeight: 800,
              textAlign: "center",
              maxWidth: "85%",
              lineHeight: 1.25,
              fontFamily: `'${bottomFont}', system-ui, -apple-system, sans-serif`,
              transform: `scale(${popInBottom})`,
              boxShadow: spec.overlayText.style?.showBottomBackground !== false ? "0 8px 32px rgba(0,0,0,0.4)" : "none"
            }}
          >
            {spec.overlayText.bottom}
          </div>
        </div>
      ) : null}

      <Audio src={spec.audio.url} />
    </AbsoluteFill>
  );
};
