# Shared-control baseline

Recorded from the current `app/app.vue`, `WorkspaceDrawer.vue`, `SettingsAccordionCard.vue`, and `AppToolbar.vue` before migration. These values are the appearance and placement to preserve at desktop and narrow widths.

| Element             | Desktop                                                                                                                                      | Narrow (below 900px)                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Workspace drawer    | Fixed on the right, 76px from top, 12px from right and bottom; one-third viewport width, bounded by viewport minus 24px                      | 12px from each side, 124px from top and 12px from bottom                   |
| Drawer header       | At least 58px high; back slot left, title and description center, actions and close button right                                             | Same order and button placement                                            |
| Drawer close button | 32px square ghost button, at the header right                                                                                                | Same size and position                                                     |
| Settings card       | Rounded panel; delete action at right, accordion trigger at left; navigation form has leading, title, summary, arrow, and right-side actions | Same order; content can shrink and truncate                                |
| Workspace toolbar   | 56px high, 12px from top/sides; 36px icon buttons in grouped navigation at right                                                             | 48px high, 8px from top/sides; navigation scrolls horizontally below 720px |

| Palette token    | Light     | Dark      |
| ---------------- | --------- | --------- |
| Background       | `#f5f6f8` | `#0d1117` |
| Surface          | `#ffffff` | `#161b22` |
| Raised surface   | `#f1f3f6` | `#1c232c` |
| Border           | `#dce0e6` | `#29313c` |
| Foreground       | `#151a21` | `#e6eaf0` |
| Muted foreground | `#5d6673` | `#8f9aa9` |
| Accent           | `#0a7898` | `#3cc4e6` |
| Danger           | `#c4282f` | `#ff7b7b` |

Shared controls use Nuxt UI button focus behavior. The close, delete, and toolbar buttons retain keyboard focusability and an accessible label. The drawer's explicit `update:open` event handles close and dismissal; the accordion emits toggle, expand, and collapse intents. Preserve these focus and event states while centralizing the theme.
