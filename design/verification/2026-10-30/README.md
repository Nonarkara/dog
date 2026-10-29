# Illustrated game release verification

30 October 2026. Checked on this Mac with installed Chrome and native WebGL. Phone/tablet sizes are browser viewports, not physical-device certifications.

- TypeScript and production build pass; domain checks100/100.
- Existing Tamagotchi browser suite passes: four viewports, five dogs, deterministic catch, close cleanup, per-dog isolation, coat migration/persistence, zero page errors.
- Illustrated browser suite passes: four viewport fps/geometry, care actions, direct touch reaching trust state, persistent sleep, reduced-motion6fps, simulated visibility pause.
- Game-design suite passes: all five distinct light themes, actual rendered text/action/helper contrast, symbol labels and touch legend, sick/mess/medicine/cleanup states, no document overflow.
- Transition check passes: running-frame samples and video of rapid requests, latched active-step duration, non-restarting progress, stand/sit/down/sleep staging. One opaque registered drawing carries each frame; there are no overlapping translucent faces. This remains stylized2D movement, not a claim of seamless hand-drawn or fully skeletal animation.
- Independent review closed silhouette, expression, contrast, icon comprehension, light fallback backgrounds and final viewport-pixel findings.

## Actual viewport proof

The four PNGs are fresh-context captures. Inner viewport height, visualViewport height and cockpit rectangle all match the requested size; footer reaches the bottom; expected wide mode is active only at1440×900. All four measured30fps; default stage uses18,480 triangles and2 draw calls (dog skin plus ground contact).

The original resized-browser captures exposed a Chrome render-surface mismatch:87px at the bottom was unpainted, despite document metrics appearing correct. These final images use fresh contexts and verify bottom-strip pixels, not only PNG dimensions. See `scripts/illustrated/test-viewports.cjs`.

| Viewport | Stage mode | Observed fps |
|---|---|---|
|390×844|Single-region navigation|30|
|1024×768|Single-region navigation|30|
|1440×900|All five regions|30|
|1280×720|Single-region navigation|30|

`viewports.json` and `palettes.json` preserve the measured values. Native hidden-tab behavior is not certified: the visibility-pause branch is tested through simulated `document.hidden` in headless Chrome. Imported GLB animation was not re-certified by this release; its existing renderer path is retained and its background was made light.

## Assets and provenance

35 runtime WebP files total1,377,686 bytes across all five dogs. Only the selected dog's seven drawings load: Expo316,716; Mali312,800; Oreo239,996; Paolo278,236; Hachiku229,938 bytes. Source sheets and this evidence stay outside the production asset bundle. Final drawings were refined with the built-in image editor; local Flux supplied an earlier style study. No Meshy/Tripo generation, paid download or subscription was used.

Live deployment verification is recorded below after publishing.
