# SEARCHIT Selected Text Search

Search selected text on your favorite websites using the right-click menu or an optional quick popup.

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/searchit-right-click-sear/hdpcbfjagjalpalmfngcganeepfmjajm)

## Install manually

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** at the top right.
3. Choose **Load unpacked** and select the extracted extension folder.
4. Click the extension's toolbar icon (under the puzzle-piece button) to open settings.

## Use

Select text, right-click, and choose **Search selected text → [site]**. Open the extension settings to add, edit, reorder, or remove websites, then click **Save**. IMDb, Reddit, and YouTube are included by default.

To add a website, copy its search results URL and replace the search term with `#SEARCHIT#` (case-insensitive):

`https://www.imdb.com/find/?q=#SEARCHIT#`

A one-time welcome page introduces Quick popup after installation or an update if it is off. Choose **Enable quick popup** to grant website access and turn it on, or **Not now** to keep your current choice. Existing enabled popups stay enabled. You can also enable **Quick popup** in settings and grant website access to show clickable site icons beside selected text. Customize its theme, position, icons per row, and per-site labels. Maximum icons per row is a limit: icons balance evenly across the fewest rows that fit the limit and screen width. Set it to `0` for an unlimited single row. **Show a » button for more search options** is on by default, including for existing installations, and reveals other enabled sites on demand. You can turn it off in settings. Your quick-popup sites stay first, followed by the remaining sites in their saved order. Each new popup starts collapsed. A settings cog at the end of the expanded popup opens settings and counts as one icon toward the row limit. This preference is included when exporting Quick popup settings.

Choose **Use a different icon** beneath a search link to use another website’s icon. Custom favicon sources are included in import and export.

Under **New tab behavior**, choose whether regular searches open at the end of the tab list (default), immediately to the right or left of the source tab, or at the beginning of the list. Pinned tabs remain first.

Check **New window** to open a site’s searches in separate regular windows. Under **Search window behavior**, choose a new window for every search, reuse by source tab or full configured search link, or reuse by source window. Searches from the same browser window share one destination, while searches from that destination get a separate window of their own. Reused windows open each search in a new tab. New window and Incognito cannot be selected together. Both choices are included in import and export.

Check **Incognito** for a site to open its searches in a private window. Enable **Allow in Incognito** in Chrome's extension settings to reuse existing private windows.

## Import and export

Choose which sections to include, then use **Export & copy**. Only **Search options** is selected by default; Quick popup, New tab behavior, and New window behavior can also be included. **Import & review** loads only the included sections, leaving others unchanged. Click **Save** to apply them or **Discard** to restore your saved settings. Older website-list exports still work. The settings-page theme and Chrome permissions are not transferred.

## Privacy

Settings are stored locally. No analytics or tracking. Selected text is sent to the chosen website only when you launch a search. See [PRIVACY.md](PRIVACY.md).

Version **1.3.0**. Licensed under [MIT](LICENSE).
