/**
 * Returns the HTML for a build link. If it links to the current page, then just return
 * regular text.
 */

function getBuildLinkHTML(build : BuildMetadata) : string {
  var currentURL = document.location.protocol + '//' + document.location.host + document.location.pathname;

  return (currentURL == build.buildLink) ? build.branchType : '<a href="' + build.buildLink + '">' + build.branchType + '</a>';
}

/**
 * Processes a single child build and generates the HTML for its git hash compare link.
 */

function getChildBuildHash(
  mergeCompareLink : string,
  build : BuildMetadata
) : string {

  var baseTag = build.branchName;

  if (baseTag.indexOf('6.2') == 0) {
    var fixPack = <FixPackMetadata> getFixPack();
    baseTag = fixPack.tag;
  }

  var compareLink = 'https://github.com/liferay/liferay-portal-ee/compare/' + baseTag + '...fix-pack-fix-' + build.patcherFixId;

  var extraHTML = (compareLink == mergeCompareLink) ? ' (build tag)' : '';

  return '<tr><th class="branch-type">' + getBuildLinkHTML(build) + '</th><td><a href="' + compareLink + '" target="_blank">fix-pack-fix-' + build.patcherFixId + '</a>' + extraHTML + '</td></tr>';
}

/**
 * Processes a single child build and generates the HTML for its fixes.
 */

function replaceGitHashes(
  childBuildsMetadata : Array<BuildMetadata>
) : void {

  var gitHashLabel = document.querySelector('label[for="' + ns + 'git-hash"]');

  if (!gitHashLabel) {
    return;
  }

  var gitHashLabelParentElement = <HTMLElement> gitHashLabel.parentElement;
  var oldNode = <HTMLAnchorElement> gitHashLabelParentElement.querySelector('a');
  var mergeCompareLink = oldNode.href;

  var patcherFixIds = {};
  var patcherFixIdCount = 0;

  var joinFunction = function(build : BuildMetadata, obj : any) : void {
    build.patcherFixId = obj.data.patcherFixId;

    if (++patcherFixIdCount != childBuildsMetadata.length) {
      return;
    }

    var tableRows = childBuildsMetadata.map(getChildBuildHash.bind(null, mergeCompareLink));

    replaceNode(oldNode, '<table class="table table-bordered table-hover"><tbody class="table-data">' + tableRows.join('') + '</tbody></table>');
  }

  for (var i = 0; i < childBuildsMetadata.length; i++) {
    var childBuildFunction = joinFunction.bind(null, childBuildsMetadata[i]);

    if (exportFunction) {
      childBuildFunction = exportFunction(childBuildFunction, unsafeWindow);
    }

    var childBuildArguments = { id: childBuildsMetadata[i].buildId };

    if (cloneInto) {
      childBuildArguments = cloneInto(childBuildArguments, unsafeWindow);
    }

    Liferay.Service(
      '/osb-patcher-portlet.builds/view',
      childBuildArguments,
      childBuildFunction
    );
  }
}

/**
 * Parses the row for any build metadata
 */

function getBuildMetadata(
  row : HTMLTableRowElement
) : BuildMetadata {

  var buildId = (row.cells[0].textContent || '').trim();
  var buildLink = 'https://patcher.liferay.com/group/guest/patching/-/osb_patcher/builds/' + buildId;
  var branchName = (row.cells[3].textContent || '').trim();
  var branchType = branchName.indexOf('-private') != -1 ? 'private' : 'public';
  var fixesText = row.cells[2].textContent || '';

  return {
    buildId: buildId,
    buildLink: buildLink,
    branchName: branchName,
    branchType: branchType,
    fixes: fixesText.split(',').map(x => x.trim()).sort(compareTicket),
    fixesHTML: getTicketLinks(fixesText, ''),
    patcherFixId: null
  }
}

/**
 * Processes the child build text.
 */

