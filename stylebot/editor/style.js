/**
 * stylebot.style
 *
 * Generating, applying and saving CSS styling rules
 */
stylebot.style = {
  STYLE_SELECTOR_ID: 'stylebot-css',
  GLOBAL_STYLE_SELECTOR_ID: 'stylebot-global-css',
  PREVIEW_SELECTOR_ID: 'stylebot-preview',

  PREVIEW_FADE_OUT_DELAY: 500,

  style: {},
  timer: null,
  parser: null,
  status: true,
  // last selected elements' selector
  selector: null,
  // last selected elements
  elements: null,

  /**
   * Initialize rules and url from temporary variables in apply-css.js
   */
  initialize: function(style) {
    _.bindAll(this);
    this.style = style;

    if (this.style.global) {
      this.style.getGlobalCSS(_.bind(function(css) {
        if (css !== '') {
          this.injectCSS(this.GLOBAL_STYLE_SELECTOR_ID, css);
        }
      }, this));
    };

    if (this.style.url && this.style.rules) {
      setTimeout(_.bind(function() {
        this.style.getCSS(_.bind(function(css) {
          if (css !== '') {
            this.injectCSS(this.STYLE_SELECTOR_ID, css);
          }
        }, this));
      }, this), 0);
    };
  },

  getUrl: function() {
    return this.style.url;
  },

  setUrl: function(url) {
    this.style.url = url;
  },

  getRules: function() {
    return this.style.rules;
  },

  getSelector: function() {
    return this.selector;
  },

  /**
   * Update cache with selector and selected elements
   * @param {string} selector CSS selector to update cache
   */
  setSelector: function(selector) {
    if (selector !== this.selector) {
      this.selector = selector;

      try {
        this.elements = $(selector + ':not(#stylebot, #stylebot *)');
      } catch (e) {
        this.elements = null;
      }
    }
  },

  getStatus: function() {
    return this.status;
  },

  getGlobalRules: function() {
    return this.style.global;
  },

  getSocialData: function() {
    return this.style.social;
  },

  save: function() {
    this.style.save();
  },

  /**
   * Applies and saves CSS style to selected elements as inline css.
   *   Used by Basic Mode.
   * @param {string} property CSS property
   * @param {string} value Value for CSS property
   */
  apply: function(property, value) {
    if (!this.selector || this.selector === '') {
      return true;
    }

    this.style.saveRule(this.selector, property, value);

    setTimeout(_.bind(function() {
      if (this.elements && this.elements.length !== 0) {
        this.refreshInlineCSS(this.selector);
      } else {
        this.applyToStyleElement(this.style.rules);
      }

      stylebot.widget.refreshResetButtons();
    }, this), 0);
  },

  /**
   * Applies and saves CSS to selected elements as inline css.
   *   Used by Advanced Mode.
   * @param {string} css CSS string to apply
   */
  applyCSS: function(css) {
    // Timer duration before applying inline css
    var duration = 0,
        noOfElements = 0;

    if (!this.selector) {
      return;
    }

    if (this.elements) {
      noOfElements = this.elements.length;
      if (noOfElements >= 400) {
        duration = 400;
      } else if (noOfElements >= 200) {
        duration = 300;
      }
    }

    if (this.updateCSSTimer) {
      clearTimeout(this.updateCSSTimer);
      this.updateCSSTimer = null;
    }

    this.updateCSSTimer = setTimeout(_.bind(function() {
      this.saveRuleFromCSS(css, this.selector);

      if (noOfElements !== 0) {
        this.applyInlineCSS(this.elements, css);
      } else {
        this.applyToStyleElement(this.style.rules);
      }

      stylebot.widget.refreshResetButtons();
    }, this), duration);

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.timer = setTimeout(_.bind(function() {
      this.save();
    }, this), 1000);
  },

  /**
   * Update CSS for the entire page. Used by Page Editing Mode
   * @param {string} css CSS string
   * @param {boolean} save Should CSS be saved
   * @param {Object} data Any additional data that should be sent
   *   along with the save request.
   */
  applyPageCSS: function(css, shouldSave, data) {
    var rules = {};

    if (shouldSave === undefined) {
      shouldSave = true;
    }

    if (css !== '') {
      rules = Styles.parseCSS(css);

      if (!this.parser) {
        this.parser = new CSSParser();
      }

      try {
        var sheet = this.parser.parse(css, false, true);
        parsedRules = CSSUtils.getRulesFromParserObject(sheet);
      } catch (e) {
        return false;
      }
    }

    if (parsedRules['error']) {
      return parsedRules['error'];
    }

    this.removeInlineCSS(this.selector);
    this.applyToStyleElement(parsedRules);

    if (shouldSave) {
      this.style.rules = parsedRules;
      this.style.save(data);
    }

    return true;
  },

  /**
   * Update the inline CSS of elements to match the saved rules
   * for the given selector.
   * @param {String} selector The CSS selector for which to update the inline CSS
   */
  refreshInlineCSS: function(selector) {
    var $els = $(selector),
        rule = this.style.rules[selector],
        css = '';

    if (rule !== undefined) {
      _.each(rule, _.bind(function(value, property) {
        if (property.indexOf('comment') === -1) {
          css += CSSUtils.crunchCSSForDeclaration(property, value, true);
        }
      }, this));
    }

    this.applyInlineCSS($els, css);
  },

  /**
   * Apply inline CSS to given elements
   * @param {jQuery} $els Elements to apply the CSS
   * @param {String} css CSS to apply
   */
  applyInlineCSS: function($els, css) {
    if (!$els || $els.length === 0) {
      return false;
    }

    _.each($els, _.bind(function(el) {
      var $el = $(el),
          currentCSS,
          currentStylebotCSS;

      currentCSS = $el.attr('style');
      currentCSS = currentCSS ? $.trim(currentCSS) : null;

      currentStylebotCSS = $el.data('stylebotCSS');
      currentStylebotCSS = currentStylebotCSS ? $.trim(currentStylebotCSS) : null;

      // If there is no existing stylebot CSS applied to the element
      if (!currentStylebotCSS) {

        // if the element has CSS of its own, append stylebot CSS to it
        if (currentCSS && currentCSS.length !== 0) {
          if (currentCSS[currentCSS.length - 1] !== ';') {
            css = currentCSS + ';' + css;
          }

          else {
            css = currentCSS + css;
          }
        }
      }

      // Else if the element has the css of its own, replace the
      // existing stylebot css with the new given css
      else if (currentCSS) {
        css = currentCSS.replace(currentStylebotCSS, css);
      }

      $el.attr('style', css);
      $el.data('stylebotCSS', css);

    }, this));

    setTimeout(function() {
      stylebot.selectionBox.highlight(stylebot.selectedElement);
    }, 0);
  },

  /**
   * Remove inline stylebot CSS for given elements
   * @param {String} selector The CSS selector for the elements to update
   */
  removeInlineCSS: function(selector) {
    var $els = $(selector);

    if (!$els) {
      return;
    }

    _.each($els, _.bind(function(el) {
      var $el = $(el),
          css,
          stylebotCSS;

      css = $el.attr('style');
      stylebotCSS = $el.data('stylebotCSS');

      if (css !== undefined && stylebotCSS !== undefined) {
        css = css.replace(stylebotCSS, '');
        $el.attr('style', css);
        $el.data('stylebotCSS', null);
      }
    }, this));
  },

  /**
   * Remove all inline stylebot CSS and
   * update the css in stylebot <style> element
   */
  removeAllInlineCSS: function() {
    _.each(this.style.rules, _.bind(function(rule, selector) {
      this.removeInlineCSS(selector);
    }, this));

    this.applyToStyleElement(this.style.rules);
  },

  /**
   * Remove any stylebot CSS for given CSS selector from <style> element
   * and apply it as inline css.
   */
  replaceAsInlineCSS: function(selector) {
    var rules = {},
        $els = $(selector);

    if (!$els || $els.length === 0) {
      return;
    }

    this.refreshInlineCSS(selector);

    _.each(this.style.rules, _.bind(function(value, sel) {
      if (sel !== selector) {
        rules[sel] = value;
      }
    }, this));

    this.applyToStyleElement(rules);
  },

  /**
   * Update CSS in the stylebot <style> element to match the given rules
   * @param {array} rules The style rules to apply
   */
  applyToStyleElement: function(rules) {
    Style.getCSSForRules(rules, _.bind(function(css) {
      this.injectCSS(this.STYLE_SELECTOR_ID, css);
    }, this));
  },

  /**
   * Remove any CSS from the stylebot <style> element
   */
  resetStyleElement: function() {
    this.applyToStyleElement(null);
  },

  /**
   * Get the rule for the given selector
   * @param {string} selector CSS selector for which to get the rule
   */
  getRule: function(selector) {
    var rule = this.style.rules[selector];
    return (rule !== undefined ? rule : null);
  },

  /**
   * Remove any stylebot CSS for current selection
   */
  resetSelectedElementCSS: function() {
    this.style.resetRule(this.selector);
    this.removeInlineCSS(this.selector);
    this.applyToStyleElement(this.style.rules);

    setTimeout(function() {
      stylebot.selectionBox.highlight(stylebot.selectedElement);
    }, 0);
  },

  /**
   * Remove all the CSS for page from cache, <style> element and inline CSS.
   */
  resetAllCSS: function(showPopover) {
    this.style.reset();

    _.each(this.style.rules, _.bind(function(rule, selector) {
      this.removeInlineCSS(selector);
    }, this));

    this.resetStyleElement();

    if (showPopover) {
      this.showPreviewPopover('Removed custom CSS for the page');
      this.hidePreviewPopover(true);
    }

    setTimeout(function() {
      if (stylebot.selectionBox) {
        stylebot.selectionBox.highlight(stylebot.selectedElement);
      }
    }, 0);
  },

  /**
   * Clears all the inline CSS and updates the <style> element
   * Called when stylebot is closed.
   */
  clean: function() {
    this.selector = null;
    this.elements = null;

    setTimeout(_.bind(function() {
      this.removeAllInlineCSS();
    }, this), 100);
  },

  /**
   * Undo last style applied
   */
  undo: function() {
    if (stylebot.undo.isEmpty()) {
      return false;
    }

    this.style.rules = stylebot.undo.pop();
    this.removeInlineCSS(this.selector);
    this.applyToStyleElement(this.style.rules);
    this.style.save();

    stylebot.widget.open();
    stylebot.undo.refresh();

    setTimeout(function() {
      stylebot.highlight(stylebot.selectedElement);
    }, 0);
  },

  /**
   * Disable styling
   */
  disable: function() {
    this.status = false;
    this.injectCSS(this.GLOBAL_STYLE_SELECTOR_ID, '');
    this.injectCSS(this.STYLE_SELECTOR_ID, '');
  },

  /**
   * Enable styling
   */
  enable: function() {
    if (this.status) {
      return;
    }

    this.status = true;

    this.style.getCSS(_.bind(function(css) {
      this.injectCSS(this.STYLE_SELECTOR_ID, css);
    }, this));

    if (this.style.global) {
      this.style.getGlobalCSS(_.bind(function(css) {
        this.injectCSS(this.GLOBAL_STYLE_SELECTOR_ID, css);
      }, this));
    }
  },

  /**
   * Toggle styling
   */
  toggle: function() {
    // If stylebot is open, don't allow user to disable styling on the page.
    if (stylebot.status) {
      return false;
    }

    if (this.status) {
      this.disable();
    } else {
      this.enable();
    }
  },

  /**
   * Preview the page after removing any style rules
   */
  previewReset: function() {
    this.showPreviewPopover('Preview after removing custom CSS');
    this.applyPageCSS('', false);
  },

  /**
   * Preview the specified style by applying its CSS to the page.
   * @param {String} title The title of style.
   * @param {String} desc Description for the style.
   * @param {String} author The author of the style.
   * @param {String} timeAgo Relative time string when the style was authored.
   * @param {Integer} favCount Number of times the style has been favorited
   *   on Stylebot Social.
   * @param {String} css The css for the style.
   */
  preview: function(title, desc, author, timeAgo, favCount, css) {
    this.applyPageCSS(css, false);

    if (desc) {
      desc = desc.replace(/\n/g, '<br />');
    }

    this.showPreviewPopover(
      title + '<br>' +
      '<div id="stylebot-preview-meta">by ' + author + ' (' +
      favCount + ' favorites) • Last updated ' + timeAgo + '</div>' +
      '<br><div id="stylebot-preview-description">' + desc + '</div>');
  },

  /**
   * Reset the preview of any style and reset to the specifed CSS.
   * @param {String} css The CSS to apply to the page.
   */
  resetPreview: function() {
    if (this.style.rules) {
      this.style.getCSS(_.bind(function(css) {
        this.injectCSS(this.STYLE_SELECTOR_ID, css);
      }, this));
    };

    this.hidePreviewPopover();
  },

  /**
   * Install the specified style for the given URL
   * @param {Number} id The id of the style
   * @param {String} title The title describing the style
   * @param {String} url The url for which the style should be installed
   * @param {String} css The css for the style
   * @param {String} timestamp The timestamp when the style was last updated
   */
  install: function(id, title, url, css, timestamp) {
    this.social = {
      id: id,
      timestamp: timestamp
    };

    this.style.url = url;
    this.applyPageCSS(css, true, this.social);

    this.showPreviewPopover('Installed ' + title);
    this.hidePreviewPopover(true);
  },

  /**
   * Show the preview popover
   * @param {String} html The content to display inside the popover
   */
  showPreviewPopover: function(html) {
    var $preview = $('#' + this.PREVIEW_SELECTOR_ID);

    if ($preview.length === 0) {
      $preview = $('<div>', {
        id: this.PREVIEW_SELECTOR_ID
      });

      $('body').append($preview);
    }

    $preview.html(html)
      .css('left', $(window).width() / 2 - $preview.width() / 2)
      .css('top', $(window).height() - $preview.height() - 100)
      .show();
  },

  /**
   * Hide the preview popover
   * @param {Boolean} shouldFadeOut If the popover should fade out
   */
  hidePreviewPopover: function(shouldFadeOut) {
    var $preview = $('#' + this.PREVIEW_SELECTOR_ID);

    if (shouldFadeOut) {
      setTimeout($.proxy(function() {
        $preview.fadeOut(1000);
      }, this), this.PREVIEW_FADE_OUT_DELAY);
    } else {
      $preview.hide();
    }
  },

  applyWebFont: function(fontURL, css) {
    this.style.applyWebFont(fontURL, css);
    this.removeAllInlineCSS();
  },

  injectCSS: function(id, css) {
    var style = $('#' + id);

    if (style.length === 0) {
      style = document.createElement('style');
      style.type = 'text/css';
      if (id !== undefined) {
        style.setAttribute('id', id);
      }

      style.appendChild(document.createTextNode(css));
      document.documentElement.appendChild(style);
    } else {
      style.html(css);
    }
  }
};
