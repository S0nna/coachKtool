# Firefox AMO listing draft

## Product name
CoachKtool Draft Sync

## Summary
Sync League Champion Select picks to Coach K's drafting page from your computer.

## Description
CoachKtool syncs your live League of Legends Champion Select with [Coach K's drafting page](https://coachkarakal.com/drafting). It fills ally and enemy picks, estimates enemy roles when they are hidden, and marks blind pick while the enemy support is unknown.

**To use it, download the companion script from [the public CoachKtool GitHub repository](https://github.com/S0nna/coachKtool)** (select **Code → Download ZIP**). Extract it, install Node.js 20 or newer, and run `start.cmd`. Then install the Firefox add-on, open the drafting page, and click the CoachKtool badge. League Client must be running for live draft sync. CoachKtool runs locally and does not lock champions, ban, or control League Client.

Firefox 140 or newer displays its built-in website-content data disclosure at installation because the add-on reads and fills the draft fields.

## Permissions and data declaration

- **Website access:** the content script runs only on `coachkarakal.com/drafting` and reads/fills the page's champion fields.
- **Firefox data declaration:** required `websiteContent`, because the add-on reads page fields and uses the current draft snapshot to populate them.
- **Local draft bridge:** current draft data is read from the companion at `127.0.0.1:32145`; CoachKtool has no remote draft-storage service or analytics.
- **Extension permissions:** the Firefox manifest requests no additional browser API permissions or persistent site access.

## Privacy policy

https://dndtracker.giize.com/privacy_policy_coachk_companion

## Support contact

mc2cuber@gmail.com or @.sonna. on Discord.

## AMO reviewer instructions

1. Use Firefox 140 or newer. The separate local helper requires Node.js 20 or newer.
2. Download the companion helper source from [https://github.com/S0nna/coachKtool](https://github.com/S0nna/coachKtool) (**Code → Download ZIP**), extract it, and run `start.cmd` on a computer with League Client running.
3. Open `https://coachkarakal.com/drafting` and click the CoachKtool badge to connect the add-on to the helper at `127.0.0.1:32145`.
4. Enter or begin Champion Select; the page fields update as picks become available. The helper reads the League Client's local API and sends the draft snapshot only to the browser add-on on the same computer.

The source repository README documents the Firefox archive build command, operating systems, Node.js version, and installation source. The add-on is plain JavaScript; the build script packages the source files without modifying them.

The helper listens only on `127.0.0.1`. A reviewer without League Client cannot validate live synchronization. The helper is distributed separately from the Firefox add-on in the public GitHub repository above.

## Still needed from the publisher

- Sign in to the Mozilla Add-ons developer account and submit the Firefox ZIP.
- Choose the AMO category for the listing. The source repository uses the Unlicense.

The Firefox ZIP is packaged but has not been submitted or published. Chrome's build remains available for local use; no Chrome Web Store submission is planned.
