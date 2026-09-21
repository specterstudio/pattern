import { props } from "@webflow/data-types";
import { declareComponent } from "@webflow/react";

import { PI_WELCOME_SCENES, PiWelcomeAnimation } from "./PiWelcomeAnimation";

export default declareComponent(PiWelcomeAnimation, {
  name: "Pi Welcome Animation",
  description:
    "An interactive Pi product-animation scene. The animation restarts when its scene changes.",
  group: "Content / Pi",
  props: {
    scene: props.Variant({
      name: "Scene",
      group: "Content",
      options: [...PI_WELCOME_SCENES],
      defaultValue: "meet-pi",
    }),
    autoplay: props.Boolean({
      name: "Autoplay",
      group: "Playback",
      defaultValue: true,
      trueLabel: "Play on load",
      falseLabel: "Paused",
    }),
  },
  options: {
    ssr: false,
  },
});
