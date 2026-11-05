# Patcher Read-Only Views Links

* **Script Install**: https://raw.githubusercontent.com/holatuwol/liferay-faster-deploy/master/userscripts/patcher.user.js
* **Source**: https://github.com/holatuwol/liferay-patcher-userscript

A browser user script for [patcher.liferay.com](https://patcher.liferay.com) that provides inline search panels, build and fix comparison tools, Jira and GitHub integrations, bulk search capabilities, and user interface modifications.

---

## Features

### Viewing Existing Fixes and Builds

* **Local Timezone Dates**: Converts GMT/UTC create, modified, and status dates to the browser's local timezone.
* **Jira Ticket Links**: Replaces plain text fix ticket IDs (LPE, LPS, LPD, etc.) with links to Jira tickets, sorted numerically.
* **LESA & Zendesk Links**: Replaces read-only customer and support ticket IDs with links to Jira.
* **Inline Child Builds & Git Hash Links**:
  * For legacy 7.x builds with public and private child builds, displays those builds inline on build detail pages without navigating to "View Child Builds".
  * Generates direct GitHub compare links (`liferay-portal-ee/compare/<baseTag>...fix-pack-fix-<patcherFixId>`) for each child build tag, indicating the active build tag.
  * Formats excluded fixes from the original build with strikethrough styling (`included-in-baseline`).
* **Quarterly Release Patch Verification**: For quarterly release baselines (`.q`), adds a link to Jira to search whether fixes are included in newer patch levels of the quarterly release.
* **GitHub Repository & Compare Links**:
  * Replaces the read-only branch name (`committish`) with a GitHub compare link against the baseline tag.
  * Replaces the git remote URL with a link to the GitHub repository.
  * Links the read-only project version to the corresponding tag tree on GitHub (`liferay-portal-ee/tree/<tag>`).
* **Engineer Comments**: Fetches and displays "Engineer Comments" from the build's comments edit page directly on the build view page.
* **Hotfix Download Filenames**: Replaces generic "Download" labels for hotfix, debug, ignore, official, and sourceZip links with the target filename.
* **Direct Jenkins Console Links**:
  * Updates Jenkins fixpack-builder links to navigate directly to raw console output (`/consoleText`), or live console output (`/console`) if the build status is "Compiling".
  * Rewrites hotfix builder links to point directly to build artifacts.
  * Replaces internal `//test-5-2/` links with `//test-5-2.liferay.com/`.
* **Fix Comparison Across Builds**: Modifies the "View Fixes" button on a build to compare fixes against the previous build (`?compareTo=`). The comparison table displays current vs. previous fix versions, visually de-emphasizes unchanged versions, and lists fixes removed since the previous build.
* **Collapsible Ticket Suggestions**: Groups build ticket suggestions into a summary table with "(show details)" and "(hide details)" toggles.

---

### Creating New Fixes and Builds

* **High-Level Liferay Version Filter**: Adds a dropdown on create pages to choose from broad Liferay versions (`6.x`, `7.0`, `7.1`, `7.2`, `7.3`, `7.4`, `Quarterly`). Selecting a version automatically selects the corresponding product version (e.g., "Quarterly Releases" or "DXP 7.x") and filters out unrelated product options.
* **Searchable Project Version Input**: Replaces project version `<select>` dropdowns with a text input backed by an HTML5 `<datalist>` autocomplete element that dynamically filters options as you type. Focusing the input clears the field to display initial options, and selecting an option updates the underlying form.
* **Numeric Sorting & Optgroups**: Groups project versions into `<optgroup>` categories (Quarterly, Fix Pack versions, Marketplace, 6.1/6.2, 7.4.13) and sorts them numerically rather than alphabetically (e.g., 2026.q1.10 is treated as newer than 2026.q1.9).
* **Query String & Template Auto-Population**:
  * Automatically unchecks the "Auto Fix" checkbox when custom branch or remote URL parameters are specified, and populates product version, project version, committish, and git remote URL from query parameters (supporting "Use as Build Template") for people using the `patcher` shell script from the `holatuwol/liferay-faster-deploy` repository
* **Previous Builds Ticket Suggestions (`/builds/create`)**:
  * Fetches previous builds for the specified account and project version.
  * Detects fixes included in previous builds that are missing from the current draft.
  * Lists missing tickets with links and their prior hotfix/build numbers.
  * Provides a "+" button to append missing tickets into the build name input.
  * Prompts for confirmation before submitting if tickets from previous builds are missing.

---

### Account Builds View (`/accounts/view`)

* **Build Content Comparison**: Adds a "Content (comparison)" selector to the builds table header to diff each build's fixes against:
  * The closest parent build containing a subset of the fixes on the same project version ("most similar build"), or
  * Any specific build baseline selected from the dropdown.
* **Diff Highlighting**: Highlights newly added fixes and displays missing or omitted fixes with strikethrough styling (`included-in-baseline`).

---

### Search & List Views

* **Inline Advanced Search Panel**:
  * Replaces the default search popover with an inline search panel on list pages (such as Fixes and Account Builds).
  * Positions primary search fields (Account, Fix/Build Name, Project Version, Status) directly on the page with a "Search" button.
  * Moves secondary options (Type, Match All/Any, Hide Old Fix Versions, etc.) into an expandable "More options" section.
  * Provides a toggle between Basic Search and Advanced Search while synchronizing search terms.
* **Clickable Column Filters**: In search result tables, converts values in the "Project Version" and "Product" columns into links that filter the list by that version or product.
* **Fixes Search Keyword Synchronization**: When a project version is selected, basic keyword searches are submitted as an advanced search by fix name.
* **URL & Query String Optimization**:
  * Intercepts GET form submissions to strip empty fields and default parameter values (e.g., `hideOldFixVersions=true`), keeping URLs within browser and server size limits.
  * Enforces `no-referrer` and `referrerpolicy="no-referrer"` on GET forms and pagination links to prevent HTTP 431 ("Request Header Fields Too Large") errors caused by long referrer URLs.

---

### Bulk Search Tab (Fixes List)

Adds a **Bulk Search** tab to the Fixes page:
* **Multi-Ticket Lookup**: Search for multiple Jira tickets (LPD, LPE, LPS, LPSA, COMMERCE, LSV) or CVE / PRISMA IDs separated by commas or newlines.
* **CVE Synonym Resolution**: Translates CVE and PRISMA vulnerability identifiers into corresponding LPE tickets using an external security issue dataset.
* **Baseline Availability**: Queries Patcher to list all project version baselines that contain fixes for the provided tickets, with direct links to search results.
* **Jira Security & Release Status (Optional)**:
  * Evaluates tickets against a selected quarterly release baseline prefix (e.g. `2024.q1`) and specific target version.
  * Queries the Jira API to determine whether each ticket is Fixed or Not Fixed in the baseline, displaying the target fix version and whether it was fixed in a future release.
  * Resolves vulnerability severity (`sev-1`, `sev-2`, `sev-3`) based on linked LSV tickets, Jira labels, and issue priority.

---

### QA Builds & General UI Tweaks

* **Color-Coded QA Builds**: Color-codes rows in the "QA Builds" tab based on Liferay version (6210, 7010, 7110, 7210) and sets pagination to 200 items (`delta=200`).
* **QA Analysis Sorting**: Highlights builds requiring "QA Analysis" and dims and reorders unneeded builds to the bottom of the table.
* **Modal Dialogs to Browser Windows**: Replaces modal popup dialogs (`Liferay.Patcher.openWindow`) with standard browser tabs/windows (`window.open(..., '_blank')`).
* **Form & Table Styling**:
  * Removes fixed 200px width constraints on product and project version select menus.
  * Widens ticket input and suggestion textareas.
  * Formats form rows into two-column CSS grids to align labels and inputs without horizontal overflow.
