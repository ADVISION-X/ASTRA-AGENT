# Amazon Invoice Upload Plugin

Phase one plugin skeleton for Amazon Seller Central invoice upload.

This plugin only orchestrates generic DOM automation abilities:

- open Seller Central entry URL
- read DOM snapshot
- locate order search input
- fill the task-approved Amazon order id
- click search
- read DOM snapshot
- locate the order row and upload invoice entry
- stop with `review_required`

Additional governed plugin surfaces:

- amazon-result-detector.ts keeps Amazon-specific status detection in the plugin owner
- phaseStatus uses a governed status enum for backend writeback or operator UI

It does not implement a private DOM controller, does not upload files, and does not submit invoices in phase one.
