/**
 * This content script injects any custom style for the page (if it exists)
 * as soon as the document starts loading.
 */

/**
 * This content script injects any custom style for the page (if it exists)
 * as soon as the document starts loading.
 */

chrome.storage.local.get(['options', 'styles'], function(items) {
  var response;

  if (items['styles']) {
    styles = new Styles(items['styles']);
  } else {
    styles = new Styles({});
  }

  if (window === window.top) {
    response = styles.getCombinedRulesForPage(window.location.href);
  } else {
    response = styles.getCombinedRulesForIframe(window.location.href);
  }

  if (response.global) {
    CSSUtils.crunchCSS(response.global, true, true, function(css) {
      if (css != '') {
        CSSUtils.injectCSS(css, 'stylebot-global-css');
      }
    });
  };

  if (response.url && response.rules) {
    console.log(response);
    setTimeout(function() {
      CSSUtils.crunchCSS(response.rules, true, true, function(css) {
        console.log(css);
        if (css != '') {
          CSSUtils.injectCSS(css, 'stylebot-css');
        }
      });
    }, 0);
  };

  stylebot.style.initialize(styles,
    response.url,
    response.rules,
    response.global,
    response.social);
});
