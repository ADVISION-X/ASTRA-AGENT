# Product Video DOM Runtime

This plugin runs the DOM-first product-video mining loop:

1. open a task-provided video page;
2. read governed DOM summary through the DOM automation facade;
3. when the approved AI decision is `product_seed`, click the located like button;
4. open comments, record comment count and sampled comments;
5. persist a structured evidence packet under the local workbench data directory;
6. click the located next-video button.

It does not import DOM runtime internals, browser primitives, visual mission code, or platform-private selectors.
