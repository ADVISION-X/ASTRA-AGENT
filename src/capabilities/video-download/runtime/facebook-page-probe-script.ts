export const FACEBOOK_MEDIA_PROBE_SCRIPT = `
const decodeFacebookEscapedUrl = (value) => {
  let output = value;
  for (let index = 0; index < 4; index += 1) {
    output = output
      .replaceAll('\\\\/', '/')
      .replaceAll('&amp;', '&')
      .replaceAll('\\\\u0025', '%')
      .replaceAll('\\\\u0026', '&')
      .replaceAll('\\\\u003D', '=')
      .replaceAll('\\\\u003d', '=');
  }
  try {
    return decodeURIComponent(output);
  } catch {
    return output;
  }
};

const pushCandidate = (candidates, seen, kind, url, source, quality) => {
  if (typeof url !== 'string' || !/^https?:\\/\\//u.test(url)) return;
  const decoded = decodeFacebookEscapedUrl(url);
  const key = kind + ':' + decoded;
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push({ kind, url: decoded, source, quality });
};

const collectScriptCandidates = (candidates, seen) => {
  const fieldMap = {
    browser_native_hd_url: ['native_hd', 'hd'],
    browser_native_sd_url: ['native_sd', 'sd'],
    dash_manifest_url: ['dash_manifest', 'unknown'],
  };
  for (const script of Array.from(document.scripts)) {
    const text = script.textContent || '';
    for (const [field, config] of Object.entries(fieldMap)) {
      const re = new RegExp('"' + field + '"\\\\s*:\\\\s*"(https?:[^"\\\\\\\\]*(?:\\\\\\\\.[^"\\\\\\\\]*)*)"', 'g');
      let match = re.exec(text);
      while (match) {
        pushCandidate(candidates, seen, config[0], match[1], field, config[1]);
        match = re.exec(text);
      }
    }
    const generic = text.match(/https?:\\\\\\/\\\\\\/video\\.[^"'<>]+?\\.mp4[^"'<>]*/gu) || [];
    for (const item of generic) {
      pushCandidate(candidates, seen, 'media_resource', item, 'script_mp4', 'unknown');
    }
  }
};

const collectVideoElementCandidates = (candidates, seen) => {
  for (const video of Array.from(document.querySelectorAll('video'))) {
    const source = video.currentSrc || video.getAttribute('src') || '';
    pushCandidate(candidates, seen, 'video_element', source, 'video_element', 'unknown');
  }
};

const collectPerformanceCandidates = (candidates, seen) => {
  const entries = window.performance?.getEntriesByType?.('resource') || [];
  for (const entry of entries) {
    const name = typeof entry.name === 'string' ? entry.name : '';
    if (/\\.mp4(?:[?#]|$)|video\\./iu.test(name)) {
      pushCandidate(candidates, seen, 'media_resource', name, 'performance_resource', 'unknown');
    }
  }
};

const collectVideoFacts = () => Array.from(document.querySelectorAll('video')).map((video) => ({
  duration: Number.isFinite(video.duration) ? video.duration : null,
  width: video.videoWidth || null,
  height: video.videoHeight || null,
  readyState: video.readyState,
}));

const candidates = [];
const seen = new Set();
collectScriptCandidates(candidates, seen);
collectVideoElementCandidates(candidates, seen);
collectPerformanceCandidates(candidates, seen);

return {
  pageUrl: location.href,
  pageTitle: document.title,
  videoId: (location.href.match(/\\/(?:reel|videos?)\\/(\\d{8,})/u) || [])[1] || null,
  videoFacts: collectVideoFacts(),
  candidates,
};
`;
