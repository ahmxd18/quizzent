# Quizzent frontend foundations

## Colour direction

There is no objectively best palette. These were the three directions considered for Quizzent:

| Direction | Strength | Trade-off |
| --- | --- | --- |
| Plum + citron + ivory | Distinctive, playful accents with a composed reading surface | Citron needs dark text and restrained use |
| Terracotta + sage + cream | Warm and approachable | Feels quieter than the competition direction we want |
| Forest + apricot + sand | Strong contrast and a polished feel | Can suggest an outdoors or wellness identity |

The selected direction is **plum + citron + ivory**. This is an aesthetic choice supported by contrast checks, not a claim that colours guarantee a particular emotional response. The purple/yellow-green hue contrast adds energy; differences in lightness give controls a clear hierarchy. Most of the screen stays neutral, with plum for primary actions and citron for small highlights.

| Token | Value | Use |
| --- | --- | --- |
| `brand` | `#5B2B64` | Primary actions, brand accents |
| `accent` | `#D9EC91` | Selected preview answers and highlights, always with dark text |
| `canvas` | `#FAF8F2` | Page background |
| `surface` | `#FFFEFB` | Cards and controls |
| `foreground` | `#302832` | Main text |
| `muted` | `#6D626C` | Supporting text |
| `control` | `#958497` | Input/secondary button boundaries |
| `outline` | `#E1D9E1` | Decorative card separators, not the sole boundary of a control |
| `focus` | `#7E4185` | Visible keyboard outline |

Calculated WCAG contrast ratios: on-brand text on plum **10.55:1**, foreground on citron **11.09:1**, muted on surface **5.76:1**, muted on canvas **5.47:1**, control border on surface **3.46:1**, and focus on canvas **6.63:1**. These specific pairings meet their relevant text/non-text thresholds; they do not certify the entire application. Disabled controls are visibly unavailable. Never communicate an error, selection, or status through colour alone.

All raw colour values live in `src/styles/tokens.css`. Components use semantic Tailwind utilities such as `bg-brand`, `text-muted`, and `border-control`. The default colour palette is cleared to discourage accidental blue or hard-coded colour usage. Hover and semantic status colours also have named tokens.

System fonts avoid a font download: a readable sans-serif for UI and a serif accent for display headlines. Focus outlines and reduced-motion preferences are shared base styles.

## Folder boundaries

```text
src/
  app/                         Providers, route composition, application shell
  components/
    ui/                        Generic Button, TextField, Card, Badge
    layout/                    Generic layout primitives
  features/
    home/
      components/              Homepage-specific sections and sample question
      pages/                   Homepage composition
    join/
      components/              Guest room-entry UI
      pages/                   Join route
    auth/
      components/              Organiser account UI
      pages/                   Organiser account routes
  styles/                      Tokens and shared base styles
  lib/                         Small shared infrastructure
```

Use one plural `features` directory, with each feature's own `components` folder. Generic components must not import features or know about competitions, guest identity, or API calls. Feature components may compose generic components. Route composition belongs in `app`, not inside the shared button/input code.

Atomic here means small, composable pieces. We do not add separate atom/molecule/organism directories or a general component framework.

## Component conventions

- `Button` is for actions. Its default type is `button`, avoiding accidental form submission. Use `type="submit"` explicitly for forms.
- `ButtonLink` is for navigation and renders a real link. Both share the same visual variants.
- `TextField` combines a native input with its label, hint/error association, and invalid state. Native input props are preserved.
- `Card`, `Badge`, and `PageContainer` handle reusable visual/layout roles without feature logic.
- React's `ComponentProps` reuses native element props instead of recreating them. Variant unions restrict style choices to supported names.
- Prefer direct imports. Avoid barrels, polymorphic component APIs, global state, and abstractions before there is a need.
- Enable TypeScript strict checking. Keep comments focused on decisions rather than narrating JSX.

Routing uses React Router's declarative mode; a larger framework is unnecessary for the current client application. The first join/account screens are clearly marked previews until the relevant backend features exist.

Sources: [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [React Router declarative mode](https://reactrouter.com/start/modes).
