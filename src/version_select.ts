function replaceReadOnlySelect(
  name: string,
  text: string | null,
  link: string | null
) : void {

  var select = <HTMLSelectElement | null> querySelector(name);

  if (!select || !select.disabled) {
    return;
  }

  if (link) {
    replaceNode(select, '<a href="' + link + '">' + text + '</a>');
  }
  else {
    replaceNode(select, select.options[select.selectedIndex].textContent || 'unknown');
  }
}

var liferayVersions = ['', '6.x', '7.0', '7.1', '7.2', '7.3', '7.4'];

/**
 * Determines the broad Liferay version (e.g. '7.4') that a product
 * version select option's text belongs to, based on the same text
 * patterns used to tag the options in addProductVersionFilter.
 */

function getProductVersionLiferayVersion(optionText : string) : string | null {
  if (optionText.trim() == 'Quarterly Releases') {
    return '7.4';
  }

  for (var i = 1; i < liferayVersions.length; i++) {
    if ((optionText.indexOf('DXP ' + liferayVersions[i]) != -1) || (optionText.indexOf('Portal ' + liferayVersions[i]) != -1)) {
      return liferayVersions[i];
    }
  }

  return null;
}

/**
 * Removes the options from a project version select whose text doesn't
 * belong to the given broad Liferay version, so that the create fix
 * page's project version select only shows versions relevant to the
 * selected product version.
 */

function pruneProjectVersionOptions(
  select : HTMLSelectElement,
  liferayVersion : string
) : void {

  if (liferayVersion == '7.4') {
    for (var i = select.options.length - 1; i >= 0; i--) {
      var version = (select.options[i].textContent || '').trim();
      if ((version != '') && (version.indexOf('7.4.13-') == -1) && (version.indexOf('.q') == -1)) {
        select.options[i].remove();
      }
    }
  }
  else {
    var versionString = '-' + liferayVersion.replace('.', '') + '10';

    for (var i = select.options.length - 1; i >= 0; i--) {
      var version = (select.options[i].textContent || '').trim();
      if ((version != '') && (version.indexOf(versionString) == -1)) {
        select.options[i].remove();
      }
    }
  }
}

/**
 * Adds a new element to the page to allow you to select from a list of
 * Liferay versions before choosing a product version. Only applies on
 * the create fix page, since on other pages (e.g. viewing an existing
 * build or fix) this select is either disabled or not meant to have its
 * defaults second-guessed.
 */

function addProductVersionFilter() : void {
  var productVersionSelect = <HTMLSelectElement> querySelector('patcherProductVersionId');

  if (!productVersionSelect) {
    return;
  }
  
  if (productVersionSelect.disabled) {
    var metadata = <FixPackMetadata> getFixPack();
    var patcherTagName = metadata.tag;
    var branchName = metadata.name;

    replaceReadOnlySelect('patcherProductVersionId', null, null);
    replaceReadOnlySelect('patcherProjectVersionId', branchName, 'https://github.com/liferay/liferay-portal-ee/tree/' + patcherTagName);

    return;
  }

  if (document.location.pathname.indexOf('/create') == -1) {
    return;
  }

  var selectedVersion = null;

  for (var i = 0; i < productVersionSelect.options.length; i++) {
    var option = productVersionSelect.options[i];
    var liferayVersion = getProductVersionLiferayVersion(option.textContent || '');

    if (liferayVersion) {
      option.setAttribute('data-liferay-version', liferayVersion);
    }

    if (option.selected) {
      selectedVersion = option.getAttribute('data-liferay-version');
    }
  }

  var hadSelectedVersion = !!selectedVersion;

  if (!selectedVersion) {
    selectedVersion = '7.4';
  }

  var liferayVersionSelect = document.createElement('select');
  liferayVersionSelect.id = ns + 'liferayVersion';

  for (var i = 0; i < liferayVersions.length; i++) {
    var option = document.createElement('option');
    option.value = liferayVersions[i];
    option.selected = (selectedVersion == liferayVersions[i]);
    option.textContent = liferayVersions[i];
    liferayVersionSelect.appendChild(option);
  };

  liferayVersionSelect.addEventListener('change', updateProductVersionSelect);
  productVersionSelect.addEventListener('change', setTimeout.bind(null, updateProjectVersionOrder, 500));

  var productVersionSelectParentElement = <HTMLElement> productVersionSelect.parentElement;
  productVersionSelectParentElement.insertBefore(liferayVersionSelect, productVersionSelect);

  if (hadSelectedVersion && selectedVersion) {
    productVersionSelect.setAttribute('data-liferay-version', selectedVersion);
    addProjectVersionFilter(productVersionSelect, selectedVersion);
  }
  else {
    updateProductVersionSelect();
  }

  waitForElement('patcherProjectVersionId').then(function(element) {
    addProjectVersionFilterInput(<HTMLSelectElement> element);
  });
}

