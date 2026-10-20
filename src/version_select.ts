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

var liferayVersions = ['', '6.x', '7.0', '7.1', '7.2', '7.3', '7.4', 'Quarterly'];

/**
 * Determines the broad Liferay version (e.g. '7.4') that a product
 * version select option's text belongs to, based on the same text
 * patterns used to tag the options in addProductVersionFilter. The
 * 'Quarterly Releases' option has a broad version of its own, so that
 * 7.4 shows only the DXP 7.4 and Portal 7.4 options.
 */

function getProductVersionLiferayVersion(optionText : string) : string | null {
  if (optionText.trim() == 'Quarterly Releases') {
    return 'Quarterly';
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

  if ((liferayVersion == '7.4') || (liferayVersion == 'Quarterly')) {
    var versionString = (liferayVersion == '7.4') ? '7.4.13-' : '.q';

    for (var i = select.options.length - 1; i >= 0; i--) {
      var version = (select.options[i].textContent || '').trim();
      if ((version != '') && (version.indexOf(versionString) == -1)) {
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
    selectedVersion = 'Quarterly';
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

  var addCreateProjectVersionFilterInput = function () {
    var projectVersionSelect = <HTMLSelectElement | null> querySelector('patcherProjectVersionId');

    if (projectVersionSelect && !projectVersionSelect.disabled) {
      addProjectVersionFilterInput(projectVersionSelect);
    }
  };

  new MutationObserver(<MutationCallback> debounce(addCreateProjectVersionFilterInput, 100)).observe(document.body, {
    childList: true,
    subtree: true,
  });

  addCreateProjectVersionFilterInput();
}

var projectVersionInputCount = 0;
var projectVersionSelectsWithInput = new WeakSet<HTMLSelectElement>();

/**
 * Returns the texts of the project version options, from the newest
 * version to the oldest. A filter select keeps its option without a
 * value (for example 'All') at the start, so that the filter can be
 * removed.
 */

function getProjectVersionTexts(projectVersionSelect: HTMLSelectElement): string[] {
  var isFilter = projectVersionSelect.name == (ns + 'patcherProjectVersionIdFilter');
  var emptyValueTexts: string[] = [];
  var versionTexts: string[] = [];

  for (var i = 0; i < projectVersionSelect.options.length; i++) {
    var option = projectVersionSelect.options[i];
    var text = (option.textContent || '').trim();

    if (text == '') {
      continue;
    }

    if (option.value != '') {
      versionTexts.push(text);
    }
    else if (isFilter) {
      emptyValueTexts.push(text);
    }
  }

  return emptyValueTexts.concat(versionTexts.sort(function (a, b) {
    return b.localeCompare(a, 'en', {numeric: true});
  }));
}

/**
 * Returns true if the page or the query string selects a project version
 * in the given select of a create page. The page can mark the version
 * with the selected attribute, and the query string can name the version.
 * Use as Build Template (templatePatcherBuildId in the query string)
 * selects the version of the template without the selected attribute.
 */

function isProjectVersionPreselected(projectVersionSelect: HTMLSelectElement): boolean {
  if (new RegExp(ns + 'templatePatcherBuildId=\\d+').test(document.location.search)) {
    return true;
  }

  var match = new RegExp(ns + 'patcherProjectVersionId=(\\d+)').exec(document.location.search);

  return Array.from(projectVersionSelect.options).some(function (option) {
    return option.hasAttribute('selected') || (match && (option.value == match[1]));
  });
}

/**
 * Creates a text input with a list of choices. Typing in the input
 * filters the list. When the input text is equal to a choice, the input
 * calls onSelect with that text. When the input gets the focus, it is
 * cleared, so that the full list shows.
 */

function createVersionInput(placeholder: string, onSelect: (text: string) => void) {
  var dataList = document.createElement('datalist');
  dataList.id = ns + 'projectVersionList' + (++projectVersionInputCount);

  var input = document.createElement('input');
  input.setAttribute('list', dataList.id);
  input.style.minWidth = '16em';
  input.type = 'text';

  var selectedText = '';
  var texts: string[] = [];

  var selectText = function () {
    var text = input.value.trim();

    if ((text != selectedText) && (texts.indexOf(text) != -1)) {
      onSelect(text);
    }
  };

  input.addEventListener('blur', function () {
    if (!input.value.trim()) {
      input.value = selectedText;
    }
  });

  input.addEventListener('change', selectText);

  input.addEventListener('focus', function () {
    input.value = '';
  });

  input.addEventListener('input', function (event: any) {
    if (event.inputType != 'insertText') {
      selectText();
    }
  });

  return {
    dataList: dataList,
    input: input,
    insert: function (parentElement: HTMLElement, nextSibling: Node | null) {
      parentElement.insertBefore(input, nextSibling);
      parentElement.insertBefore(dataList, nextSibling);
    },
    setSelectedText: function (text: string) {
      selectedText = text;
      input.placeholder = text || placeholder;

      if (document.activeElement != input) {
        input.value = text;
      }
    },
    hasText: function (text: string) {
      return texts.indexOf(text) != -1;
    },
    setTexts: function (newTexts: string[]) {
      texts = newTexts;
      dataList.innerHTML = '';

      for (var i = 0; i < texts.length; i++) {
        var option = document.createElement('option');
        option.value = texts[i];
        dataList.appendChild(option);
      }
    }
  };
}

/**
 * Replaces a project version select with a text input that has a list of
 * the project versions. The select stays in the form but is hidden, and a
 * pick from the list selects the same version in the select. Called once
 * the portlet's own AJAX call populates the project version select of a
 * create page, and also for any other page's project version filter
 * select (see sortProjectVersionIdFilterSelects). A given select gets an
 * input only once, tracked in a WeakSet rather than by a fixed input id,
 * since there can be more than one such select on the same page. A
 * WeakSet and not an attribute, since the portlet can replace the select
 * with a copy of it, and the copy must get an input of its own. If the
 * portlet replaces the select, the input of the old select
 * is removed, and projectVersionIdReady does not fire again, so that
 * updateFromQueryString does not undo the choices of the user. A create
 * page select starts without a version, so that the user must pick one,
 * except when the page or the query string selects one (for example Use
 * as Build Template).
 */

function addProjectVersionFilterInput(projectVersionSelect: HTMLSelectElement): void {
  if (projectVersionSelectsWithInput.has(projectVersionSelect)) {
    return;
  }

  projectVersionSelectsWithInput.add(projectVersionSelect);

  var oldElements = Array.from((<HTMLElement> projectVersionSelect.parentElement).children).filter(function (element) {
    return element.classList.contains('project-version-input');
  });

  var isReplacement = oldElements.length > 0;

  for (var i = 0; i < oldElements.length; i++) {
    oldElements[i].remove();
  }

  var isFilter = projectVersionSelect.name == (ns + 'patcherProjectVersionIdFilter');
  var isPicked = false;

  var versionInput = createVersionInput('Select a project version', function (text) {
    var option = Array.from(projectVersionSelect.options).find(function (option) {
      return (option.textContent || '').trim() == text;
    })!;

    isPicked = true;
    projectVersionSelect.value = option.value;
    projectVersionSelect.dispatchEvent(new Event('change', {bubbles: true}));
  });

  var updateVersionInput = function () {
    versionInput.setTexts(getProjectVersionTexts(projectVersionSelect));

    if (!isFilter && !isPicked && !isProjectVersionPreselected(projectVersionSelect)) {
      projectVersionSelect.selectedIndex = -1;
      versionInput.setSelectedText('');
      return;
    }

    var selectedOption = projectVersionSelect.options[projectVersionSelect.selectedIndex];
    var selectedText = selectedOption ? (selectedOption.textContent || '').trim() : '';
    versionInput.setSelectedText(versionInput.hasText(selectedText) ? selectedText : '');
  };

  versionInput.dataList.classList.add('project-version-input');
  versionInput.input.classList.add('project-version-input');
  versionInput.input.required = !isFilter;

  projectVersionSelect.style.display = 'none';
  versionInput.insert(<HTMLElement> projectVersionSelect.parentElement, projectVersionSelect);

  projectVersionSelect.addEventListener('change', updateVersionInput);

  new MutationObserver(function () {
    isPicked = false;
    updateVersionInput();
  }).observe(projectVersionSelect, {
    childList: true,
    subtree: true,
  });

  updateVersionInput();

  if (!isReplacement) {
    Liferay.fire('projectVersionIdReady');
  }
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
 * select for the given Liferay version.
 */

function getDefaultProductVersionOption(
  productVersionSelect : HTMLSelectElement,
  liferayVersion : string
) : HTMLOptionElement | null {

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
      var isDefaultOptionText = (liferayVersion == 'Quarterly') ?
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
    unsafeWindow._1_WAR_osbpatcherportlet_productVersionOnChange(option.value);
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