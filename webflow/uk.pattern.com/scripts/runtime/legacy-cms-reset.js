/* Preserved regional legacy CMS lifecycle callback; called only on legacy pages. */
window.fsAttributes = window.fsAttributes || [];

  window.fsAttributes.push([
    "cmsslider",
    function () {
      if (!window.Webflow) return;

      try {
        window.Webflow.destroy();
        window.Webflow.ready();

        var interactions = window.Webflow.require("ix2");

        if (interactions && typeof interactions.init === "function") {
          interactions.init();
        }

        document.dispatchEvent(new Event("readystatechange"));
      } catch (error) {
        console.error(
          "Unable to restore Webflow interactions after CMS Slider:",
          error
        );
      }
    }
  ]);
