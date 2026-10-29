# Paolo reference and local Flux studies

These are art-development assets. None replaces the live dog's avatar yet.

- `standing-studio-reference.png`: the owner-liked full-body identity reference. Generated with the built-in image tool using the owner's two Paolo photographs; it is not a Flux output.
- `flux-ghibli-v1.png`: local Flux image-to-image study; too photographic, with a leaner body and artificial fur texture. Not accepted.
- `flux-ghibli-v2.png`: stronger local Flux style transfer; looks like a rendered figurine and loses some of Paolo's heavy jowls. Not accepted.
- `flux-cel-v1.png`: promising 2D style candidate from local Flux text-to-image. Independent review confirms clear outlines/simple color shapes, but it still needs Paolo's broader lower head, heavier jowls, smaller ears, shorter legs, distinct front paws and small offset tongue. Not a final identity master.
- Prompt files and `*.metadata.json` preserve the experiment settings and generation provenance.

Runtime: existing ~/Projects/_toolkit/mflux-venv/bin/mflux-generate, MFLUX 0.24.0, cached FLUX.1 Schnell and cached portrait-illustration LoRA. Commands used HF_HUB_OFFLINE=1. No Meshy/Tripo subscription or hosted generation was used for these Flux studies.

No still image proves a walk cycle, animation continuity, touch feedback or 30 fps performance. Those need an actual motion prototype and measured playback. Keep the original identity reference while refining the illustrated character.
