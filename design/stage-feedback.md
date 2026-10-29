# Messages below the dog

The owner screenshot shows a wake-up message covering Paolo's legs. The action note inherited the global absolute bottom-overlay bar, placing a text rectangle over the live canvas.

Fix: retain the same outer stage size and every message/dismiss control, but place feedback in its own compact row below the canvas. The canvas and feedback occupy separate flex rows. The feedback row opens/closes with a short ease-out height transition, respecting reduced motion; the camera follows its actual available space. Care and the rest of the cockpit keep their space. Long text retains the existing single-line presentation, with its complete text available as a native title and in the accessible status content. Other regions' note bars remain unchanged.

Budgets: action-note/canvas intersection must be zero at phone/tablet/desktop/short-wide sizes; original stage and Care bounds unchanged; canvas at least 200px tall; entire toy rail inside it; no page or Care overflow. The old runtime is captured with the exact repeated-wake message and must fail the intersection test. New proof uses the same trigger and confirms dismissal. This is a composition fix, not a new animation claim.

The tiny “Stroke to pet” helper yields while a message is visible, preventing the shortened phone canvas from pushing it into the bottom toy button. It returns after the row closes; all five toy controls stay present. Other guidance and care information remain.
