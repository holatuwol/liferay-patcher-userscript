// Run all the changes we need to the page.

var applyPatcherCustomizations = function() {
  replaceJenkinsLinks();
  replacePopupWindowLinks();
  addBaselineToBuildTemplate();
  replaceHotfixLink('debug');
  replaceHotfixLink('official');
  replaceHotfixLink('sourceZip');
  replaceBranchName();
  replaceFixes();
  replaceBuild();
  replaceLesaLink('lesaTicket');
  replaceLesaLink('supportTicket');
  replaceDate('createDate');
  replaceDate('modifiedDate');
  addProductVersionFilter();
  highlightAnalysisNeededBuilds();
  showMissingSecurityFixes();

  setTimeout(updateFromQueryString, 500);
};

if (exportFunction) {
  applyPatcherCustomizations = exportFunction(applyPatcherCustomizations, window);
}

AUI().ready(applyPatcherCustomizations);