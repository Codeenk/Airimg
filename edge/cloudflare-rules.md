# Cloudflare Transform + Cache Rules (Non-Worker Alternative)

> **This is the documented fallback-simplicity option.**
> If you want zero Worker involvement and don't need auto-heal, you can use
> plain Cloudflare Transform Rules + Cache Rules instead.
>
> ⚠️ This does NOT provide self-healing (no circuit breaker, no Path B fallback,
> no health monitoring). Use the Worker-based approach (default) for production.

## Transform Rule

**When**: URI path matches `/i/*`

**Rewrite to**: `https://drive.google.com/uc?export=view&id={extracted_file_id}`

## Cache Rule

**When**: URI path matches `/i/*`

**Cache eligibility**: Eligible for cache
**Edge TTL**: Override — 365 days
**Browser TTL**: Override — 365 days
**Cache Key**: Custom — include full URI path

## Limitations

- No automatic fallback when Google's `uc?export=view` breaks
- No circuit breaker or self-healing
- No health monitoring or alerting
- No FILE_ID validation (security concern)
- No stale-cache serving on failure

## When to Use This Instead

- You have very low traffic and don't care about occasional downtime
- You want the absolute simplest setup possible
- You're willing to manually fix things when Google's hotlink endpoint breaks