/**
 * Adds a text input that filters the options of the project version
 * select as you type. Called immediately after the project version
 * select is synthesized (when a product version was already selected on
 * page load), later once the portlet's own AJAX call populates the
 * project version select after the user picks a product version
 * manually (since selectedVersion is null on a fresh "create fix" form
 * and addProjectVersionFilter never runs in that case), and also for
 * any other page's project version filter select (see
 * sortProjectVersionIdFilterSelects). A given select is only marked up
 * with a filter input once, tracked on the select itself rather than by
 * a fixed input id, since there can be more than one such select on the
 * same page.
 */

function addProjectVersionFilterInput(
  projectVersionSelect : HTMLSelectElement
) : void {

  if (projectVersionSelect.getAttribute('data-has-filter-input') == 'true') {
    return;
  }

  projectVersionSelect.setAttribute('data-has-filter-input', 'true');

  var projectVersionFilterInput = document.createElement('input');
  projectVersionFilterInput.type = 'text';
  projectVersionFilterInput.placeholder = 'Filter project versions';

  projectVersionFilterInput.addEventListener('input', function() {
    filterProjectVersionSelect(projectVersionSelect, projectVersionFilterInput.value);
  });

  var projectVersionSelectParentElement = <HTMLElement> projectVersionSelect.parentElement;
  projectVersionSelectParentElement.insertBefore(projectVersionFilterInput, projectVersionSelect);

  filterProjectVersionSelect(projectVersionSelect, '');

  Liferay.fire('projectVersionIdReady');
}

function addProjectVersionFilter(
  productVersionSelect: HTMLSelectElement,
  selectedVersion : string
) : void {

  var projectVersionSelect = <HTMLSelectElement> querySelector('patcherProjectVersionId');

  if (projectVersionSelect) {
    return;
  }

  var projectVersionSelectFilter = <HTMLSelectElement | null> querySelector('patcherProjectVersionIdFilter');

  if (!projectVersionSelectFilter) {
    return;
  }

  projectVersionSelect = <HTMLSelectElement> projectVersionSelectFilter.cloneNode(true);

  pruneProjectVersionOptions(projectVersionSelect, selectedVersion);

  groupAndSortOptions(projectVersionSelect);

  var versionContainer = <HTMLElement> productVersionSelect.parentElement;
  versionContainer.appendChild(projectVersionSelect);

  addProjectVersionFilterInput(projectVersionSelect);

  var advancedSearchElement = <HTMLInputElement> document.getElementById('toggle_id_patcher_fix_searchadvancedSearch');

  var re = new RegExp(ns + 'patcherProjectVersionIdFilter=(\\d+)');
  var match = re.exec(document.location.search);

  if (match) {
    var patcherProjectVersionId = match[1];
    var option = <HTMLOptionElement | null> projectVersionSelect.querySelector('option[value="' + patcherProjectVersionId + '"]');

    if (option) {
      option.selected = true;
      advancedSearchElement.value = 'true';
    }
    else {
      var parameterString = ns + 'patcherProjectVersionIdFilter=' + patcherProjectVersionId + '&';
      document.location.search = document.location.search.replace(parameterString, '');
    }
  }

  var keywordsElement = <HTMLInputElement> document.getElementById('toggle_id_patcher_fix_searchkeywords');

  re = new RegExp(ns + 'patcherFixName=([^&]+)');
  match = re.exec(document.location.search);

  if (match) {
    keywordsElement.value = match[1];
  }

  projectVersionSelect.addEventListener('change', function() {
    document.location.href = 'https://patcher.liferay.com/group/guest/patching/-/osb_patcher?' +
      getQueryString({
        'advancedSearch': 'true',
        'andOperator': 'true',
        'hideOldFixVersions': 'true',
        'hideOldFixVersionsCheckbox': 'true',
        'statusFilter': '100',
        'patcherFixName': '',
        'patcherProductVersionId': productVersionSelect.options[productVersionSelect.selectedIndex].value,
        'patcherProjectVersionIdFilter': projectVersionSelect.options[projectVersionSelect.selectedIndex].value
      })
  });
}

