const renderMediaSourceSurface = (): string => `
<section class="skill-page-surface" data-workspace-surface="source" data-workspace-surface-skill="media-optimizer">
  <section class="panel app-form-panel">
    <form class="form-grid compact-form" data-media-optimizer-form>
      <div class="field wide">
        <label>Source file</label>
        <input name="sourceFile" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm" required />
      </div>
      <div class="field">
        <label>Preset</label>
        <select name="presetId" data-media-optimizer-preset>
          <option value="web-image">Web image</option>
          <option value="web-image-responsive">Responsive image set</option>
          <option value="web-video">Web video</option>
          <option value="web-video-compressed">Compressed video</option>
          <option value="web-video-poster">Video poster</option>
        </select>
      </div>
      <div class="field">
        <label>Capability</label>
        <select name="childCapabilityId" data-media-optimizer-child>
          <option value="optimize-image-for-web-once">Optimize image</option>
          <option value="resize-image-for-web-once">Resize image</option>
          <option value="generate-responsive-image-variants-once">Responsive image set</option>
          <option value="optimize-video-for-web-once">Optimize video</option>
          <option value="compress-video-for-web-once">Compress video</option>
          <option value="generate-video-poster-once">Video poster</option>
        </select>
      </div>
      <div class="field" data-media-optimizer-format-field>
        <label>Output format</label>
        <select name="outputFormat">
          <option value="webp">WebP</option>
          <option value="jpeg">JPEG</option>
          <option value="png">PNG</option>
          <option value="mp4">MP4</option>
        </select>
      </div>
      <div class="field"><label>Quality</label><input name="quality" type="number" min="1" max="100" value="82" /></div>
      <div class="field"><label>Max width</label><input name="maxWidth" type="number" min="1" max="8000" value="1600" /></div>
      <div class="field"><label>Max height</label><input name="maxHeight" type="number" min="1" max="8000" value="1200" /></div>
      <div class="field" data-media-optimizer-variant-field><label>Variant widths</label><input name="variantWidths" type="text" value="480,960,1440" /></div>
      <label class="check wide"><input name="saveToDownloads" type="checkbox" checked /> Save to Downloads/GrassEye Media Processing</label>
      <div class="wide hidden" data-media-optimizer-progress>
        <progress></progress>
        <div class="muted" data-media-optimizer-progress-label></div>
      </div>
      <div class="notice wide hidden" data-media-optimizer-result></div>
      <div class="actions wide"><button class="btn" type="submit">Start</button></div>
    </form>
  </section>
</section>`;

const renderMediaArtifactSurface = (): string => `
<section class="skill-page-surface hidden" data-workspace-surface="artifact" data-workspace-surface-skill="media-optimizer">
  <section class="panel history-panel">
    <div class="panel-title-row">
      <div>
        <span class="eyebrow">Artifact</span>
        <h2>Optimized media</h2>
      </div>
      <span class="status-badge status-ready"><b data-media-optimizer-artifact-count>0</b></span>
    </div>
    <div class="record-list" data-media-optimizer-artifact-list></div>
    <section class="empty-state app-empty-surface" data-media-optimizer-empty-artifacts>
      <span class="eyebrow">Artifact</span>
      <h2>No optimized media yet</h2>
      <p>Completed artifacts open here with file path, size, SHA-256, and proof reference.</p>
    </section>
  </section>
</section>`;

const renderMediaSettingsSurface = (): string => `
<section class="skill-page-surface hidden" data-workspace-surface="settings" data-workspace-surface-skill="media-optimizer">
  <section class="panel empty-state app-empty-surface">
    <span class="eyebrow">Settings</span>
    <h2>Website output presets</h2>
    <p>Image and video transforms stay inside the media-processing capability group.</p>
  </section>
</section>`;

export const renderMediaOptimizerWorkspace = (): string => `
<section class="skill-workspace hidden" data-skill-workspace="media-optimizer" data-job-panel="media-processing">
  <div class="skill-header">
    <div>
      <span class="eyebrow">Level 2 Skill Workspace</span>
      <h1>Media Optimizer</h1>
      <p>Website-ready image and video artifacts.</p>
    </div>
  </div>
  <nav class="skill-page-nav" data-workspace-page-nav="media-optimizer" aria-label="Media Optimizer pages">
    <button class="skill-page-tab" type="button" data-workspace-page="source" data-workspace-page-skill="media-optimizer" aria-pressed="true">Source</button>
    <button class="skill-page-tab" type="button" data-workspace-page="artifact" data-workspace-page-skill="media-optimizer" aria-pressed="false">Artifact</button>
    <button class="skill-page-tab" type="button" data-workspace-page="settings" data-workspace-page-skill="media-optimizer" aria-pressed="false">Settings</button>
  </nav>
  <div class="skill-page-stack secondary-page-stack">
    ${renderMediaSourceSurface()}
    ${renderMediaArtifactSurface()}
    ${renderMediaSettingsSurface()}
  </div>
</section>`;
