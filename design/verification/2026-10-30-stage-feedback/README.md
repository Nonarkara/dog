# Action message below the animal

[Design and budgets](../../stage-feedback.md). The exact second-wake message from the owner's screenshot was reproduced at 390×844, 1024×768, 1440×900 and 1280×720. Old note/canvas intersection: 17,088 / 47,520 / 27,391.5 / 59,808 square pixels. New intersection: zero in every case. Original outer stage and Care bounds remain unchanged; the message owns a 34px row inside the stage, with canvas at least 200px high and all toy buttons still within it.

TypeScript/build and `scripts/test-stage-feedback.cjs` pass. The script checks message/canvas bounds, Care/page overflow, complete wake-up text in the title, unchanged surrounding geometry and dismissal. The existing single-line visual message remains; full status content is retained. Other regions' note bars are untouched. Screenshot proof verifies exposed paws and separated text, not new animation quality.

Independent source review found no blocker; final pixels and deployment closeout follow below.

Final independent source/pixel gate cleared all four viewport captures. The phone helper initially intersected the bottom toy after the canvas became shorter; this was fixed by letting that hint yield during feedback and return after the 200ms close transition (immediately with reduced motion). All five toys stay present. The regression suite verifies that temporary hiding and restoration; refreshed phone pixels show paws and controls clear. No remaining blocker.