/**
 * Converts the tag name into a seven digit version number that can be
 * used for sorting. First four digits are the base version (7010, 7110),
 * and the remander are the fix pack level.
 */

function getLiferayVersion(version: string) : number {
  if (version.trim() == '') {
    return 0;
  }
  else if (version.indexOf('marketplace-') != -1) {
    var pos = version.indexOf('-private');
    pos = version.lastIndexOf('-', pos == -1 ? version.length : pos - 1);
    var shortVersion = version.substring(pos + 1);
    return parseInt(shortVersion) * 1000;
  }
  else if (version.indexOf('fix-pack-de-') != -1) {
    var pos = version.indexOf('-', 12);
    var deVersion = version.substring(12, pos);
    var shortVersion = version.substring(pos + 1);
    pos = shortVersion.indexOf('-private');
    if (pos != -1) {
      shortVersion = shortVersion.substring(0, pos);
    }
    return parseInt(shortVersion) * 1000 + parseInt(deVersion);
  }
  else if (version.indexOf('fix-pack-dxp-') != -1) {
    var pos = version.indexOf('-', 13);
    var deVersion = version.substring(13, pos);
    var shortVersion = version.substring(pos + 1);
    pos = shortVersion.indexOf('-private');
    if (pos != -1) {
      shortVersion = shortVersion.substring(0, pos);
    }
    return parseInt(shortVersion) * 1000 + parseInt(deVersion);
  }
  else if (version.indexOf('fix-pack-base-') != -1) {
    var shortVersion = version.substring('fix-pack-base-'.length);
    var pos = shortVersion.indexOf('-private');
    if (pos != -1) {
      shortVersion = shortVersion.substring(0, pos);
    }
    pos = shortVersion.indexOf('-');
    if (pos == -1) {
      return parseInt(shortVersion) * 1000;
    }
    return parseInt(shortVersion.substring(0, pos)) * 1000 + parseInt(shortVersion.substring(pos + 3));
  }
  else if (version.indexOf('-ga1') != -1) {
    var shortVersionMatcher = <RegExpExecArray> /^([0-9]*)\.([0-9]*)\.([0-9]*)/.exec(version);
    var shortVersion = shortVersionMatcher[1] + shortVersionMatcher[2];
    return parseInt(shortVersion) * 100 * 1000 + parseInt(shortVersionMatcher[3]);
  }
  else if (version.indexOf('-u') != -1) {
    var shortVersionMatcher = <RegExpExecArray> /[0-9]*\.[0-9]\.[0-9]+/.exec(version);
    var shortVersion = shortVersionMatcher[0].replace(/\./g, '');
    var updateVersionMatcher = <RegExpExecArray> /-u([0-9]*)/.exec(version);
    var updateVersion = updateVersionMatcher[1];
    return parseInt(shortVersion) * 1000 + parseInt(updateVersion);
  }
  else if (version.indexOf('.q') != -1) {
    var shortVersionMatcher = <RegExpExecArray> /([0-9][0-9][0-9][0-9])\.q([0-9])\.([0-9]*)/.exec(version);
    var shortVersion = shortVersionMatcher[1] + shortVersionMatcher[2];
    var updateVersion = shortVersionMatcher[3];
    return 8000000 + parseInt(shortVersion) * 100 + parseInt(updateVersion);
  }
  else {
    console.log('unrecognized version pattern', version);
    return 0;
  }
}

/**
 * Comparison function that uses getLiferayVersion to compute versions,
 * and then sorts in alphabetical order for equivalent versions (thus,
 * we get private branches sorted after the equivalent public branch).
 */

function compareLiferayVersions(
  a : HTMLOptionElement,
  b : HTMLOptionElement
) : number {

  var aValue = getLiferayVersion((a.textContent || '').trim());
  var bValue = getLiferayVersion((b.textContent || '').trim());

  if (aValue != bValue) {
    return aValue - bValue;
  }

  return a > b ? 1 : a < b ? -1 : 0;
}

