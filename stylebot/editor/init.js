
chrome.storage.local.get(['options', 'styles'], function(items) {
  var style = new Style(window.location.href, items['styles']);
  stylebot.initialize(items['options'], style);
});
