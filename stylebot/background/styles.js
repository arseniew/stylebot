/**
 * @constructor
 * @param {Object} param JSON style object
 * Example:
 * styles = {
    'google.com' : {.
      _rules: {
        'a': {
          'color': 'red'
        }
      },
      _social: {
        id: 4,
        timestamp: 123456 (UNIX based)
      },
      _enabled: true
    }
  }
 */
function Style(pageURL, styles) {
  _.bindAll(this);

  Style.STYLEBOT_SOCIAL_URL = 'stylebot.me';
  Style.GLOBAL_STYLE_URL = '*';
  Style.AT_RULE_PREFIX = 'at';

  Style.PROPERTIES = {
    RULES: '_rules',
    SOCIAL: '_social',
    STATUS: '_enabled'
  };

  Style.importRules = {};
  Style.parser = null;
  Style.stylesCache = styles;

  var response = Style.getCombinedRulesForPage(pageURL);

  this.rules = response.rules;
  this.global = response.global;

  if (response.url) {
    this.url = response.url;
  } else {
    this.url = window.location.href;
  }

  this.social = response.social;
}

/**
 * Save rule
 * @param {string} selector CSS selector
 * @param {property} property CSS property
 * @param {value} value Value for property
 */
Style.prototype.saveRule = function(selector, property, value) {
  // check if the selector already exists in the list
  var rule = this.rules[selector];

  if (rule !== undefined) {
    if (value === '') {
      // does a value for property already exist
      if (rule[property] !== undefined) {
        delete this.rules[selector][property];

        // if no properties left, remove rule as well
        // TODO: Use something more elegant than this hack.
        var i = null;
        for (i in this.rules[selector]) {
          break;
        }

        if (!i) {
          delete this.rules[selector];
        }
      }
    }

    else {
      rule[property] = value;
    }
  }

  else if (value !== '') {
    this.rules[selector] = {};
    this.rules[selector][property] = value;
  }

  this.save();
};

Style.prototype.reset = function() {
  this.delete(this.url);
};

Style.prototype.resetRule  = function(selector) {
  if (this.styles.rules[this.cache.selector]) {
    delete this.styles.rules[this.cache.selector];
  }

  this.save();
};

/**
 * Parses CSS string into a rule and then saves the rule
 * for the given selector.
 * @param {string} css CSS String
 * @param {string} selector CSS selector
 */
Style.prototype.saveRuleWithCSS = function(selector, css) {
  if (!selector) {
    return;
  }

  // empty rule for selector
  delete this.rules[selector];

  if (css !== '') {
    if (!this.parser) {
      this.parser = new CSSParser();
    }

    var sheet = this.parser.parse(selector + '{' + css + '}', false, true);
    var generatedRule = CSSUtils.getRuleFromParserObject(sheet);
    this.rules[selector] = generatedRule;
  }

  this.save();
};

/**
 * Prepend an @import rule for a web-based font to the current
 * style and save the style.
 * @param {String} url The URL of the font.
 * @param {String} css the @font-face css for the font.
 */
Style.prototype.applyWebFont = function(url, css) {
  var rule = {
    'text': '@import url(' + url + ');',
    'expanded_text': css,
    'type': '@import',
    'url': url
  };

  rule[this.AT_RULE_PREFIX] = true;

  var selectorCounter = 1;
  while (this.rules.hasOwnProperty(this.AT_RULE_PREFIX + selectorCounter)) {
    selectorCounter ++;
  }

  var newRules = {};
  newRules[this.AT_RULE_PREFIX + selectorCounter] = rule;

  // todo: add ordering to styling rules, this is not reliable.
  _.each(this.rules, _.bind(function(rule, selector) {
    if (!this.rules[selector]['text'] || this.rules[selector]['text'] !== rule['text']) {
      newRules[selector] = this.rules[selector];
    }
  }, this));

  this.rules = newRules;
  this.save();
};

Style.prototype.getCSS = function(callback) {
  Style.getCSSForRules(this.rules, callback);
};

