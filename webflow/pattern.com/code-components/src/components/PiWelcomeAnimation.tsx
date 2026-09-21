import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

export const PI_WELCOME_SCENES = [
  "meet-pi",
  "daily-brief",
  "knowledge",
  "recommendations",
  "approvals",
  "skills",
  "support",
  "shortcut",
] as const;

export type PiWelcomeScene = (typeof PI_WELCOME_SCENES)[number];

export interface PiWelcomeAnimationProps {
  scene?: PiWelcomeScene | string;
  autoplay?: boolean;
}

const DEFAULT_SCENE: PiWelcomeScene = "meet-pi";

/**
 * Natural scene bounds measured from the supplied production export. Scenes
 * that change height during playback use their maximum measured height so no
 * animation frame is clipped.
 */
export const PI_WELCOME_SCENE_DIMENSIONS: Record<
  PiWelcomeScene,
  { width: number; height: number }
> = {
  "meet-pi": { width: 440, height: 375 },
  "daily-brief": { width: 426, height: 260 },
  knowledge: { width: 460, height: 346 },
  recommendations: { width: 476, height: 220 },
  approvals: { width: 440, height: 296 },
  skills: { width: 436, height: 388 },
  support: { width: 520, height: 380 },
  shortcut: { width: 540, height: 380 },
};

function normalizeScene(scene: PiWelcomeScene | string): PiWelcomeScene {
  return PI_WELCOME_SCENES.includes(scene as PiWelcomeScene)
    ? (scene as PiWelcomeScene)
    : DEFAULT_SCENE;
}

/**
 * A DevLink wrapper for the self-contained Pi welcome-tour Web Component.
 *
 * The runtime is dynamically imported on the client because it registers a
 * custom element and consequently cannot run while Webflow renders SSR output.
 */
export function PiWelcomeAnimation({
  scene = DEFAULT_SCENE,
  autoplay = true,
}: PiWelcomeAnimationProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [scale, setScale] = useState(1);
  const normalizedScene = normalizeScene(scene);
  const dimensions = PI_WELCOME_SCENE_DIMENSIONS[normalizedScene];

  useEffect(() => {
    let mounted = true;

    // @ts-expect-error The checked-in, production Web Component runtime has no .d.ts file.
    void import("../../../scripts/components/pi-welcome/pi-welcome-elements.js").then(
      () => {
        if (mounted) setRuntimeReady(true);
      },
    );

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateScale = () => {
      const availableWidth = stage.getBoundingClientRect().width;
      setScale(Math.min(1, availableWidth / dimensions.width));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(stage);

    return () => observer.disconnect();
  }, [dimensions.width]);

  const stageStyle: CSSProperties = {
    height: dimensions.height * scale,
    marginInline: "auto",
    maxWidth: dimensions.width,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  };

  const playerStyle: CSSProperties = {
    height: dimensions.height,
    left: 0,
    position: "absolute",
    top: 0,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    width: dimensions.width,
  };

  return (
    <div
      aria-busy={runtimeReady ? undefined : true}
      data-pi-welcome-scene={normalizedScene}
      ref={stageRef}
      style={stageStyle}
    >
      {runtimeReady
        ? createElement("pi-welcome-animation", {
            "aria-label": "Pi welcome tour animation",
            autoplay: autoplay ? "" : undefined,
            key: `${normalizedScene}-${autoplay}`,
            scene: normalizedScene,
            style: playerStyle,
          })
        : null}
    </div>
  );
}
