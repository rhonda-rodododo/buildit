# Tor Integration Setup Guide

BuildIt Network supports Tor for enhanced privacy and censorship resistance. This guide explains how to use BuildIt with Tor.

## What is Tor?

Tor (The Onion Router) is a network that provides:
- **Anonymity**: Hides your IP address from relays and other users
- **Censorship Resistance**: Access services even when blocked by ISPs or governments
- **Metadata Protection**: Prevents tracking of who you communicate with

## Quick Start

### Option 1: Tor Browser (Recommended)

The easiest way to use BuildIt with Tor is through Tor Browser:

1. **Download Tor Browser**
   - Visit: https://www.torproject.org/download/
   - Available for Windows, macOS, Linux, Android

2. **Open BuildIt in Tor Browser**
   - Launch Tor Browser
   - Navigate to BuildIt Network
   - BuildIt will automatically detect Tor Browser and enable .onion relay connections

3. **Verify Tor Connection**
   - Go to Settings → Security → Tor tab
   - You should see "Tor Active" with connected .onion relays

That's it! BuildIt will automatically use .onion Nostr relays for all connections.

### Option 2: Manual Tor Daemon

For advanced users who want Tor on desktop browsers (Chrome, Firefox, etc.):

1. **Install Tor**
   ```bash
   # macOS (Homebrew)
   brew install tor

   # Ubuntu/Debian
   sudo apt install tor

   # Arch Linux
   sudo pacman -S tor

   # Windows
   # Download Tor Expert Bundle from torproject.org
   ```

2. **Start Tor Daemon**
   ```bash
   # macOS/Linux
   tor

   # Or as a service
   sudo systemctl start tor  # Linux
   brew services start tor   # macOS

   # Windows
   # Run tor.exe from Tor Expert Bundle
   ```

3. **Verify Tor is Running**
   ```bash
   # Test SOCKS5 proxy (default port 9050)
   curl --socks5-hostname localhost:9050 https://check.torproject.org
   ```

4. **Configure BuildIt**
   - Go to Settings → Security → Tor tab
   - Set Connection Method to "Manual SOCKS5 Proxy"
   - Host: `127.0.0.1`
   - Port: `9050` (standard Tor) or `9150` (Tor Browser)
   - Click "Enable Tor Routing"

**Note**: Web browsers cannot use SOCKS5 proxies directly. BuildIt will detect .onion support but cannot route through SOCKS5 from JavaScript. For full SOCKS5 proxy support, use Tor Browser or a browser extension.

## Tor Settings

### Connection Methods

- **Auto-detect (Recommended)**: Automatically detects Tor Browser
- **Tor Browser**: Manually select when using Tor Browser
- **Manual SOCKS5 Proxy**: For custom Tor daemon configuration

### Onion Relay Configuration

- **Onion Only Mode**: Use only .onion relays (no clearnet fallback)
- **Fallback to Clearnet**: Use clearnet relays if .onion unavailable
- **Custom Relays**: Add your own trusted .onion Nostr relays

### Enhanced Security Features

When Tor is enabled, additional protections are available:

- **Block WebRTC**: Prevents WebRTC from leaking your real IP (requires browser extension)
- **Block Geolocation**: Deny all geolocation API requests
- **Fingerprinting Protection**: Enhanced protection against browser fingerprinting

## Known .onion Nostr Relays

BuildIt includes 11 known .onion Nostr relays:

- oxtrdevav64z64yb7x6rjg4ntzqjhedm5b5zjqulugknhzr46ny2qbad.onion
- skzzn6cimfdv5e2phjc4yr5v7ikbxtn5f7dkwn5c7v47tduzlbosqmqd.onion
- 2jsnlhfnelig5acq6iacydmzdbdmg7xwunm4xl6qwbvzacw4lwrjmlyd.onion
- nostrland2gdw7g3y77ctftovvil76vquipymo7tsctlxpiwknevzfid.onion
- bitcoinr6de5lkvx4tpwdmzrdfdpla5sya2afwpcabjup2xpi5dulbad.onion
- westbtcebhgi4ilxxziefho6bqu5lqwa5ncfjefnfebbhx2cwqx5knyd.onion
- sovbitm2enxfr5ot6qscwy5ermdffbqscy66wirkbsigvcshumyzbbqd.onion
- sovbitgz5uqyh7jwcsudq4sspxlj4kbnurvd3xarkkx2use3k6rlibqd.onion
- nostrwinemdptvqukjttinajfeedhf46hfd5bz2aj2q5uwp7zros3nad.onion
- wineinboxkayswlofkugkjwhoyi744qvlzdxlmdvwe7cei2xxy4gc6ad.onion
- winefiltermhqixxzmnzxhrmaufpnfq3rmjcl6ei45iy4aidrngpsyid.onion

