# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Email the maintainers directly (if available) or open a private security advisory via GitHub's Security tab.
3. Include a description of the vulnerability, steps to reproduce, and potential impact.
4. You will receive a response within 48 hours.

## Security Measures

This project implements:

- **Docker hardening**: `--security-opt no-new-privileges:true`, `--cap-drop ALL`, `--read-only` filesystem
- **CSP headers**: Configured in `nginx.conf` (script-src, style-src, connect-src restrictions)
- **K8s NetworkPolicy**: Ingress/egress restrictions in `k8s/`
- **Read-only filesystem**: Container runs with tmpfs for writable dirs
- **No secrets in code**: Environment variables via `.env.example`

## Server-Side Validation

The multiplayer server (`server/server.js`) includes:
- Rate limiting per IP
- Input validation (speed hack, fire rate, aimbot detection)
- Anti-cheat heuristics (HS rate, K/D ratio tracking)
- See `server/netcode.js` for the full anti-cheat suite
