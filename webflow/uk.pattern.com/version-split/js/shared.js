/*
 * Pattern UK version split — shared runtime
 * Phase 5 rollout asset. Loaded only by the marker-based version loader.
 * Preserves the current pageFunctions registry and one-time DOM-ready runner.
 */
(function (global) {
  "use strict";

  global.pageFunctions = global.pageFunctions || {
    executed: {},
    functions: {},
    added: false,

    addFunction: function (id, fn) {
      if (!id || typeof fn !== "function") return;

      if (!this.functions[id]) {
        this.functions[id] = fn;
      }
    },

    executeFunctions: function () {
      if (this.added) return;
      this.added = true;

      for (var id in this.functions) {
        if (
          Object.prototype.hasOwnProperty.call(this.functions, id) &&
          !this.executed[id]
        ) {
          try {
            this.functions[id]();
            this.executed[id] = true;
          } catch (error) {
            console.error("Error executing page function " + id + ":", error);
          }
        }
      }
    }
  };

  function runPageFunctions() {
    if (
      global.pageFunctions &&
      typeof global.pageFunctions.executeFunctions === "function"
    ) {
      global.pageFunctions.executeFunctions();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runPageFunctions, {
      once: true
    });
  } else {
    runPageFunctions();
  }
})(window);
