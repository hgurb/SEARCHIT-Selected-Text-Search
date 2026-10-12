# SEARCHIT Selected Text Search

Search selected text on your favorite websites using the right-click menu or an optional quick popup.

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/searchit-right-click-sear/hdpcbfjagjalpalmfngcganeepfmjajm)

## Install manually

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** at the top right.
3. Choose **Load unpacked** and select the extracted extension folder.
4. Click the extension's toolbar icon (under the puzzle-piece button) to open settings.

## Use

Select text, right-click, and choose **Search selected text → [site]**. Open the extension settings to add, edit, reorder, or remove websites, then click **Save changes**. IMDb, Reddit, and YouTube are included by default.

To add a website, copy its search results URL and replace the search term with `#SEARCHIT#` (case-insensitive):

`https://www.imdb.com/find/?q=#SEARCHIT#`

Enable **Quick popup** and grant website access to show clickable site icons beside selected text. Customize its theme, position, icons per row, and per-site labels. Set icons per row to `0` for unlimited.

Check **Incognito** for a site to open its searches in a private window. Enable **Allow in Incognito** in Chrome's extension settings to reuse existing private windows.

## Import and export

Use **Export & copy** to copy your website list. Paste it into another instance and click **Import & save**. Import replaces the existing list. Global popup preferences and the settings theme are not included.

## Privacy

Settings are stored locally. No analytics or tracking. Selected text is sent to the chosen website only when you launch a search. See [PRIVACY.md](PRIVACY.md).

Version **1.1.1**. Licensed under [MIT](LICENSE).