function processChildBuilds(
  xhr : XMLHttpRequest,
  oldFixesNode : HTMLInputElement
) : void {

  // https://stackoverflow.com/questions/20583396/queryselectorall-to-html-from-another-page
  var container = document.implementation.createHTMLDocument().documentElement;
  container.innerHTML = xhr.responseText;

  var rows = Array.from(container.querySelectorAll('table tbody tr')).filter(row => !row.classList.contains('lfr-template'));

  var childBuildsMetadata = rows.map(getBuildMetadata);

  var childBuildFixesHTML = childBuildsMetadata.map(build => '<tr><th class="branch-type">' + getBuildLinkHTML(build) + '</th><td>' + build.fixesHTML + '</td><td></td></tr>');

  replaceNode(oldFixesNode, '<table class="table table-bordered table-hover"><tbody class="table-data">' + childBuildFixesHTML.join('') + '</tbody></table>');
  replaceGitHashes(childBuildsMetadata);
}

function replaceBuild() : void {
  if (document.location.pathname.indexOf('/builds/') == -1) {
    return;
  }

  var buildNode = <HTMLInputElement | null> querySelector('patcherBuildName');

  if (!buildNode || !buildNode.readOnly) {
    return;
  }

  var fixes = new Set(buildNode.innerHTML.split(',').map(x => x.trim()));
  var childBuildsButton = Array.from(document.querySelectorAll('button')).filter(x => (x.textContent || '').trim() == 'View Child Builds');

  var buildId = document.location.pathname.substring(document.location.pathname.lastIndexOf('/') + 1);
  var buildLink = 'https://patcher.liferay.com/group/guest/patching/-/osb_patcher/builds/' + buildId;
  var projectVersionSelect = <HTMLSelectElement> querySelector('patcherProjectVersionId');
  var branchName = (projectVersionSelect.options[projectVersionSelect.selectedIndex].textContent || '').trim();
  var branchType = branchName.indexOf('-private') != -1 ? 'private' : 'public';
  var fixesText = buildNode.innerHTML;

  var build = {
    buildId: buildId,
    buildLink: buildLink,
    branchName: branchName,
    branchType: branchType,
    fixes: fixesText.split(',').map(x => x.trim()).sort(compareTicket),
    fixesHTML: getTicketLinks(fixesText, ''),
    patcherFixId: null
  };

  var childBuildFixesHTML = '<tr><th class="branch-type">' + getBuildLinkHTML(build) + '</th><td>' + build.fixesHTML + "</td></tr>";
  var fixedInLaterVersionsHTML = '';
  
  if (branchName.indexOf(".q") != -1) {
    var jql = "key in (" + build.fixes.join(",") + ") and cf[10886] ~ \"" + branchName.substring(0, branchName.lastIndexOf(".")) + ".*\"";
    fixedInLaterVersionsHTML = "<tr><td colspan=\"2\"><a href=\"https://issues.liferay.com/issues/?jql=" + encodeURIComponent(jql) + "\" target=\"_blank\">check if fixed in newer patch level of this quarterly release</a></td></tr>";
  }

  if (childBuildsButton.length == 0) {
    replaceNode(buildNode, '<table class="table table-bordered table-hover"><tbody class="table-data">' + childBuildFixesHTML + fixedInLaterVersionsHTML + '</tbody></table>');
    replaceGitHashes([build]);
  }
  else {
    var xhr = new XMLHttpRequest();

    xhr.open('GET', document.location.pathname + '/childBuilds');

    xhr.onload = processChildBuilds.bind(null, xhr, buildNode);

    xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, max-age=0');
    xhr.setRequestHeader('Pragma', 'no-cache');

    xhr.send(null);
  }

  var originalBuildNode = querySelector('patcherBuildOriginalName');

  if (originalBuildNode) {
    var excludedFixes = originalBuildNode.innerHTML.split(',').map(x => x.trim()).filter(x => !fixes.has(x));
    var excludedHTML = excludedFixes.sort(compareTicket).map(getTicketLink.bind(null, 'included-in-baseline')).join(', ');

    var excludedFixesHTML = '<tr><th class="branch-type">excluded</th><td>' + excludedHTML + '</td></tr>';
    replaceNode(originalBuildNode, '<table class="table table-bordered table-hover"><tbody class="table-data">' + childBuildFixesHTML + excludedFixesHTML + fixedInLaterVersionsHTML + '</tbody></table>');
  }
}
