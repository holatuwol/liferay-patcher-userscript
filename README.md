## Patcher Read-Only Views Links

https://raw.githubusercontent.com/holatuwol/liferay-faster-deploy/master/userscripts/patcher.user.js

When working with existing fixes and builds, the script does the following:

* When viewing an existing fix or build, I often want to know when it was added/updated, to get a sense of whether it was added recently, but the dates are all in GMT, and I'm bad at daylight savings. So, the script changes the create dates and modified dates listed for fixes and builds to whatever your web browser thinks is your current time zone, instead of showing the date in GMT.

* When viewing an existing fix or build, I sometimes want to go directly to JIRA to know what the fixes were attempting to resolve (not always obvious from the commit history). Therefore, rather than a read-only input field giving you a list of fixes in plain text, the script replaces that with a hidden input field, but the UI shows you a bunch of links to JIRA instead of plain text ticket IDs.

* When viewing an existing build, I'm often looking at something that has both public and private fixes, and the git link is not very useful since it'll just contain one or the other, and you have to navigate to the "View Child Builds" button and click on each build to get more information. Therefore, this script presents that information immediately rather than ask you to navigate to each build separately.

* When viewing an existing build, I often want to navigate to a list of all of that customer's builds, often to see if there is a more up to date build with more fixes, or if the customer has moved to a new baseline. Therefore, the script replaces the plain text account code with a link to a list of all of the customer's builds.

* When viewing an existing build, the links to Jenkins take you to a page which gives you a summary of the build (how long it took, etc.), but usually I'm only clicking on the link to see why the build failed. To address that, this script updates the link so that it takes you to the console output (consoleText).

When adding new fixes and builds, the script does the following:

* When creating a new fix or build, the large number of options in that single product version drop down feels clunky. To address that, I've added a new drop down to choose from a much shorter list of Liferay versions, and auto-selects the "DXP 7.x" product version equivalent. Once this has been auto-selected, updates the sort order of the project versions (baselines) to be in numeric order (1, 2, 3), rather than alphabetical order (1, 10, 11, ..., 2, 20, 21, ..., 3) to make it easier to find the latest baseline.

* When creating a new build using the "Use as Build Template", Patcher doesn't automatically select the project version (only the product version), which can get disorienting since we have a large number of project versions. To make "Use as Build Template" more usable, the script updates the link so that the script knows how to auto-select the project version.

Some additional visual tweaks include the following:

* Since we've added the marketplace feature to patcher, all of the drop-down selects are way too small to show tag names and application names, so this script adds a style to remove the fixed width of 200 pixels on the product and project selects.

* Because I've needed to investigate UI bugs involving modal dialog windows, I don't like modal dialog windows that do more than show me a full-sized image, so the script replaces many of the modal dialog windows in patcher portal with regular pop up windows.