/**
 * Formats a 4-digit version suffix (e.g. "7010") to its semantic version
 * counterpart (e.g. "7.0.10").
 */

function formatSuffixVersion(suffix: string) : string {
  var first = parseInt(suffix.charAt(0));
  var second = parseInt(suffix.charAt(1));
  var lastTwo = parseInt(suffix.substring(2));

  if ((first == 7) && (second <= 3)) {
    return first + '.' + second + '.10';
  }

  return first + '.' + second + '.' + lastTwo;
}

/**
 * Returns the corresponding option group label for a given version string.
 * Supports quarterly releases, 6.1, 6.2, 7.4.13, suffix-based fix packs,
 * and suffix-based marketplace releases.
 */

function getOptionGroup(optionText: string) : string | null {
  if (optionText === '') {
    return null;
  }

  // Quarterly Release
  var qMatcher = /([0-9]{4})\.q([0-9]+)/.exec(optionText);
  if (qMatcher) {
    return qMatcher[0];
  }

  // Marketplace
  if (optionText.indexOf('marketplace-') === 0) {
    var suffixMatcher = /-([0-9]{4})(?:-private)?$/.exec(optionText);
    if (suffixMatcher) {
      return formatSuffixVersion(suffixMatcher[1]) + ' Marketplace';
    }
    return 'Marketplace';
  }

  // Fix Pack
  if (optionText.indexOf('fix-pack-') === 0) {
    var suffixMatcher = /-([0-9]{4})(?:-private)?$/.exec(optionText);
    if (suffixMatcher) {
      return formatSuffixVersion(suffixMatcher[1]);
    }
    return 'Fix Pack';
  }

  // 6.x
  if (optionText.indexOf('6.1') === 0) {
    return '6.1';
  }

  if (optionText.indexOf('6.2') === 0) {
    return '6.2';
  }

  // 7.4
  if (optionText.indexOf('7.4') !== -1) {
    return '7.4.13';
  }

  return null;
}

/**
 * Groups and sorts select options under <optgroup> elements, sorting all
 * options/optgroups appropriately, and updating the select's DOM structure.
 */

function groupAndSortOptions(select: HTMLSelectElement): void {
  var options = Array.from(select.options);
  options.sort(compareLiferayVersions);

  select.innerHTML = '';

  var optgroupsMap: Record<string, HTMLOptGroupElement> = {};

  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    var optionText = (option.textContent || '').trim();
    var optionGroup = getOptionGroup(optionText);

    if (optionGroup) {
      var optgroup = optgroupsMap[optionGroup];
      if (!optgroup) {
        optgroup = document.createElement('optgroup');
        optgroup.setAttribute('label', optionGroup);
        optgroupsMap[optionGroup] = optgroup;
        select.appendChild(optgroup);
      }
      optgroup.appendChild(option);
    } else {
      select.appendChild(option);
    }
  }
}

/**
 * Returns whether every character of the pattern appears in the text in
 * the same order, though not necessarily contiguously (e.g. 'q413'
 * fuzzy-matches '7.4.13-q4'), the same style of matching used by fuzzy
 * finders like fzf or the VS Code quick open.
 */

function fuzzyMatch(
  text : string,
  pattern : string
) : boolean {

  if (pattern === '') {
    return true;
  }

  var textIndex = 0;

  for (var patternIndex = 0; patternIndex < pattern.length; patternIndex++) {
    textIndex = text.indexOf(pattern[patternIndex], textIndex);

    if (textIndex == -1) {
      return false;
    }

    textIndex++;
  }

  return true;
}

/**
 * Hides options in the project version select whose text doesn't match
 * the given filter text, so that a long list of project versions can be
 * narrowed down by typing instead of scrolling through the full list.
 * Since options are kept in ascending numeric order (see
 * updateProjectVersionOrder), the first matching option is the earliest
 * matching version, so it's automatically selected, whether that's the
 * first option overall (filter text is empty) or the first option that
 * matches what was typed. Options prefixed with 'test-' are skipped in
 * favor of a non-'test-' match, since they're not meant to be used by
 * default, but if 'test-' options are the only matches, one of them is
 * selected anyway rather than leaving nothing selected.
 * Updates are applied to optgroups first, falling back to option-level
 * matching only if no optgroups match.
 */

