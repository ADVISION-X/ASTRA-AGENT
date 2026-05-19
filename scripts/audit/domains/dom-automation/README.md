# DOM Automation Owner Inspector

This owner inspector is a CI-FULL internal gate for the DOM automation capability group.

It checks only DOM owner boundaries:

- DOM structure exists.
- DOM ability IDs are registered through source registry code.
- DOM code does not pollute visual missions.
- Business plugin code does not create private DOM or browser controllers.
- DOM code does not create a second BrowserController.
- Sensitive browser data and log field names are not leaked from governed runtime paths.

It is not a second complete quality gate and is not a production DOM runtime.
