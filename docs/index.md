Hindsight adds a tab that shows the key metrics of your [Hindsight](https://hindsight.vectorize.io) agent memory: whether the service is healthy, how many memories, observations, documents and links a bank holds, and how the consolidation and background operation queues are doing.

## Turn it on

1. Install Hindsight from the Plugins tab.
2. An admin opens Settings, then Hindsight, and sets:
   - **Hindsight URL**: the base address of the Hindsight API, for example `https://hindsight.example.com:8888`. It must be reachable from the Termix server, not from your browser. Private and tailnet addresses are allowed for this one host only.
   - **API key**: the bearer key Hindsight expects. It is stored encrypted and never sent to the browser. Leave it empty if Hindsight has no authentication.
   - **Default bank**: the memory bank shown first.
3. Open the Hindsight tab from the sidebar.

## Use it

The tab refreshes every 30 seconds while it is open. Pick another bank from the list at the top right to look at it instead.

- **Service**: health, round trip time and API version.
- **Memories, Observations, Documents, Links**: size of the bank.
- **Awaiting / Failed consolidation**: memories waiting to be consolidated into observations, and ones that failed for good.
- **Pending / Failed operations**: background jobs in the queue. A red number means something needs attention.
- **Breakdowns**: memories by type, links by type and operations by status.

Using the tab needs the View Hindsight metrics permission, which admins and users get by default. Every request goes through the Termix server, so users never see the Hindsight address or key.

## iOS and other mobile devices

Install plugin version 0.2.0 or later on your server. In the Termix mobile app
2.0.0 or later, link that server and open **Settings > Plugins**. Hindsight
should show **Web view** and can be opened there or under **From your server**
on Home or Tools. Phones and tablets use the same metrics screen as the web app.

The app needs plugin API 1.13 or later within the 1.x line; if it asks for an
update, update the app before opening Hindsight. The screen uses the app's
authenticated connection to the Termix server, not a direct connection to
Hindsight. Configure the Hindsight URL and key on the server as described above.

To verify on a device, open the view, switch banks, tap **Refresh**, and check
that the controls fit without horizontal scrolling. Turn the plugin off on the
server and refresh the app's plugin list to confirm the view is unavailable;
enable it again and refresh to restore it.

## What it calls

Only the URL an admin entered, and only read endpoints: `GET /health`, `GET /version`, `GET /v1/default/banks` and `GET /v1/default/banks/{bank}/stats`. Nothing is written to Hindsight and nothing is sent anywhere else.

## Deployment smoke test

The connection must work from inside the Termix container. A successful request
from your laptop does not establish server connectivity. In particular,
Tailscale userspace networking does not give Docker tailnet DNS or routing.
If you use that networking mode, arrange a server-side route or a narrowly
scoped TCP relay to the Hindsight service. Preserve the configured HTTPS hostname
and certificate verification, and restrict relay access to the Termix container.
Do not work around connectivity failures by disabling TLS checks or exposing
Hindsight to an untrusted network.

1. Build before validating a fresh checkout, then run `npm run pack`.
2. Enable **Plugin developer mode** under **Settings > General** and use
   **Plugins > Install from file** to install the package.
3. Configure the URL and default bank. Enter the key directly in the secret
   setting, never in source, shell arguments or a committed file.
4. Open Hindsight. Confirm **Healthy**, the API version and bank metrics.
5. Switch between two of your banks. Check the cards and breakdowns change
   and **Refresh** loads the selected bank.
6. Leave the tab visible and confirm a metrics request roughly every 30 seconds.
   Switch to Settings and confirm polling stops; return and confirm it resumes.
7. Reload Termix and confirm the default bank loads with the saved settings.
   The metrics response must contain no API key or configured service address.
8. Turn developer mode off again when finished.

Verified against Termix 26.11.1 and Hindsight API 0.10.2 with two banks.
