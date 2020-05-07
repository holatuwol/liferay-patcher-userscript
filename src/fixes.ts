/**
 * Replaces the list of fixes with a list of JIRA links.
 */

function replaceFixes() : void {
  var oldNode = <HTMLInputElement | null> querySelector('patcherFixName');

  if (!oldNode || !oldNode.readOnly) {
    return;
  }

  replaceNode(oldNode, oldNode.innerHTML.split(',').map(getTicketLink.bind(null, '')).join(', '));
}
