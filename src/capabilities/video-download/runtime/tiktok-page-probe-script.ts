// Runs inside the active browser tab on TikTok/Douyin. Extracts video media data.
export const TIKTOK_MEDIA_PROBE_SCRIPT = `
(function () {
  function pushCandidate(candidates, seen, kind, url, source, quality) {
    if (typeof url !== 'string' || !/^https?:\\/\\//u.test(url)) return;
    var key = kind + ':' + url;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ kind: kind, url: url, source: source, quality: quality || 'unknown' });
  }

  var candidates = [];
  var seen = new Set();
  var videoFact = null;

  // Step 1: __NEXT_DATA__ (TikTok web)
  try {
    var nextData = window.__NEXT_DATA__;
    if (nextData) {
      var item = (nextData.props && nextData.props.pageProps && nextData.props.pageProps.itemInfo)
        ? nextData.props.pageProps.itemInfo.itemStruct
        : null;
      if (item && item.video) {
        var v = item.video;
        if (v.playAddr) pushCandidate(candidates, seen, 'native_hd', v.playAddr, 'next_data_playAddr', 'hd');
        if (v.downloadAddr && v.downloadAddr !== v.playAddr) {
          pushCandidate(candidates, seen, 'native_hd', v.downloadAddr, 'next_data_downloadAddr', 'hd');
        }
        if (v.width && v.height) {
          videoFact = { width: v.width, height: v.height, duration: v.duration || null };
        }
      }
    }
  } catch (_e) {}

  // Step 2: SIGI_STATE (TikTok alternative data)
  try {
    var sigiState = window.SIGI_STATE || window.__SIGI_STATE__;
    if (sigiState && sigiState.ItemModule) {
      var items = Object.values(sigiState.ItemModule);
      for (var i = 0; i < items.length; i++) {
        var si = items[i];
        if (si && si.video) {
          var sv = si.video;
          if (sv.playAddr) pushCandidate(candidates, seen, 'native_hd', sv.playAddr, 'sigi_playAddr', 'hd');
          if (sv.downloadAddr && sv.downloadAddr !== sv.playAddr) {
            pushCandidate(candidates, seen, 'native_hd', sv.downloadAddr, 'sigi_downloadAddr', 'hd');
          }
          if (!videoFact && sv.width && sv.height) {
            videoFact = { width: sv.width, height: sv.height, duration: sv.duration || null };
          }
        }
      }
    }
  } catch (_e) {}

  // Step 3: video element fallback
  var videos = Array.from(document.querySelectorAll('video'));
  for (var j = 0; j < videos.length; j++) {
    var cs = videos[j].currentSrc || '';
    if (cs) pushCandidate(candidates, seen, 'video_element', cs, 'video_element', 'unknown');
  }

  // Step 4: performance entries
  var entries = (window.performance && window.performance.getEntriesByType)
    ? window.performance.getEntriesByType('resource')
    : [];
  for (var k = 0; k < entries.length; k++) {
    var u = entries[k].name || '';
    if (/\\.(?:mp4|webm|m3u8)(?:[?#]|$)/i.test(u)) {
      pushCandidate(candidates, seen, 'media_resource', u, 'performance_entry', 'unknown');
    }
  }

  return {
    pageUrl: location.href,
    pageTitle: document.title,
    videoFact: videoFact,
    candidates: candidates
  };
})()
`;
