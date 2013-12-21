/**
 * stylebot
 *
 * Copyright (c) 2013 Ankit Ahuja
 * Dual licensed under GPL and MIT licenses
 **/

var stylebot = {
  status: false,
  selectedElement: null,
  hoveredElement: null,
  selectionStatus: false,
  selectionBox: null,
  selectorGenerator: null,

  defaults: {
    useShortcutKey: true,
    shortcutKey: 77, // keycode for 'm'
    shortcutMetaKey: 'alt',
    mode: 'Basic',
    position: 'Right',
    sync: false,
    livePreviewColorPicker: false
  },

  /**
   * Initialize stylebot
   * @param {Object} options Stylebot options
   * @param {Object} styles User styles
   */
  initialize: function(options, styles) {
    _.bindAll(this);

    this.options = _.defaults(options, this.defaults);
    this.selectorGenerator = new SelectorGenerator();

    this.style.initialize(styles);
    this.contextmenu.initialize();
    this.widget.basic.accordions = options.accordions;

    this.attachDocumentListeners();
  },

  /**
   * Apply stylebot options
   * @param {object} options Options to apply
   */
  setOptions: function(options) {
    for (var option in options) {
      this.options[option] = options[option];
    }
  },

  /**
   * Open / close editor
   */
  toggle: function() {
    if (this.status) {
      this.close();
    } else {
      this.open();
    }
  },

  /**
   * Open stylebot editor
   */
  open: function() {
    this.attachStylebotListeners();
    this.style.enable();
    this.widget.open();
    this.status = true;
    this.chrome.setBrowserAction(true);
    this.enableSelection();
    attachKeyboardShortcuts();
  },

  /**
   * Close stylebot editor
   */
  close: function() {
    this.widget.close();
    this.status = false;
    this.chrome.setBrowserAction(false);
    this.style.clean();
    this.disableSelection();
    this.detachStylebotClickListener();
    this.unhighlight();
    this.selectedElement = null;
    this.destroyHighlighter();
    detachKeyboardShortcuts();
  },

  /**
   * Highlight specified element
   * @param {element} el Element to highlight
   */
  highlight: function(el) {
    if (!this.selectionBox) {
      this.createHighlighter();
    }

    this.hoveredElement = el;
    this.selectionBox.highlight(el);
  },

  /**
   * Remove highlight from previously selected element
   */
  unhighlight: function() {
    this.hoveredElement = null;
    if (this.selectionBox) {
      this.selectionBox.hide();
    }
  },

  /**
   * Select element(s)
   * @param {element} el Element to select
   * @param {string} selector CSS selector for elements to select
   */
  select: function(el, selector) {
    this.disableSelection();

    // if element is specified, it is selected
    if (el) {
      this.selectedElement = el;
      selector = this.selectorGenerator.generate(el);
      this.highlight(el);
    }

    // else select all elements that match the specified CSS selector
    else if (selector) {
      try {
        el = $(selector).get(0);
        this.selectedElement = el;
        this.highlight(el);
      }

      catch (e) {
        this.selectedElement = null;
      }
    }
    else {
      this.selectedElement = this.hoveredElement;
      selector = this.selectorGenerator.generate(this.selectedElement);
    }

    this.style.setSelector(selector);
    this.widget.open();

    setTimeout(_.bind(function() {
      this.style.replaceAsInlineCSS(selector);
    }, this), 100);
  },

  /**
   * Enable / disable selection of elements
   */
  toggleSelection: function() {
    if (this.selectionStatus) {
      this.select(null, this.style.cache.selector);
      this.disableSelection();
    }

    else {
      this.widget.disable();
      this.unhighlight();
      this.enableSelection();
    }
  },

  /**
   * Enable selection of elements
   */
  enableSelection: function() {
    this.attachStylebotListeners();
    this.selectionStatus = true;
    this.widget.cache.headerSelectIcon
      .addClass('stylebot-select-icon-active')
      .attr('title', 'Click to disable selection of element');
  },

  /**
   * Disable selection of elements
   */
  disableSelection: function() {
    this.detachStylebotListeners();
    this.selectionStatus = false;
    this.widget.cache.headerSelectIcon
      .removeClass('stylebot-select-icon-active')
      .attr('title', 'Click to enable selection of element');
  },

  /**
   * Create the highlighter
   */
  createHighlighter: function() {
    this.selectionBox = new SelectionBox(null, null, $('#stylebot-container').get(0));
  },

  /**
   * Remove the highlighter
   */
  destroyHighlighter: function() {
    if (this.selectionBox) {
      this.selectionBox.destroy();
      this.selectionBox = null;
    }
  },

  attachDocumentListeners: function() {
    document.addEventListener('keydown', _.bind(function(e) {
      if (Utils.isInputField(e.target)) {
        return true;
      }

      if (this.options.useShortcutKey && e.keyCode == this.options.shortcutKey) {
        if (this.options.shortcutMetaKey === 'ctrl' && e.ctrlKey
        || this.options.shortcutMetaKey === 'shift' && e.shiftKey
        || this.options.shortcutMetaKey === 'alt' && e.altKey
        || this.options.shortcutMetaKey === 'none') {
          e.preventDefault();
          e.stopPropagation();
          this.toggle();
          return false;
        }
      }
      // Handle Esc key to escape editing mode
      else if (e.keyCode === 27 && this.shouldClose(e.target)) {
        e.target.blur();
        this.close();
      }

      return true;
    }, this), true);
  },

  /**
   * Add event listeners for mouse activity
   */
  attachStylebotListeners: function() {
    document.addEventListener('mousemove', this.onMouseMove, true);
    document.addEventListener('mousedown', this.onMouseDown, true);
    document.addEventListener('click', this.onMouseClick, true);
  },

  /**
   * Remove event listeners for mouse activity
   */
  detachStylebotListeners: function() {
    document.removeEventListener('mousemove', this.onMouseMove, true);
    document.removeEventListener('mousedown', this.onMouseDown, true);
  },

  /**
   * Remove event listener for mouse click
   */
  detachStylebotClickListener: function() {
    // We have to remove the click listener in a second phase because if we remove it
    // after the mousedown, we won't be able to cancel clicked links
    // thanks to firebug
    document.removeEventListener('click', this.onMouseClick, true);
  },

  /**
   * When the user moves the mouse
   */
  onMouseMove: function(e) {
    // for dropdown
    if (e.target.className === 'stylebot-dropdown-li') {
      var $el = $(e.target.innerText).get(0);
      if ($el !== this.hoveredElement) {
        this.highlight($el);
      }

      return true;
    }

    if (!this.shouldSelect(e.target)) {
      return true;
    }

    if (this.belongsToStylebot(e.target)) {
      this.unhighlight();
      return true;
    }

    e.preventDefault();
    e.stopPropagation();

    this.highlight(e.target);
  },

  /**
   * When the user has pressed the mouse button down
   */
  onMouseDown: function(e) {
    if (!this.belongsToStylebot(e.target)) {
      e.preventDefault();
      e.stopPropagation();

      this.select();
      return false;
    }
  },

  /**
   * When the user clicks the mouse
   */
  onMouseClick: function(e) {
    if (!this.belongsToStylebot(e.target)) {
      e.preventDefault();
      e.stopPropagation();

      this.detachStylebotClickListener();
      return false;
    }
  },

  /**
   * Checks if the specified element belongs to the stylebot editor
   * @param {element} el Element to check
   * @return {boolean} True if element belongs to stylebot
   */
  belongsToStylebot: function(el) {
    var $el = $(el),
        parent = $el.closest('#stylebot-container'),
        id = $el.attr('id');

    return (parent.length !== 0 ||
      (id && id.indexOf('stylebot') !== -1));
  },

  /**
   * Checks if the stylebot editor should close
   * @param {element} el Currently selected element
   * @return {boolean} Returns true if stylebot editor can close
   */
  shouldClose: function(el) {
    return !(!this.status ||
      this.widget.basic.isColorPickerVisible ||
      this.isKeyboardHelpVisible ||
      this.page.isVisible ||
      $('#stylebot-dropdown').length !== 0 ||
      el.tagName === 'SELECT');
  },

  /**
   * Checks if the specified element can be selected
   * @param {element} el The element to select
   * @return {boolean} Returns true if element should be selected
   */
  shouldSelect: function(el) {
    return !(this.widget.isBeingDragged ||
      this.page.isVisible ||
      this.isKeyboardHelpVisible ||
      this.hoveredElement === el
    );
  }
};