Style.prototype.getGlobalCSS = function(callback) {
  CSSUtils.crunchCSS(this.global, true, true, callback);
};

/**
 * Save the style to the store.
 * @param {Object} socialMetadata New metadata for the style.
 */
Style.prototype.save = function(socialMetadata) {
  if (!this.url || this.url === '') {
    return;
  }

  this.social = socialMetadata;
  if (!$.isEmptyObject(this.rules)) {
    Style.create(this.url, this.rules, socialMetadata);
  } else {
    Style.delete(this.url);
  }
};

// Static methods

Style.getFromStore = function(callback) {
  chrome.storage.local.get('styles', function(items) {
    if (items['styles']) {
      callback(items['styles']);
    } else {
      callback({});
    }
  });
};

Style.saveToStore = function(callback) {
  if (!callback) {
    callback = function() {};
  }

  chrome.storage.local.set({
    'styles': Style.stylesCache
  }, callback);
};

/**
 * If no value is given, toggle the enabled status for the given URL.
 *   Otherwise, set the enabled status for the given URL.
 * @param {String} url URL of the saved object.
 * @param {Object} value The enabled status for the given URL.
 */
Style.toggle = function(url, value, shouldSave) {
  var statusProperty = Style.PROPERTIES.STATUS;

  if (Style.isEmpty(url)) {
    return false;
  }

  if (value) {
    Style.stylesCache[url][statusProperty] = value;
  } else {
    Style.stylesCache[url][statusProperty] = !Style.stylesCache[url][statusProperty];
  }

  Style.saveToStore();
  return true;
};

/**
 * If no value is given, toggle the enabled status for all the styles.
 *   Otherwise, set the enabled status for all the styles.
 * @param {Object} value The enabled status.
 */
Style.toggleAll = function(value) {
  _.each(Style.stylesCache, function(url, rules) {
    Style.toggle(url, value, false);
  });

  Style.saveToStore();
};

Style.deleteAll = function() {
  Style.stylesCache = {};
  Style.saveToStore();
};

/**
 * Check if the style for the given identifier exists.
 * @param {String} url The style's identifier.
 * @return {Boolean} True if the requested style exists.
 */
Style.isEmpty = function(url) {
  return Style.stylesCache[url] === undefined || Style.stylesCache[url] === null;
};

/**
 * Empty the rules for a style
 * @param {String} url Identifier of the style to empty.
 */
Style.emptyRules = function(url) {
  Style.stylesCache[url][Style.RULES_PROPERTY] = null;
  Style.saveToStore();
};

/**
 * Import a styles object i.e. replace the existing styles
 *   object with the specified object
 * @param {Object} newStyles Styles object to import.
 */
Style.import = function(newStyles) {
  _.each(newStyles, function(url, style) {
    // New Format
    if (style[Style.PROPERTIES.RULES]) {
      Style.stylesCache[url] = newStyles[url];
    }

    // Legacy support
    else {
      Style.create(url, newStyles[url]);
    }
  });

  Style.saveToStore();
};

/**
 * Retrieve social data for the specified url.
 * @param {String} url The url for which to return the social data.
 * @return {Object} The social data for the given URL, if it exists. Else, null.
 */
Style.getSocialData = function(url) {
  var style = Style.get(url),
      socialMetadata = null;

  if (style) {
    socialMetadata = style[Style.PROPERTIES.SOCIAL];
  }

  return socialMetadata ? socialMetadata : null;
};

/**
 * Retrieve style rules for the specified url.
 * @param {String} url The url for which to return the rules.
 * @return {Object} The style rules for the URL, if it exists. Else, null.
 */
Style.getRules = function(url) {
  var style = Style.get(url),
      rules = null;

  if (style) {
    rules = style[Style.PROPERTIES.RULES];
  }

  return rules ? rules : null;
};

/**
 * Check if a style exists for the URL.
 * @param {String} aURL The URL to check.
 * @return {Boolean} True if any rules are associated with the URL
 */
Style.exists = function(url) {
  return ((Style.isEnabled(url) && url !== Style.GLOBAL_STYLE_URL));
};

