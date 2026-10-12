# Tonal: design notes

Built with the Apple Design Skill process (github.com/dickwu/apple-design-skill): establish context, plan tokens, critique against defaults, then build.

## Context
- Personal music player. Search YouTube, keep the audio as MP3, listen offline.
- Single job per screen: find a song, keep it, play it.
- Web app (React) with responsive layouts: sidebar on desktop, tab bar and mini player on phones.

## Tokens
| Role | Hex | Contrast on #0E0E10 |
| --- | --- | --- |
| Background | #0E0E10 | |
| Surface / Surface 2 | #17161A / #222127 | |
| Ink (primary text) | #F4F1EA | 17.1:1 |
| Ink 2 (secondary text) | #A8A39A | 7.7:1 |
| Accent (primary actions, now playing) | #F2B54A | 10.6:1 (text on accent #1A1204: 10.1:1) |
| Danger | #FF8A7A | 8.4:1 |
| Success | #8FD4A0 | 11.1:1 |

Tertiary grey #7C776F only reaches 4.05:1 on surfaces, so it is not used for text that carries meaning.

Type: the system UI stack (SF on Apple platforms) for everything. Display titles 26–34px bold with tight tracking. Times and counts use tabular numerals.

## Signature
The Now Playing backdrop takes its colour from the album art (weighted towards saturated pixels), darkened so white text keeps 4.5:1 or better. The content provides the colour; the chrome stays neutral. The accent is reserved for primary actions and the active track.

## Avoided defaults
No near-black plus acid-green accent, no cream plus serif plus terracotta, no hero number with a gradient label.

## Platform rules applied
- Five-item tab bar on phones, with labels; search gets a primary tab position.
- Controls at least 44px on phones; icon buttons have accessible names and keyboard shortcuts shown in `aria-keyshortcuts`.
- Dialogs: Escape closes, focus moves in and returns to the trigger; destructive actions confirm first with Cancel as the default.
- Reduced motion turns off transitions and the playing-state cover scale; reduced transparency is not needed because no blur is used.
- Downloads: progress is announced with `role="progressbar"`, and failures keep the reason plus a retry.

## Keyboard
Space play/pause · ←/→ seek 5 s · Shift+←/→ previous/next · ↑/↓ volume · M mute · S shuffle · R repeat · / search.