function filterProjectVersionSelect(
  projectVersionSelect: HTMLSelectElement,
  filterText: string
) : void {

  var normalizedFilterText = filterText.trim().toLowerCase();

  var optgroups = Array.from(projectVersionSelect.querySelectorAll('optgroup'));
  var matchingOptgroups = optgroups.filter(function(optgroup) {
    var label = (optgroup.getAttribute('label') || '').toLowerCase();
    return fuzzyMatch(label, normalizedFilterText);
  });

  var optgroupMatchMode = normalizedFilterText !== '' && matchingOptgroups.length > 0;

  var firstMatchingOption : HTMLOptionElement | null = null;
  var firstMatchingTestOption : HTMLOptionElement | null = null;

  if (optgroupMatchMode) {
    for (var i = 0; i < optgroups.length; i++) {
      var optgroup = optgroups[i];
      var matches = matchingOptgroups.indexOf(optgroup) != -1;
      optgroup.style.display = matches ? '' : 'none';
    }

    for (var i = 0; i < projectVersionSelect.options.length; i++) {
      var option = projectVersionSelect.options[i];
      var parentElement = option.parentElement;
      var isInMatchingOptgroup = parentElement && parentElement.tagName.toLowerCase() === 'optgroup' && matchingOptgroups.indexOf(<HTMLOptGroupElement>parentElement) != -1;

      if (isInMatchingOptgroup) {
        option.style.display = '';
        var optionText = (option.textContent || '').toLowerCase();
        if (!firstMatchingOption) {
          if (optionText.trim().indexOf('test-') != 0) {
            firstMatchingOption = option;
          }
          else if (!firstMatchingTestOption) {
            firstMatchingTestOption = option;
          }
        }
      } else {
        option.style.display = 'none';
      }
    }
  } else {
    for (var i = 0; i < projectVersionSelect.options.length; i++) {
      var option = projectVersionSelect.options[i];
      var optionText = (option.textContent || '').toLowerCase();
      var matches = fuzzyMatch(optionText, normalizedFilterText);

      option.style.display = matches ? '' : 'none';

      if (matches && !firstMatchingOption) {
        if (optionText.trim().indexOf('test-') != 0) {
          firstMatchingOption = option;
        }
        else if (!firstMatchingTestOption) {
          firstMatchingTestOption = option;
        }
      }
    }

    for (var i = 0; i < optgroups.length; i++) {
      var optgroup = optgroups[i];
      var hasVisibleOption = false;
      var childOptions = optgroup.getElementsByTagName('option');
      for (var j = 0; j < childOptions.length; j++) {
        if (childOptions[j].style.display !== 'none') {
          hasVisibleOption = true;
          break;
        }
      }
      optgroup.style.display = hasVisibleOption ? '' : 'none';
    }
  }

  var selectedOption = firstMatchingOption || firstMatchingTestOption;

  if (selectedOption) {
    selectedOption.selected = true;
  }
  else {
    projectVersionSelect.selectedIndex = -1;
  }
}

/**
 * Places the project versions in numeric order rather than alphabetical
 * order, to make it easier to find the latest baseline.
 */

function updateProjectVersionOrder() : void {
  var projectVersionSelect = <HTMLSelectElement | null> querySelector('patcherProjectVersionId');

  if (!projectVersionSelect) {
      return;
  }

  groupAndSortOptions(projectVersionSelect);

  var event = document.createEvent('HTMLEvents');
  event.initEvent('change', false, true);
  projectVersionSelect.dispatchEvent(event);
}

/**
 * Some pages have their own project version filter select (used to
 * filter the list of fixes/builds via advanced search) that isn't
 * created by addProjectVersionFilter, so it never gets sorted by
 * updateProjectVersionOrder, or given a text filter input. There can be
 * more than one element sharing this name, since addProjectVersionFilter
 * clones it without renaming the clone, so every matching select is
 * sorted and given a filter input here.
 */

function sortProjectVersionIdFilterSelects() : void {
  var elements = document.getElementsByName(ns + 'patcherProjectVersionIdFilter');

  for (var i = 0; i < elements.length; i++) {
    var select = <HTMLSelectElement> elements[i];
    
    groupAndSortOptions(select);

    addProjectVersionFilterInput(select);
  }
}

