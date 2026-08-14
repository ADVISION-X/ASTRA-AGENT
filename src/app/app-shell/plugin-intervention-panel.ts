export const renderPluginInterventionPanel = (input: {
  owner: string;
  label: string;
  routePrefix: string;
}): string => `
<section class="panel app-form-panel" data-plugin-intervention-owner="${input.owner}" data-plugin-intervention-route="${input.routePrefix}">
  <div class="panel-title-row">
    <div><span class="eyebrow">Local Intervention</span><h2>${input.label}</h2></div>
    <span class="status-badge" data-plugin-intervention-state>idle</span>
  </div>
  <div class="form-grid compact-form">
    <div class="field wide"><label>Task / Run ID</label><input data-plugin-intervention-task-id required /></div>
    <div class="field"><label>Expected revision</label><input data-plugin-intervention-revision type="number" min="0" value="0" required /></div>
    <div class="field wide"><label>Reason</label><input data-plugin-intervention-reason value="operator_request" required /></div>
    <div class="actions wide">
      <button class="btn secondary" type="button" data-plugin-intervention-read>Refresh status</button>
      <button class="btn secondary" type="button" data-plugin-intervention-action="pause">Pause</button>
      <button class="btn secondary" type="button" data-plugin-intervention-action="cancel">Cancel</button>
      <button class="btn secondary" type="button" data-plugin-intervention-action="takeover">Take over</button>
      <button class="btn" type="button" data-plugin-intervention-action="resume">Resume</button>
    </div>
    <div class="notice wide" data-plugin-intervention-result>Exact task identity and CAS revision are required.</div>
  </div>
</section>`;