Source: https://github.com/0xtrr/onion-service-nostr-relays

You can add your own trusted .onion relays in Settings → Security → Tor → Add Custom Relay.

## Security Best Practices

### Do's ✅

- **Use Tor Browser** for the best privacy and security
- **Verify .onion addresses** before adding custom relays
- **Enable "Onion Only Mode"** for maximum anonymity
- **Keep Tor Browser updated** to the latest version
- **Use strong passphrases** for your BuildIt identity
- **Enable WebAuthn** for additional key protection

### Don'ts ❌

- **Don't disable JavaScript** - BuildIt requires JavaScript to function
- **Don't use browser plugins/extensions** in Tor Browser (except those included)
- **Don't maximize Tor Browser window** - Use standard sizes to prevent fingerprinting
- **Don't log in to personal accounts** while using Tor (creates correlation)
- **Don't share your .onion relay list publicly** if you're using private relays

## Privacy Considerations

### What Tor Protects

- ✅ Your IP address (hidden from relays and users)
- ✅ Your geographic location
- ✅ Network-level surveillance (ISP can't see what you're doing)
- ✅ Relay-level tracking (relays can't see who you are)

### What Tor Doesn't Protect

- ❌ Your Nostr identity (public key)
- ❌ Message metadata (timestamps, message sizes)
- ❌ Browser fingerprinting (use Tor Browser to mitigate)
- ❌ Correlation attacks (if you use the same identity on Tor and clearnet)

### Tor + BuildIt = Strong Privacy

BuildIt combines Tor with end-to-end encryption (NIP-17/44) for defense-in-depth:

1. **Tor** hides your IP and location from relays
2. **NIP-17 encryption** hides message content from relays
3. **Nostr protocol** is decentralized (no single point of failure)
4. **WebAuthn** protects your keys on your device

## Troubleshooting

### "Tor Active" but no .onion relay connections

- **Check Tor Browser**: Make sure you're actually using Tor Browser, not regular Firefox
- **Check relay health**: Click "Health Check" in Tor settings to test .onion relays
- **Try fallback mode**: Disable "Onion Only Mode" to allow clearnet fallback

### "Tor Error" or "Connection failed"

- **Verify Tor is running**: For manual mode, ensure Tor daemon is running (`tor` command)
- **Check SOCKS5 port**: Default is 9050 (Tor) or 9150 (Tor Browser)
- **Firewall**: Make sure port 9050/9150 is not blocked
- **Tor logs**: Check Tor logs for connection errors

### Slow .onion relay connections

- **Latency is normal**: .onion connections have higher latency than clearnet (3-hop circuit)
- **Try different relays**: Some .onion relays may be slow or overloaded
- **Enable fallback**: Use clearnet relays as backup for faster connections

### WebRTC leak warnings

- **Tor Browser**: WebRTC is disabled by default, no action needed
- **Other browsers**: Install a WebRTC blocker extension:
  - Chrome: WebRTC Network Limiter or WebRTC Control
  - Firefox: Disable `media.peerconnection.enabled` in about:config

## Advanced Topics

### Running Your Own .onion Relay

To maximize privacy, you can run your own .onion Nostr relay:

1. Set up a Nostr relay (e.g., nostr-rs-relay, strfry)
2. Configure Tor hidden service
3. Add your .onion address to BuildIt settings

See: https://github.com/nostr-protocol/nostr for relay implementations

### Multi-hop Tor Circuits

Tor uses 3-hop circuits by default (entry → middle → exit). This is sufficient for most use cases. For extreme anonymity needs, consider:

- Using Tor bridges (if Tor is blocked in your country)
- Using Tails OS (amnesic live OS with Tor)
- Combining Tor with VPN (use VPN before Tor, not after)

### Combining Tor with BLE Mesh

BuildIt also supports BLE mesh networking for offline communication. You can use both:

- **Tor**: For long-distance, anonymous communication
- **BLE Mesh**: For local, offline, device-to-device communication

This provides defense-in-depth against both network surveillance and internet shutdowns.

## Resources

- **Tor Project**: https://www.torproject.org
- **Tor Browser Manual**: https://tb-manual.torproject.org
- **Nostr Protocol**: https://github.com/nostr-protocol/nostr
- **Onion Nostr Relays**: https://github.com/0xtrr/onion-service-nostr-relays
- **Privacy Guides**: https://www.privacyguides.org/en/tor/

## Support

If you encounter issues with Tor integration:

1. Check this guide for troubleshooting steps
2. Review security warnings in Settings → Security → Tor
3. Join BuildIt community for support
4. Report bugs on GitHub

Remember: **Using Tor is not illegal**. It's a legitimate tool for privacy and censorship resistance used by journalists, activists, and privacy-conscious individuals worldwide.
