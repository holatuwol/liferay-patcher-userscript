// Run all the changes we need to the page.

var applyPatcherCustomizations = function() {
  highlightAnalysisNeededBuilds();

  if ((document.location.pathname.indexOf('/-/osb_patcher/fixes/create') != -1) ||
    (document.location.pathname.indexOf('/-/osb_patcher/builds/create') != -1)) {
    Liferay.on('projectVersionIdReady', updateFromQueryString);
  }

  var activeTab = document.querySelector('.tab.active');

  if (activeTab && ((activeTab.textContent || '').trim() != 'QA Builds')) {
    rearrangeColumns();
    replaceJenkinsLinks();
    replacePopupWindowLinks();
    addBaselineToBuildTemplate();
    replaceHotfixLink('debug');
    replaceHotfixLink('hotfix');
    replaceHotfixLink('ignore');
    replaceHotfixLink('official');
    replaceHotfixLink('sourceZip');
    replaceReadOnlySelect('type', null, null);
    replaceBranchName();
    replaceFixes();
    replaceBuild();
    replaceLesaLink('lesaTicket');
    replaceLesaLink('supportTicket');
    replaceDate('createDate');
    replaceDate('modifiedDate');
    replaceDate('statusDate');
    addProductVersionFilter();
    addSecurityFixesSection();
    addEngineerComments();
    updatePreviousBuildsContent();
  }

  // Runs after addProductVersionFilter, since on the create fix page
  // that function clones the same patcherProjectVersionIdFilter
  // template this sorts; sorting/filtering the template first would
  // leak its data-has-filter-input marker onto the clone via
  // cloneNode(true) and cause the visible clone to end up without a
  // filter input of its own.
  sortProjectVersionIdFilterSelects();

  compareBuildFixes();
};

if (exportFunction) {
  applyPatcherCustomizations = exportFunction(applyPatcherCustomizations, window);
}

AUI().ready(applyPatcherCustomizations);