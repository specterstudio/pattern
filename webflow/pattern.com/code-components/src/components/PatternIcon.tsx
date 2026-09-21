import type { CSSProperties } from "react";

import {
  PATTERN_ICON_NAMES,
  PATTERN_ICON_SVGS,
  type PatternIconName,
} from "../generated";

export interface PatternIconProps {
  /** Icon name from Pattern's Figma-approved Iconic inventory. */
  name?: PatternIconName | string;
  /** Square icon size in CSS pixels. */
  size?: number;
  /** Any valid CSS color. Use currentColor to inherit from the surrounding text. */
  color?: string;
  /** Accessible label. Leave empty when the icon is decorative. */
  label?: string;
}

const DEFAULT_ICON: PatternIconName = "arrow-right";
const DEFAULT_SIZE = 24;
const MIN_SIZE = 1;
const MAX_SIZE = 512;

function normalizeSize(size: number | undefined): number {
  if (typeof size !== "number" || !Number.isFinite(size)) return DEFAULT_SIZE;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, size));
}

function normalizeName(name: PatternIconProps["name"]): PatternIconName {
  if (name && Object.hasOwn(PATTERN_ICON_SVGS, name)) {
    return name as PatternIconName;
  }

  return DEFAULT_ICON;
}

/**
 * Pattern's approved Iconic icon set, exported directly from Figma.
 *
 * The SVG geometry is kept local so the component does not make runtime network
 * requests or depend on the Iconic React package. Icon artwork uses
 * `currentColor`, allowing either inherited color or a per-instance override.
 */
export function PatternIcon({
  name = DEFAULT_ICON,
  size = DEFAULT_SIZE,
  color = "currentColor",
  label = "",
}: PatternIconProps) {
  const normalizedName = normalizeName(name);
  const definition = PATTERN_ICON_SVGS[normalizedName];
  const normalizedSize = normalizeSize(size);
  const accessibleLabel = label.trim();

  const wrapperStyle: CSSProperties = {
    color: color === "currentColor" ? undefined : color,
    display: "inline-flex",
    flex: "0 0 auto",
    height: normalizedSize,
    lineHeight: 0,
    verticalAlign: "middle",
    width: normalizedSize,
  };

  return (
    <span
      data-pattern-icon={normalizedName}
      style={wrapperStyle}
      aria-hidden={accessibleLabel ? undefined : true}
      aria-label={accessibleLabel || undefined}
      role={accessibleLabel ? "img" : undefined}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={definition.viewBox}
        width="100%"
        height="100%"
        fill="none"
        focusable="false"
        dangerouslySetInnerHTML={{ __html: definition.body }}
      />
    </span>
  );
}

export { PATTERN_ICON_NAMES };
export type { PatternIconName };