/**
 * Returns the option that should be auto-selected in the product version
 * select for the given Liferay version. Version 7.4 prefers the
 * 'Quarterly Releases' option over the first option tagged with
 * data-liferay-version="7.4" (typically 'DXP 7.4'), since fix packs for
 * 7.4 are now delivered as quarterly releases.
 */

function getDefaultProductVersionOption(
  productVersionSelect : HTMLSelectElement,
  liferayVersion : string
) : HTMLOptionElement | null {

  if (liferayVersion == '7.4') {
    var quarterlyReleasesOptions = Array.from(productVersionSelect.options).filter(function(option) {
      return (option.textContent || '').trim() == 'Quarterly Releases';
    });

    if (quarterlyReleasesOptions.length > 0) {
      return quarterlyReleasesOptions[0];
    }
  }

  return <HTMLOptionElement | null> productVersionSelect.querySelector('option[data-liferay-version="' + liferayVersion + '"]');
}

/**
 * Updates the product version select based on the value of the Liferay
 * version select.
 */

function updateProductVersionSelect() {
  var productVersionSelect = <HTMLSelectElement> querySelector('patcherProductVersionId');

  var liferayVersion = getSelectedValue('liferayVersion');
  productVersionSelect.setAttribute('data-liferay-version', liferayVersion);

  if (productVersionSelect.selectedIndex != -1) {
    var selectedOption = productVersionSelect.options[productVersionSelect.selectedIndex];
    var selectedOptionText = selectedOption.textContent || '';

    if (selectedOption.getAttribute('data-liferay-version') == liferayVersion) {
      var isDefaultOptionText = (liferayVersion == '7.4') ?
        (selectedOptionText.trim() == 'Quarterly Releases') :
        (selectedOptionText.trim() == 'DXP ' + liferayVersion);

      if (isDefaultOptionText) {
        setTimeout(updateProjectVersionOrder, 500);
      }

      return;
    }
  }

  var option = getDefaultProductVersionOption(productVersionSelect, liferayVersion);

  if (option) {
    option.selected = true;
    _1_WAR_osbpatcherportlet_productVersionOnChange(option.value);
    setTimeout(updateProjectVersionOrder, 500);
  }
}

/**
 * Selects anything that was specified in the query string.
 */

function updateFromQueryString() {
  var liferayVersionSelect = querySelector('liferayVersion');

  if (!liferayVersionSelect) {
    return;
  }

  var productVersionSelect = querySelector('patcherProductVersionId');

  if (productVersionSelect) {
    var re = new RegExp(ns + 'patcherProductVersionId=(\\d+)');
    var match = re.exec(document.location.search);

    if (match) {
      var patcherProductVersionId = match[1];
      var option = <HTMLOptionElement | null> productVersionSelect.querySelector('option[value="' + patcherProductVersionId + '"]');

      if (option) {
        var liferayVersion = option.getAttribute('data-liferay-version');

        option = <HTMLOptionElement | null> liferayVersionSelect.querySelector('option[value="' + liferayVersion + '"]');

        if (option) {
          option.selected = true;
          updateProductVersionSelect();
        }
      }
    }
  }

  var projectVersionSelect = querySelector('patcherProjectVersionId');

  if (projectVersionSelect) {
    re = new RegExp(ns + 'patcherProjectVersionId=(\\d+)');
    match = re.exec(document.location.search);

    if (match) {
      var patcherProjectVersionId = match[1];
      var option = <HTMLOptionElement | null> projectVersionSelect.querySelector('option[value="' + patcherProjectVersionId + '"]');

      if (option) {
        option.selected = true;
      }
      else {
        setTimeout(updateFromQueryString, 500);
      }
    }
  }

  var autoFixCheckbox = <HTMLInputElement | null> querySelector('autoFixCheckbox');

  for (var inputName of ['committish', 'gitRemoteURL']) {
    var input = <HTMLInputElement | null> querySelector(inputName);
    if (!input) {
      continue;
    }

    re = new RegExp(ns + inputName + '=([^&]+)');
    match = re.exec(document.location.search);

    if (!match) {
      continue;
    }

    if (autoFixCheckbox && autoFixCheckbox.checked) {
      autoFixCheckbox.click();
    }

    input.value = match[1];
  }
}