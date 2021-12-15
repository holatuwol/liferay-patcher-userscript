/**
 * Looks up the 6.2 fix pack.
 */

var fixPackMetadata = <FixPackMetadata | null> null;

function getFixPack() : FixPackMetadata | null {
  var projectNode = <HTMLElement> querySelector('patcherProjectVersionId');
  var versionId = '';
  var baseTag = '';

  if (projectNode.tagName.toLowerCase() == 'input') {
    var projectInputElement = <HTMLInputElement> projectNode;
    versionId = projectInputElement.value;

    var container = <HTMLElement> projectNode.parentElement;
    var versionNode = <HTMLAnchorElement> container.querySelector('a');
    baseTag = versionNode.textContent || '';
  }
  else {
    var projectSelectNode = <HTMLSelectElement> projectNode;

    if (projectSelectNode.selectedIndex == -1) {
      return null;
    }

    var versionElement = <HTMLOptionElement> projectSelectNode.options[projectSelectNode.selectedIndex];
    versionId = versionElement.value;
    baseTag = (versionElement.textContent || '').trim();
  }

  if (fixPackMetadata && fixPackMetadata.versionId == versionId) {
    return fixPackMetadata;
  }

  if (baseTag.indexOf('6.2') == 0) {
    fixPackMetadata = get62FixPack(versionId);
  }
  else {
    fixPackMetadata = {
      'tag': baseTag,
      'name': baseTag,
      'versionId': versionId
    };
  }

  return <FixPackMetadata> fixPackMetadata;
}

function get62FixPack(
  versionId : string
) : FixPackMetadata {

  var fixPackListURL = 'https://patcher.liferay.com/group/guest/patching/-/osb_patcher/fix_packs?' + getQueryString({delta: 200});

  var oldNode = <HTMLInputElement | null> querySelector('patcherFixName');

  if (!oldNode) {
    oldNode = <HTMLInputElement | null> querySelector('patcherBuildName');
  }

  var baseTag = '';
  var value = oldNode ? oldNode.value : '';
  var fixPackName = value.split(',').filter(x => x.indexOf('portal-') == 0)[0];

  if (fixPackName) {
    var xhr1 = new XMLHttpRequest();

    xhr1.open('GET', fixPackListURL, false);
    xhr1.onload = function() {
      // https://stackoverflow.com/questions/20583396/queryselectorall-to-html-from-another-page
      var container1 = document.implementation.createHTMLDocument().documentElement;
      container1.innerHTML = xhr1.responseText;

      var fixPackURL = <string> Array.from(container1.querySelectorAll('table tbody tr td a'))
        .filter(x => (x.textContent || '').trim() == fixPackName)
        .map(x => x.getAttribute('href'))[0];

      var xhr2 = new XMLHttpRequest();

      xhr2.open('GET', fixPackURL, false);
      xhr2.onload = function() {
        // https://stackoverflow.com/questions/20583396/queryselectorall-to-html-from-another-page
        var container2 = document.implementation.createHTMLDocument().documentElement;
        container2.innerHTML = xhr2.responseText;

        var gitHashLabelNode = <HTMLLabelElement> container2.querySelector('label[for="' + ns + 'git-hash"]');

        if (!gitHashLabelNode) {
          return;
        }

        var gitHashLabelParentElement = <HTMLElement> gitHashLabelNode.parentElement;
        var gitHubNode = gitHashLabelParentElement.querySelector('a');

        if (gitHubNode) {
          var gitHubURL = <string> gitHubNode.getAttribute('href');
          baseTag = gitHubURL.substring(gitHubURL.indexOf('...') + 3);
        }
      };

      xhr2.send(null);
    };

    xhr1.send(null);
  }

  if (!baseTag) {
    var versionLabel = <HTMLLabelElement> document.querySelector('label[for="' + ns + 'patcherProjectVersionId"]');
    var versionHolder = <HTMLElement> versionLabel.parentElement;
    var versionNode = versionHolder.querySelector('a');

    var fixPackName = '';

    if (versionNode) {
      fixPackName = versionNode.textContent || '';
    }
    else {
      var versionOption = <HTMLOptionElement> versionHolder.querySelector('option[selected]');

      if (versionOption == null) {
        var versionSelect = <HTMLSelectElement> versionHolder.querySelector('select');
        versionOption = <HTMLOptionElement> versionSelect.querySelector('option[value="' + versionSelect.value + '"]');
      }

      fixPackName = (versionOption.textContent || '').trim();
    }

    baseTag = (fixPackName.indexOf(' ') == -1) ? 'fix-pack-base-6210' : 'fix-pack-base-6210-' + fixPackName.toLowerCase().substring(fixPackName.indexOf(' ') + 1);
  }

  return {
    'tag': baseTag,
    'name': fixPackName,
    'versionId': versionId
  };
}

/**
 * Replaces the plain text branch name with a link to GitHub.
 */

function replaceBranchName() {
  var branchNode = <HTMLInputElement> querySelector('committish');
  var gitRemoteNode = <HTMLInputElement> querySelector('gitRemoteURL');

  if (!branchNode || !gitRemoteNode || !branchNode.readOnly) {
    return;
  }

  var fixPack = getFixPack();

  if (!fixPack) {
    return;
  }

  var baseTag = fixPack.tag;
  var branchName = branchNode.value;

  var gitRemoteURL = gitRemoteNode.value;
  var gitRemotePath = gitRemoteURL.substring(gitRemoteURL.indexOf(':') + 1, gitRemoteURL.lastIndexOf('.git'));
  var gitRemoteUser = gitRemotePath.substring(0, gitRemotePath.indexOf('/'));

  var gitHubPath = 'https://github.com/' + gitRemotePath;

  replaceNode(branchNode, '<a href="https://github.com/liferay/liferay-portal-ee/compare/' + baseTag + '...' + gitRemoteUser + ':' + branchName + '">' + branchName + '</a>');
  replaceNode(gitRemoteNode, '<a href="' + gitHubPath + '">' + gitRemoteURL + '</a>');
}