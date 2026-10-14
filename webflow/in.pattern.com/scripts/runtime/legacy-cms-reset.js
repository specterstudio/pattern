/* Preserved regional legacy CMS lifecycle callback; called only on legacy pages. */
window.fsAttributes = window.fsAttributes || [];
  window.fsAttributes.push([
    'cmsslider', // or whatever Finsweet attribute you're using
    (listInstances) => {
      console.log('Third-party script loaded!');
      if (window.Webflow) {
        window.Webflow.destroy();
        window.Webflow.ready();
        window.Webflow.require('ix2').init();
        document.dispatchEvent(new Event('readystatechange'));
      }
    },
  ]);
