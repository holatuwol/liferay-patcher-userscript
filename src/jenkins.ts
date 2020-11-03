/**
 * Replaces any links to a jenkins fix pack builder result with a link that
 * ends with '/consoleText' to take you directly to the build log.
 */

function replaceJenkinsLinks() {
  var links = document.querySelectorAll('a[href*="/job/fixpack-builder"]:not([href*="consoleText"])');

  for (var i = 0; i < links.length; i++) {
    var href = <string> links[i].getAttribute('href');

    if (href.charAt(href.length - 1) != '/') {
      href += '/';
    }

    links[i].setAttribute('href', href + 'consoleText');
  }

  links = document.querySelectorAll('a[href*="//test-5-2/"]');

  for (var i = 0; i < links.length; i++) {
    var oldHREF = <string> links[i].getAttribute('href');
    var newHREF = oldHREF.replace(/\/\/test-5-2\//gi, '//test-5-2.liferay.com/');
    links[i].setAttribute('href', newHREF);
  }
}