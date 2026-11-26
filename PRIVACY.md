# Privacy

Last updated: 2026-11-25

CoachKtool is a local companion for League of Legends Champion Select and the Coach K drafting page.

## Data the tool reads

The local service reads League Client gameflow and Champion Select data through the League Client API on the same computer. It uses the League Client lockfile password to authenticate to that local API. The password remains in the local service process and is not sent to CoachKtool's browser extension, Coach K, or a CoachKtool-operated server.

The service returns the current draft information to the CoachKtool extension through `127.0.0.1` on the same computer. The extension uses that information to populate fields on `https://coachkarakal.com/drafting`. The tool does not intentionally save draft details or transmit them to a CoachKtool server. Coach K's website may process information according to its own privacy practices.

The local service downloads champion names and tags from Riot Data Dragon when needed, and caches that catalog in memory for up to twelve hours. Draft picks and the League Client lockfile password are not included in that request.

## Permissions and network access

The extensions run on the Coach K drafting page. They request draft data from the local service only after the user clicks the CoachKtool badge. Chrome may display a local network access prompt for this connection. The extension does not contact a CoachKtool-operated remote service.

The local service binds only to `127.0.0.1`. It does not expose an internet-facing listener. It is read-only toward League: it does not lock champions, ban, or send game commands.

## Contact and changes

The public privacy policy is https://dndtracker.giize.com/privacy_policy_coachk_companion. For privacy questions or support, contact mc2cuber@gmail.com or @.sonna. on Discord. Update this document if data handling changes.



