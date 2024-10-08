var styleElement = document.createElement('style');

styleElement.textContent = `
a.included-in-baseline,
a.included-in-baseline:hover {
  color: #ddd;
  text-decoration: line-through;
}

.nowrap {
  white-space: nowrap;
}

#_1_WAR_osbpatcherportlet_patcherProductVersionId,
#_1_WAR_osbpatcherportlet_patcherProjectVersionId {
  width: auto;
}

#_1_WAR_osbpatcherportlet_patcherProductVersionId option {
  display: none;
}

#_1_WAR_osbpatcherportlet_patcherProductVersionId[data-liferay-version="6.x"] option[data-liferay-version="6.x"],
#_1_WAR_osbpatcherportlet_patcherProductVersionId[data-liferay-version="7.0"] option[data-liferay-version="7.0"],
#_1_WAR_osbpatcherportlet_patcherProductVersionId[data-liferay-version="7.1"] option[data-liferay-version="7.1"],
#_1_WAR_osbpatcherportlet_patcherProductVersionId[data-liferay-version="7.2"] option[data-liferay-version="7.2"],
#_1_WAR_osbpatcherportlet_patcherProductVersionId[data-liferay-version="7.3"] option[data-liferay-version="7.3"],
#_1_WAR_osbpatcherportlet_patcherProductVersionId[data-liferay-version="7.4"] option[data-liferay-version="7.4"] {
  display: block;
}

textarea[inputcssclass="osb-patcher-input-wide"] {
  height: 3em;
  width: 60em;
}

p[inputcssclass="osb-patcher-input-wide"] {
  display: inline-block;
  padding: 4px 6px;
  margin-right: 5px;
  width: 60em;
}

#_1_WAR_osbpatcherportlet_patcherBuildName {
  height: 5em;
}

.control-group.field-wrapper .table,
.control-group.input-select-wrapper .table,
.control-group.input-String-wrapper .table,
.control-group.input-text-wrapper .table {
  margin-bottom: 0.5em;
}

#security-fixes .show-details,
#ticket-suggestions .show-details {
  background-color: #fff;
  font-size: x-small;
  line-height: 0.5em;
  text-align: right;
}

.compact .verbose,
.verbose .compact {
  display: none !important;
}

th.branch-type,
th.branch-type a {
  font-weight: bold;
  width: 5em;
}

.control-group.field-wrapper,
.control-group.input-select-wrapper,
.control-group.input-String-wrapper,
.control-group.input-text-wrapper {
  display: flex;
  margin-bottom: 0.1em;
}

.control-group .control-group.field-wrapper,
.control-group .control-group.input-select-wrapper,
.control-group .control-group.input-String-wrapper,
.control-group .control-group.input-text-wrapper,
.popover .control-group.field-wrapper,
.popover .control-group.input-select-wrapper,
.popover .control-group.input-String-wrapper,
.popover .control-group.input-text-wrapper {
  display: block;
}

#toggle_id_patcher_fix_searchadvancedBodyNode .control-group.field-wrapper,
#toggle_id_patcher_fix_searchadvancedBodyNode .control-group.input-select-wrapper,
#toggle_id_patcher_fix_searchadvancedBodyNode .control-group.input-String-wrapper,
#toggle_id_patcher_fix_searchadvancedBodyNode .control-group.input-text-wrapper {
  display: block;
}

a[href*="https://grow.liferay.com/"] {
  padding-left: 0.5em;
}

a[href*="https://test-5-2.liferay.com/"] {
  padding-right: 0.5em;
}

a[href*="http://files.liferay.com/"],
a[href*="https://files.liferay.com/"] {
  font-size: x-large;
}

.control-group.field-wrapper .control-label,
.control-group.input-select-wrapper .control-label,
.control-group.input-String-wrapper .control-label,
.control-group.input-text-wrapper .control-label {
  font-weight: bold;
  min-width: 20em;
  width: 20em;
}

#security-fixes dl {
  margin-block-start: 0em;
  margin-block-end: 0em;
  margin-bottom: 0px;
}

/**
 * http://vrl.cs.brown.edu/color
 * 4 colors, lightness between 25 and 85, add alpha of 0.3
 */

tr.qa-analysis-needed.version-6210 td {
  background-color: rgba(79,140,157,0.3) !important;
}

tr.qa-analysis-needed.version-7010 td {
  background-color: rgba(75,214,253,0.3) !important;
}

tr.qa-analysis-needed.version-7110 td {
  background-color: rgba(101,52,102,0.3) !important;
}

tr.qa-analysis-needed.version-7210 td {
  background-color: rgba(131,236,102,0.3) !important;
}

tr.qa-analysis-unneeded {
  opacity: 0.3;
}

.shortened-content {
  margin: 0.5em !important;
}

.shortened-content .fix-item::before {
  content: ', ';
}

.shortened-content .fix-item a {
  white-space: nowrap;
}
`;

document.head.appendChild(styleElement);