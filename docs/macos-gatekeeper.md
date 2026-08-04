# macOS blocks Folio as malware

> **TL;DR** — If macOS suddenly refuses to launch Folio and calls it malware, Apple has
> almost certainly **revoked the notarization of the Electron runtime** Folio bundles. It is
> not Folio's code, and it is not your machine. The fix is to upgrade to a currently
> supported Electron release and rebuild.

---

## Symptoms

- macOS shows an alert along the lines of *"Folio will damage your computer"* /
  *"malware was detected"*, with **Move to Trash** as the pushy default button.
- The app quits instantly on launch, or never draws a window.
- `/Applications/Folio.app` and/or `release/mac-arm64/Folio.app` **vanish on their own** —
  macOS deletes them as part of XProtect remediation. This is expected, not a second bug.
- `npm start` is broken too, because the dev runtime under
  `node_modules/electron/dist/Electron.app` is the very same revoked binary.
- It worked fine yesterday. Nothing in the repo changed.

That last point is the giveaway: **the trigger is a background XProtect update from Apple,
not anything you did.**

---

## Confirming the diagnosis

Run Gatekeeper's own assessment against the app:

```bash
spctl -a -vvv /Applications/Folio.app
```

The verdict that identifies this problem is:

```
/Applications/Folio.app: notarization indicates this code has been revoked
```

The word **`revoked`** is what matters. Don't confuse it with these two, which are *normal*
for an unsigned local build and are **not** this issue:

| Output | Meaning |
| --- | --- |
| `notarization indicates this code has been revoked` | **This issue.** Apple blacklisted the binary. |
| `rejected` | Ordinary unsigned / ad-hoc app. Approve it via *Open Anyway*. |
| `code has no resources but signature indicates they must be present` | Benign ad-hoc Electron quirk. Harmless. |

Now prove it's Electron and not Folio, by testing the untouched runtime in `node_modules`:

```bash
spctl -a -vvv node_modules/electron/dist/Electron.app
```

If that *also* reports `revoked`, the packaged app is innocent — the bundled Electron is the
blacklisted component.

For the authoritative record, read what the security daemon logged:

```bash
log show --last 1d --predicate 'subsystem == "com.apple.syspolicy"' --style compact \
  | grep -i -E "folio|malware|revok"
```

A real occurrence looks like this:

```
syspolicyd: Sent CloudTelemetry event: MalwareDiscovered2
syspolicyd: Evaluating blocked code: PST: (team: (null)), (id: Electron), (bundle_id: com.dpokluda.folio)
kernel: (AppleSystemPolicy) ASP: Security policy would not allow process: /Applications/Folio.app/Contents/MacOS/Folio
```

Note `(id: Electron)` and `(team: (null))` — macOS is blocking the **Electron** code
identity, and there is no signing team because the build is ad-hoc signed.

---

## Why this happens

Folio ships an unsigned / **ad-hoc signed** build. There's no Apple Developer ID
certificate involved, so the app has no signing team of its own and inherits the code
identity of the Electron binary it embeds.

Electron releases are notarized by the Electron project. Malware authors like to hide
payloads inside legitimate Electron app shells. When a campaign abuses a specific Electron
build widely enough, **Apple revokes the notarization ticket for that exact build**. The
revocation is keyed to the binary's `cdhash`, so it lands on *every* app embedding that
build — worldwide, retroactively, with no warning.

Two conditions have to coincide:

1. Folio bundles an **outdated or EOL** Electron release, and
2. Apple pushes an XProtect update revoking that release.

Because the revocation is retroactive, an app that launched perfectly for months can be
killed by an overnight background update.

**The structural lesson:** an EOL Electron version is never un-revoked. Once blacklisted, it
stays blacklisted forever. Staying on a supported release line is the only durable defense.

---

## The fix, step by step

Electron supports only the **latest three major versions**. Anything older receives no
security patches and is a candidate for exactly this kind of revocation.

### 1. Purge the revoked runtime *and its cache*

```bash
cd /path/to/folio
rm -rf node_modules/electron
rm -rf ~/Library/Caches/electron
```

Do not skip the cache. `~/Library/Caches/electron` holds the downloaded
`electron-v<version>-darwin-arm64.zip`, and the installer will happily reuse the poisoned
archive if you leave it there — you'd reinstall the identical revoked binary.

### 2. Upgrade Electron (and electron-builder)

Check what's current, then install it:

```bash
npm view electron dist-tags.latest
npm install --save-dev electron@^<latest> electron-builder@^<latest>
```

Bump `electron-builder` alongside Electron. Old builder versions don't understand newer
Electron layouts and carry stale macOS signing logic.

Mind the Node requirement — recent Electron needs **Node >= 22.12.0** to build:

```bash
node --version
```

### 3. Verify the new runtime is clean *before* building

```bash
spctl -a -vvv node_modules/electron/dist/Electron.app
```

Anything other than `revoked` means you're good. `code has no resources...` is the expected,
benign result.

### 4. Smoke-test in dev mode

```bash
npm start
```

Much faster feedback than a full package. If a window opens, the runtime swap succeeded.

### 5. Rebuild the installer

```bash
npm run dist:mac
```

### 6. Install and clear the quarantine flag

```bash
open release/Folio-<version>-arm64.dmg
# drag Folio to Applications in the Finder window, then:
xattr -dr com.apple.quarantine /Applications/Folio.app
spctl -a -vvv /Applications/Folio.app
```

### 7. Approve the app on first launch

Because the build is ad-hoc signed, macOS still treats it as coming from an unidentified
developer. Either:

- right-click the app → **Open** → confirm, or
- **System Settings → Privacy & Security** → scroll to the Folio notice → **Open Anyway**.

Once per machine, not once per launch.

---

## Emergency workaround (temporary)

If you must run the existing build *right now* and can't rebuild, re-signing changes the
`cdhash`, which sidesteps the hash-keyed revocation:

```bash
codesign --force --deep --sign - /Applications/Folio.app
xattr -dr com.apple.quarantine /Applications/Folio.app
spctl -a -vvv /Applications/Folio.app
```

The verdict should drop from `revoked` to plain `rejected` — approve it via *Open Anyway*.

**Treat this as a stopgap only.** It is undone by any rebuild, reinstall, or re-copy of the
app, and it leaves you running an Electron release with known-unpatched security holes.
Do the real upgrade.

---

## Preventing a recurrence

- **Track a supported Electron line.** Only the newest three majors get security fixes.
  Upgrading once or twice a year is far cheaper than an emergency at the worst moment.
- **Sign and notarize properly.** With an Apple Developer ID certificate, Folio gets its own
  code identity and its own notarization ticket instead of borrowing Electron's. Add
  `hardenedRuntime`, entitlements, and `notarize` to the `mac` block in `package.json`;
  `electron-builder` handles the rest. This also retires the *"unidentified developer"*
  prompt for good.
- **Re-check after a long gap.** Before shipping a build that's been sitting for months,
  run `spctl -a -vvv` on it first.
- **Recognize the signature quickly.** Sudden malware alert + app deletes itself + nothing
  changed in the repo = revoked runtime. Go straight to `spctl`.

---

## Incident log

| Date | Electron | Detail |
| --- | --- | --- |
| 2026-07-28 | 31.7.7 → 43.2.0 | XProtect (v5352) revoked Electron **31.7.7**, EOL at the time. macOS deleted `/Applications/Folio.app` and `release/mac-arm64/Folio.app`, and blocked `npm start` as well. Resolved by upgrading to Electron **43.2.0** + electron-builder **26.15.3** and rebuilding. |
