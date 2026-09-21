import { props } from "@webflow/data-types";
import { declareComponent } from "@webflow/react";

import { PATTERN_ICON_NAMES, PatternIcon } from "./PatternIcon";

export default declareComponent(PatternIcon, {
  name: "Pattern Icon",
  description: "Pattern's approved Iconic icons, sourced directly from Figma.",
  group: "Elements",
  props: {
    name: props.Variant({
      name: "Icon",
      group: "Icon",
      options: [...PATTERN_ICON_NAMES],
      defaultValue: "arrow-right",
    }),
    size: props.Number({
      name: "Size",
      group: "Appearance",
      defaultValue: 24,
    }),
    color: props.Text({
      name: "Color",
      group: "Appearance",
      defaultValue: "currentColor",
      tooltip: "Use currentColor to inherit, or enter a CSS color such as #006DFF.",
    }),
    label: props.Text({
      name: "Accessible label",
      group: "Accessibility",
      defaultValue: "",
      tooltip: "Leave empty for decorative icons.",
    }),
  },
  options: {
    ssr: true,
  },
});