/**
 * Retrieve all the CSS rules applicable to the URL, including global CSS rules.
 * @param {String} aURL The URL to retrieve the rules for.
 * @return {Object} rules: The rules. url: The identifier representing the URL.
 */
Style.getCombinedRulesForPage = function(url, tab) {
  var globalRules = null,
    rules = {},
    pageURL = '',
    social = null,
    globalStyleUrl = Style.GLOBAL_STYLE_URL,
    socialUrl = Style.STYLEBOT_SOCIAL_URL;

  if (!url.isOfHTMLType()) {
    return {
      rules: null,
      url: null,
      global: null,
      social: null
    };
  }

  if (!Style.isEmpty(globalStyleUrl) && Style.isEnabled(globalStyleUrl)) {
    globalRules = Style.getRules(globalStyleUrl);
  }

  // If the URL is for stylebot social, return rules for it if they exist
  // otherwise, return response as null.
  // this is so that URLs of the form stylebot.me/search?q=google.com
  // work properly.
  if (url.indexOf(socialUrl) != -1) {
    if (!Style.isEmpty(socialUrl)) {
      rules = Style.getRules(socialUrl);
      social = Style.getSocialData(socialUrl);
      pageURL = socialUrl;
    } else {
      rules = null;
      pageURL = null;
    }
  }

  else {
    // this will contain the combined set of evaluated rules to be applied to
    // the page. longer, more specific URLs get the priority for each selector
    // and property
    var found = false;

    for (var styleURL in Style.stylesCache) {
      if (!Style.isEnabled(styleURL) || styleURL === globalStyleUrl) {
        continue;
      }

      if (url.matchesPattern(styleURL)) {
        if (!found) {
          found = true;
        }

        if (styleURL.length > pageURL.length) {
          pageURL = styleURL;
          social = Style.getSocialData(styleURL);
        }

        Style.copyRules(tab, Style.getRules(styleURL),
          rules, (styleURL === pageURL));
      }
    }

    if (!found) {
      rules = null;
      pageURL = null;
      social = null;
    }
  }

  // BrowserAction.update(tab);

  return {
    url: pageURL,
    rules: rules,
    global: this.expandRules(globalRules),
    social: social
  };
};

// Style.getCombinedRulesForIframe = function(aURL, tab) {
//   return (this.response ? this.response : this.getCombinedRulesForPage(aURL, tab));
// }

/**
 * Retrieve all the global rules.
 *   The global rules are stored for the url '*'
 * @return {Object} The rules of the global stylesheet.
 */
Style.getGlobalRules = function() {
  var globalStyleUrl = Style.GLOBAL_STYLE_URL;

  if (Style.isEmpty(globalStyleUrl) || !Style.isEnabled(globalStyleUrl)) {
    return null;
  }

  return Style.getRules(globalStyleUrl);
};

/**
 * Transfer rules from source URL to destination URL.
 * @param {String} source Source's identifier.
 * @param {String} destination Destination's identifier.
 */
Style.transfer = function(source, destination) {
  if (Style.stylesCache[source]) {
    Style.stylesCache[destination] = Style.stylesCache[source];
    Style.saveToStore();
  }
};

/**
 * Copy rules into another rules object while managing conflicts.
 * @param {Object} src Rules that should be copied
 * @param {Object} dest Rules object where the new rules are to be copied
 * @param {Boolean} isPrimaryURL If the url for the source rules is the primary
 *   url for the page. Used to manage conflicts.
 */
Style.copyRules = function(tab, src, dest, isPrimaryURL) {
  for (var selector in src) {
    var rule = src[selector];

    // if no rule exists in dest for selector, copy the rule.
    if (dest[selector] == undefined) {
      rule = Style.expandRule(selector, rule);
      dest[selector] = cloneObject(rule);
    }

    // else, merge properties for rule, with the rules in dest taking priority.
    else {
      for (var property in src) {
        if (dest[selector][property] == undefined || isPrimaryURL) {
          dest[selector][property] = src[selector][property];
        }
      }
    }
  }
};

