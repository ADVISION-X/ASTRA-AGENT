// Runs inside the active browser tab. Detects video candidates from any web page.
// Detection order: video elements > performance entries > HLS/DASH in scripts > MP4/WebM in scripts.
export const UNIVERSAL_PAGE_PROBE_SCRIPT = `
(function () {
  var SCRIPT_LIMIT = 200 * 1024;
  var URL_RE = /^https?:\\/\\//;
  var VIDEO_EXT_RE = /\\.(?:mp4|webm|m4v|ts)(?:[?#]|$)/i;
  var HLS_RE = /["'](https?:\\/\\/[^"'<>\\s]+\\.m3u8[^"'<>\\s]*?)["']/g;
  var DASH_RE = /["'](https?:\\/\\/[^"'<>\\s]+\\.mpd[^"'<>\\s]*?)["']/g;
  var MP4_RE = /["'](https?:\\/\\/[^"'<>\\s]+\\.(?:mp4|webm|m4v)[^"'<>\\s]*?)["']/g;

  var candidates = [];
  var seen = new Set();

  function push(kind, url, source, quality) {
    if (typeof url !== 'string' || !URL_RE.test(url)) return;
    var key = kind + ':' + url;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ kind: kind, url: url, source: source, quality: quality || 'unknown' });
  }

  // Step 1: <video> elements
  var videos = Array.from(document.querySelectorAll('video'));
  for (var i = 0; i < videos.length; i++) {
    var v = videos[i];
    var cs = v.currentSrc || '';
    var vs = v.getAttribute('src') || '';
    if (cs) push('video_element', cs, 'video_currentSrc', 'unknown');
    else if (vs) push('video_element', vs, 'video_src', 'unknown');
    var sources = Array.from(v.querySelectorAll('source'));
    for (var j = 0; j < sources.length; j++) {
      var ss = sources[j].getAttribute('src') || '';
      if (ss) push('source_element', ss, 'source_tag', 'unknown');
    }
  }

  // Step 2: performance resource entries
  var entries = (window.performance && window.performance.getEntriesByType)
    ? window.performance.getEntriesByType('resource')
    : [];
  for (var k = 0; k < entries.length; k++) {
    var e = entries[k];
    var u = e.name || '';
    var mt = (e.initiatorType === 'video' || e.initiatorType === 'media');
    var isVideoExt = VIDEO_EXT_RE.test(u);
    if (!mt && !isVideoExt) continue;
    var kind2 = (e.initiatorType === 'video' || e.initiatorType === 'media') ? 'media_resource' : 'media_resource';
    push(kind2, u, 'performance_entry', 'unknown');
  }

  // Step 3: inline script content scan (limited to first SCRIPT_LIMIT bytes per script)
  var scripts = Array.from(document.querySelectorAll('script:not([src])'));
  for (var m = 0; m < scripts.length; m++) {
    var text = (scripts[m].textContent || '').substring(0, SCRIPT_LIMIT);
    var hm, dm, pm;
    HLS_RE.lastIndex = 0;
    while ((hm = HLS_RE.exec(text)) !== null) push('hls_manifest', hm[1], 'script_hls', 'unknown');
    DASH_RE.lastIndex = 0;
    while ((dm = DASH_RE.exec(text)) !== null) push('dash_manifest', dm[1], 'script_dash', 'unknown');
    MP4_RE.lastIndex = 0;
    while ((pm = MP4_RE.exec(text)) !== null) push('media_resource', pm[1], 'script_mp4', 'unknown');
  }

  return {
    pageUrl: location.href,
    pageTitle: document.title,
    candidates: candidates
  };
})()
`;
