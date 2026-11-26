# CoachKtool

CoachKtool reads League Champion Select through the local League Client API and fills the matching fields on [Coach K's drafting page](https://coachkarakal.com/drafting). It runs on your computer. The League Client lockfile password stays in the local service and is never sent to the browser extension or Coach K.

## Download

Download the latest source from the public [CoachKtool GitHub repository](https://github.com/S0nna/coachKtool) using **Code → Download ZIP**. Extract the ZIP before continuing. The Firefox add-on is in `extension/`; the local companion service is started with `start.cmd`.

## What it fills

- Ally ADC, support, and jungle from League's assigned positions.
- Enemy ADC and support from role assignments when League exposes them.
- A best-effort enemy bot-lane estimate when roles are hidden. The estimate changes as picks arrive; for example, a likely support such as Soraka can replace Lux as the support guess.
- Blind pick while the enemy support is not visible; it clears when the support appears.

CoachKtool follows current Champion Select picks and hovers. It does not lock champions, ban, or otherwise control the game client.

## Install and start the local service

1. Install Node.js 20 or newer.
2. Double-click `start.cmd` and leave the window running during draft. It listens only on `127.0.0.1:32145`.
3. League of Legends and League Client must be running.

The health page is `http://127.0.0.1:32145/health`. If League is installed in a nonstandard location, set `LEAGUE_CLIENT_LOCKFILE` to the full path of its `lockfile` before starting the service.

## Build the Firefox add-on archive

The Firefox add-on is plain JavaScript and needs no compilation or third-party packages. The build script copies every file under `extension/` into a ZIP with `manifest.json` at the archive root; the files inside are byte-for-byte copies of the add-on source.

Build requirements:

- Windows 10/11, macOS, or Linux.
- Node.js 20 or newer. Install Node.js from [nodejs.org](https://nodejs.org/en/download/); use the Windows `.msi` installer, macOS `.pkg` installer, or the official Linux package/binary for your distribution. npm and other dependencies are not required for this build.

From the repository root, run:

```text
node scripts/build-firefox.mjs
```

The script creates `dist/CoachKtool-Firefox-<version>.zip`, using the version in `extension/manifest.json`. Upload that ZIP to Firefox Add-ons. To load the unarchived source locally, use Firefox 140 or newer and choose the manifest from `extension/` at `about:debugging#/runtime/this-firefox` using **Load Temporary Add-on**.

## Install the browser extension

Choose the matching folder or upload archive:

- Firefox: `extension/` or `CoachKtool-Firefox-1.0.2.zip`.
- Chrome: `extension-chrome/` or `CoachKtool-Chrome-1.0.2.zip`.

For local development, Firefox 140 or newer: load the Firefox manifest from `about:debugging#/runtime/this-firefox` using **Load Temporary Add-on**. In Chrome, open `chrome://extensions`, enable Developer mode, and use **Load unpacked** with `extension-chrome/`.

Open or refresh `https://coachkarakal.com/drafting`. Click the CoachKtool badge once to connect to the local service. Chrome may ask to allow access to your local network; approve that browser prompt. After connection, picks sync in the background while the page is open. Click the badge again to retry if the local service was not running when you connected.

Firefox temporary add-ons must be loaded again after closing Firefox. The Firefox upload archive is built by the script above and contains `manifest.json` at its root. Chrome's local-use folder is `extension-chrome/`; no Chrome Web Store submission is planned.

## Troubleshooting

- **No connection:** start CoachKtool with `start.cmd`, then click the badge on the drafting page.
- **League Client not found:** start League Client. For a nonstandard installation, set `LEAGUE_CLIENT_LOCKFILE` to the full lockfile path.
- **A champion field needs checking:** Coach K may have changed the page controls or champion label. Champion names come from Riot Data Dragon's English champion catalog.
- **No pick in a role:** League has not assigned or exposed that pick yet; CoachKtool leaves the field empty rather than inventing a pick.

See `PRIVACY.md` for data handling and `STORE_LISTING.md` for Firefox listing and reviewer notes. This project is released under the Unlicense; see `UNLICENSE`.

