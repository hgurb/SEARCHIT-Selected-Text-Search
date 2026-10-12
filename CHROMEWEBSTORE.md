# Chrome Web Store Listing — SEARCHIT Selected Text Search

Last updated: 2026-10-12

## Store Listing

**Extension name:** SEARCHIT Selected Text Search

**Short description:** Search selected text on your own editable list of websites.

**Detailed description:**

Search selected text on your favorite websites from the right-click menu or an optional quick popup.

Add, edit, reorder, enable, or remove search websites. IMDb, Reddit, and YouTube are included by default. Choose Incognito searches per website. Export and import your website list to move it between SEARCHIT installations.

Enable the quick popup to show website icons beside selected text. Customize its appearance, position, icons per row, and short site labels.

To add a site, copy its search results link and replace the search term with #SEARCHIT#. Save your changes, select text on a webpage, and choose a search destination.

Preferences are stored locally. No developer analytics or tracking are included. Selected text is sent to the chosen website only when you launch a search. The optional popup requests website access when enabled.

Source and support: https://github.com/hgurb/SEARCHIT-Selected-Text-Search

**Suggested category:** Search Tools; confirm in Developer Dashboard.

**Single purpose:** Search user-selected text on user-configured websites.

**Primary language:** English.

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---|---|---|
| Extension icon | 16 × 16 PNG | Dimensions verified | icons/icon16.png |
| Extension icon | 48 × 48 PNG | Dimensions verified | icons/icon48.png |
| Store icon | 128 × 128 PNG | Dimensions verified | icons/icon128.png |
| Store screenshots | 1280 × 800 or 640 × 400 | Existing image assets not reviewed in this audit | Confirm before next submission |

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| contextMenus | permissions | Adds search destinations to the right-click menu for selected text. |
| storage | permissions | Saves the user's search websites, order, per-site choices, and quick-popup settings locally. |
| favicon | permissions | Displays website icons in settings and the optional quick popup using Chrome's favicon service. |
| scripting | permissions | Registers and injects the packaged quick-popup scripts on webpages after the user enables the feature and grants website access. |
| http://*/* and https://*/* | optional_host_permissions | Lets the user enable the selection popup on ordinary websites. Broad optional access supports text selection across arbitrary sites; the right-click menu works without this grant. |

The manifest exposes only `_favicon/*` to HTTP/HTTPS pages so the injected popup can display Chrome-provided website icons. No remote executable code is included.

## Privacy & Data Use

The developer receives no selected text, search configuration, or browsing analytics.

Selected webpage text is read locally to display the optional popup. It is included in the destination search URL only after the user chooses a search action. Destination websites receive that query under their own privacy policies.

Search options and popup preferences use chrome.storage.local. The settings-page theme uses localStorage. Exports contain the configured site list and are copied to the clipboard at the user's request. There are no analytics or tracking scripts in the reviewed source.

Dashboard data disclosures should reflect local processing and user-directed searches; confirm the actual submitted answers before publishing.

- Data is not sold by the developer.
- Data is used only for the extension's selected-text search functionality.
- Data is not used for creditworthiness or lending purposes.

## Privacy Policy

Repository policy: PRIVACY.md.

Public privacy-policy URL currently configured in the Developer Dashboard: not verified in this source audit. Confirm it is accessible and matches the current behavior before submission.

## Distribution

Existing store link: https://chromewebstore.google.com/detail/searchit-right-click-sear/hdpcbfjagjalpalmfngcganeepfmjajm

Visibility, regions, and live release version: not verified in this source audit.

## Developer Info

Source owner: hgurb (from README and settings attribution).

Publisher name and contact email: confirm existing Developer Dashboard values.

Support URL: https://github.com/hgurb/SEARCHIT-Selected-Text-Search/issues

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.1.1 working source | 2026-10-12 | Source audit; hardened quick-popup configuration failure handling. | Local changes; no release uploaded |

## Review Notes

Manifest V3; minimum Chrome version 123. Existing tests cover search encoding, menu lifecycle, Incognito routing, labels, popup registration, positioning, and import/export. A regression test checks that failed popup configuration responses do not throw on subsequent selection events.

This audit did not perform live Chrome interaction, screen-reader testing, or a Developer Dashboard review. Packaged ZIPs were not regenerated. Exclude development tests, scripts, backups, repository metadata, and this file from release packages.
