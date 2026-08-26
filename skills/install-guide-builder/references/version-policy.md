# Version policy

## The rule

Write install steps only for versions that are **current** or **one major release behind**.
Those are the versions whose installer screens, default settings, file layouts and error
messages can be described accurately.

For anything **two or more major releases behind current**, do not write steps from
memory. Installer wording changes, defaults flip, download pages move, and a
confidently-wrong instruction costs the reader more time than no instruction at all.

## What to do instead

Give the reader four things, briefly:

1. **Name the version and say plainly that it is old enough that the steps have drifted.**
   Not an apology. A fact about how the ecosystem works.
2. **Link to that version's own documentation or archived downloads.** The table below has
   the stable URLs.
3. **One line on what breaks going forward**, if you know it. "Node 16 predates the fetch
   API being built in" is worth more than three paragraphs of hedging.
4. **Offer current-version steps alongside.** Version pins are often softer than stated,
   inherited from a README nobody has revisited. Make the alternative visible without
   arguing.

Suggested shape:

> **Looking for PHP 8.1?** That's several majors behind current, and the Windows build
> layout and `php.ini` defaults have changed enough since then that steps written for
> today would send you wrong. Use the official archive at
> `windows.php.net/downloads/releases/archives/` and the 8.1 branch of the PHP manual. The
> main thing to know going forward: 8.1 is past end of security support, so it should not
> face the internet. If the pin is a project constraint rather than a hard one, the current
> steps in this guide will work.

## "Two majors" means different things per tool

Cadence varies. Judge against these, not against a fixed number of years.

| Tool | Major cadence | Two majors back is roughly | Archive |
|---|---|---|---|
| Node.js | Every 6 months, LTS every 12 | 1 year | `nodejs.org/en/download/releases` |
| Python | Annual, each October | 2 years | `python.org/downloads` (all versions), `docs.python.org/<ver>/` |
| PHP | Annual, each November | 2 years | `windows.php.net/downloads/releases/archives/`, `php.net/manual/` |
| Go | Every 6 months | 1 year | `go.dev/dl/` |
| Rust | Every 6 weeks; majors effectively never | Use editions instead | `forge.rust-lang.org` |
| Java | Every 6 months, LTS every 2 years | Judge against LTS releases, not all releases | `adoptium.net/temurin/archive/` |
| PostgreSQL | Annual | 2 years | `postgresql.org/docs/` |
| Docker Desktop | Continuous | Not versioned this way; just use current | `docs.docker.com` |

For tools with LTS lines (Node, Java, Ubuntu), compare against **LTS releases** rather
than all releases. A reader asking for Node 20 when 24 is current is asking for the
previous LTS, which is entirely reasonable and gets full steps.

## End-of-life is a separate question

A version can be recent enough to document and still be unsupported. When a requested
version is past end of security support, say so in one line and move on. Do not refuse to
document it and do not lecture; the reader may be maintaining something they did not
choose. One sentence, then help.

`endoflife.date` carries current EOL dates for most of these tools and is worth checking
when a guide pins anything older than current.

## Always verify before writing

The catalog hardcodes no version numbers because they go stale. Before writing steps,
fetch the current stable release for every selected tool from its official source. Then
state in your handoff which versions you verified and when, so a reader six months later
knows how much to trust it.

Where a number will drift within the guide's useful life, write the pattern rather than
the number: `php-8.5.x-nts-Win32-vs17-x64.zip` rather than a specific patch release, plus
a line saying any patch number is fine.
