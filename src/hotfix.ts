/**
 * Replaces the "Download" link with the name of the hotfix you're downloading
 */

function replaceHotfixLink(target : string) : void {
  var labelNode = document.querySelector('label[for="' + ns + target + '"]');

  if (!labelNode) {
    return;
  }

  var containerNode = labelNode.parentElement;

  if (!containerNode) {
    return;
  }

  var anchor = containerNode.querySelector('a');

  if (!anchor || !anchor.textContent) {
    return;
  }

  var href = <string> anchor.getAttribute('href');
  anchor.textContent = href.substring(href.lastIndexOf('/') + 1);
}
