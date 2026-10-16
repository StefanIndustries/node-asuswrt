# Guest Wi-Fi development

Run `npm test` to build the library and run the mocked router protocol tests.
Pull requests and releases run these tests in CI. Test cases cover payloads,
cross-radio serialization through enable/disable restarts, stale countdowns,
transient failures, cancellation, malformed readback, and verification deadlines.
The mock preserves countdown selectors for disabled interfaces and models service
completion independently via `rc_service`. Regression cases also cover accepted
applies with lost responses and reconciliation before writing after a failed verification.

## Firmware completion signal

Classic firmware clears `rc_service` after processing the requested services:
[service handler](https://github.com/RMerl/asuswrt-merlin.ng/blob/f94f6ff8ad96f7366847103e13e69bbd2e651165/release/src/router/rc/services.c#L19047-L19049).
Guest countdown selectors are only cleared for enabled guest interfaces:
[guest initialization](https://github.com/RMerl/asuswrt-merlin.ng/blob/f94f6ff8ad96f7366847103e13e69bbd2e651165/release/src/router/rc/lan.c#L5046-L5066).
Verification therefore requires idle service status for both enables and disables,
but only enables require idle countdown selectors and countdown-refresh evidence.

## Recorded hardware verification

These checks predate the verification refactor. The refactor has automated
coverage and has not been retested on hardware.

Tested on a single **RT-AX88U**, stock firmware **3.0.0.4.388_24385**, through
Homey Pro (Early 2023), Homey **13.5.1**:

| Behaviour | Result |
| --- | --- |
| Discover configured 2.4 GHz and 5 GHz networks with the same SSID | Confirmed; returned distinct radio/slot IDs |
| Disable an enabled 2.4 GHz guest network | Confirmed by state readback and the router's web interface |
| Enable the 2.4 GHz network with a duration | Confirmed with 120- and 240-second settings |
| Router-managed automatic expiry | Confirmed for the 120-second setting |
| Restart a countdown while already enabled | Confirmed: a 240-second countdown read 150 seconds before repeating the action and 210 seconds immediately afterward |

The firmware reports remaining time in **30-second steps**, including steps
consumed during/shortly after applying a change. The short-duration checks did
not establish exact wall-clock timing, so do not treat access duration as a
precision timer. Repeating the action refreshes the router countdown; it does
not promise exactly that many seconds from the moment a Flow was started.

Unlimited enabling, switching the 5 GHz network, maximum-duration behaviour,
router reboots, RF/client connectivity, and password/intranet-isolation
preservation have not been separately verified on hardware. Payload tests
check that security and intranet-access fields are not written. These methods
have not been tested on AiMesh or other models/firmware.
