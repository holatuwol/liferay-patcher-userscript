// Run all the changes we need to the page.

var applyPatcherCustomizations = function() {
  highlightAnalysisNeededBuilds();

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

  compareBuildFixes();

  if (document.location.pathname.indexOf('/-/osb_patcher/fixes/create') != -1) {
    setTimeout(updateFromQueryString, 500);
  }
};

if (exportFunction) {
  applyPatcherCustomizations = exportFunction(applyPatcherCustomizations, window);
}

AUI().ready(applyPatcherCustomizations);