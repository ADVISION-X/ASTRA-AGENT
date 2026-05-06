# BLOCKER-RUNTIME-3 Mutation

Production mutation changed `open-iphone-mirroring` step `failureBranch` to an undeclared transition id in `src/map-plugins/builtins/iphone-mirroring-facebook-seeding-video-discovery.meta.map-package.json`.

Expected result: Map package inspector must fail because step-declared branch closure no longer resolves to top-level branch registration and a transition id.