Style.expandRules = function(rules) {
  for (selector in rules) {
    rules[selector] = Style.expandRule(selector, rules[selector]);
  }

  return rules;
};

/**
 * Expand rule to include any additional properties. Currently
 * expands only @import rule.
 * @param {String} selector The CSS selector for the rule.
 * @param {Object} rule The Rule to expand
 * @param {Function} callback The callback method that is passed the expanded
 *   rule.
 */
Style.expandRule = function(selector, rule) {
  if (Style.isImportRuleSelector(selector)) {
    var expandedRule = Style.expandImportRule(rule);

    if (expandedRule) {
      rule = expandedRule;
    }
  }

  return rule;
};

/**
 * Check if the selector corresponds to an @import rule. The selector
 * is of the form "at-N" for @import rules (where N is the line number)
 * @param {String} selector The CSS selector for the rule
 * @return {Boolean} True if the selector corresponds to an @import rule
 */
Style.isImportRuleSelector = function(selector) {
  return selector.indexOf(Style.AT_RULE_PREFIX) == 0;
};

/**
 * Expand @import rule to include the CSS fetched from the URL
 *   and send a push request to specified tab to update the rule.
 * @param {Object} rule The @import rule to expand
 */
Style.expandImportRule = function(rule) {
  var css = Style.importRules[rule['url']];

  if (css) {
    rule['expanded_text'] = css;
    return rule;
  }

  Style.fetchImportCSS(rule['url'], function(css) {
    rule['expanded_text'] = css;
  });
};

/**
 * Fetch css for an @import rule
 * @param {String} url URL for the @import rule
 * @param {Function} callback This method is passed the css for the @import rule
 */
Style.fetchImportCSS = function(url, callback) {
  if (Style.importRules[url]) {
    callback(Style.importRules[url]);
  }

  else {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);

    xhr.onreadystatechange = _.bind(function() {
      if (xhr.readyState === 4) {
        Style.importRules[url] = xhr.responseText;
        callback(xhr.responseText);
      }
    }, this);

    xhr.send();
  }
};

/**
 * Delete a style.
 * @param {String} url The url of the style to delete.
 */
Style.delete = function(url) {
  delete Style.stylesCache[url];
  Style.saveToStore();
};

/**
 * Return the style object associated with the given url.
 *   If no url is given, return all the style objects.
 * @param {String} url The URL of the requested object.
 * @return {Object} The request style(s) object(s).
 */
Style.get = function(url) {
  if (url === undefined) {
    return null;
  } else {
    return Style.stylesCache[url];
  }
};

Style.set = function(url, value) {
  if (url === undefined) {
    return false;
  } else {
    Style.stylesCache[url] = value;
    return value;
  }
};

/**
 * Create a new style for the specified URL
 * @param {String} url URL of the new object.
 * @param {Object} rules Rules for the given URL.
 */
Style.create = function(url, rules, data) {
  var cache = Style.stylesCache,
      props = Style.PROPERTIES;

  cache[url][props.STATUS] = true;
  cache[url][props.RULES] = (rules === undefined ? {} : rules);

  if (data !== undefined) {
    Style.setMetadata(url, data);
  }

  Style.saveToStore();
};

/**
 * Save the metadata for the given URL' style.
 * @param {String} url URL of the saved object.
 * @param {Object} data New metadata for the given URL.
 */
Style.setMetadata = function(url, data) {
  Style.stylesCache[url][Style.PROPERTIES.SOCIAL] = {
    id: data.id,
    timestamp: data.timestamp
  };
};

/**
 * Retrieve the enabled status for the given URL.
 * @param {String} url URL of the requested object.
 * @return {Boolean} The enabled status for the given URL.
 */
Style.isEnabled = function(url) {
  var style = Style.get(url);
  if (style) {
    return style[Style.PROPERTIES.STATUS];
  }

  return false;
};

Style.getCSSForRules = function(rules, callback) {
  CSSUtils.crunchCSS(rules, true, true, callback);
};
