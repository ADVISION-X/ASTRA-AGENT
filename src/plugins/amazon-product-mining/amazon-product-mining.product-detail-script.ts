export const AMAZON_DETAIL_EXTRACT_SCRIPT = String.raw`
return (function() {
  var normalizeText = function(text) {
    if (!text) return null;
    return text.replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/\s+/g, ' ').trim();
  };
  var isVisibleElement = function(element) {
    if (!element || !element.getBoundingClientRect) return false;
    var rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    var style = window.getComputedStyle ? window.getComputedStyle(element) : null;
    return !style || (style.display !== 'none' && style.visibility !== 'hidden');
  };
  var cleanVisibleText = function(element, maxLength) {
    if (!element || !isVisibleElement(element)) return null;
    var clone = element.cloneNode(true);
    clone.querySelectorAll('script, style, noscript, svg').forEach(function(node) { node.remove(); });
    var text = normalizeText(clone.textContent || '');
    return text ? text.substring(0, maxLength) : null;
  };
  var isUsableEvidenceImageUrl = function(url) {
    if (!url) return false;
    var lower = String(url).toLowerCase();
    if (lower.indexOf('grey-pixel') >= 0) return false;
    if (lower.indexOf('transparent-pixel') >= 0) return false;
    if (lower.indexOf('default.png') >= 0) return false;
    if (lower.indexOf('base64') >= 0) return false;
    return true;
  };
  var imageCandidatesFor = function(imageEl) {
    var urls = [];
    ['data-old-hires', 'data-a-hires', 'data-src', 'data-large-image', 'src', 'currentSrc'].forEach(function(attr) {
      var value = attr === 'currentSrc' ? imageEl.currentSrc : imageEl.getAttribute(attr);
      if (value) urls.push(value);
    });
    var srcset = imageEl.getAttribute('srcset');
    if (srcset) {
      srcset.split(',').forEach(function(part) {
        var value = normalizeText(part);
        if (value) urls.push(value.split(' ')[0]);
      });
    }
    return urls.filter(isUsableEvidenceImageUrl);
  };
  var collectImageUrls = function(selectors, maxItems) {
    var urls = [];
    selectors.forEach(function(selector) {
      document.querySelectorAll(selector).forEach(function(imageEl) {
        imageCandidatesFor(imageEl).forEach(function(url) {
          if (urls.indexOf(url) === -1) urls.push(url);
        });
      });
    });
    return urls.slice(0, maxItems);
  };
  var pickText = function(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var element = document.querySelector(selectors[i]);
      var text = cleanVisibleText(element, 5000);
      if (text) return text;
    }
    return null;
  };
  var pickSectionText = function(selectors, maxLength) {
    for (var i = 0; i < selectors.length; i++) {
      var element = document.querySelector(selectors[i]);
      var text = cleanVisibleText(element, maxLength);
      if (text) return text;
    }
    return null;
  };
  var collectTexts = function(selectors, maxItems) {
    var values = [];
    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);
      nodes.forEach(function(node) {
        var text = cleanVisibleText(node, 2000);
        if (text && values.indexOf(text) === -1) values.push(text);
      });
      if (values.length >= maxItems) break;
    }
    return values.slice(0, maxItems);
  };
  var uniqueValues = function(values) {
    var out = [];
    values.forEach(function(value) {
      if (value && out.indexOf(value) === -1) out.push(value);
    });
    return out;
  };
  var serializeKeyValueRows = function(selectors) {
    var record = {};
    for (var i = 0; i < selectors.length; i++) {
      var rows = document.querySelectorAll(selectors[i]);
      rows.forEach(function(row, index) {
        var keyEl = row.querySelector('th, .a-text-bold');
        var valueEl = row.querySelector('td, span:last-child');
        var key = normalizeText(keyEl && keyEl.textContent ? keyEl.textContent : null);
        var value = normalizeText(valueEl && valueEl.textContent ? valueEl.textContent : null);
        if (!key || !value) {
          var rowText = normalizeText(row && row.textContent ? row.textContent : null);
          if (!rowText) return;
          var parts = rowText.split(/:\s+/);
          key = parts.length > 1 ? normalizeText(parts[0]) : 'item_' + String(index + 1);
          value = normalizeText(parts.length > 1 ? parts.slice(1).join(': ') : rowText);
        }
        if (key && value) record[key] = value;
      });
    }
    return Object.keys(record).length > 0 ? JSON.stringify(record) : null;
  };
  var serializeStarDistribution = function() {
    var rows = document.querySelectorAll('#histogramTable tr, [data-hook="cr-summarization-attributes"] tr, [data-hook="cr-summarization-attributes"] li, [data-hook="histogram-row-container"]');
    var items = [];
    rows.forEach(function(row) {
      var text = cleanVisibleText(row, 500);
      if (text) items.push(text);
    });
    if (items.length === 0) {
      var alternateSummary = pickSectionText(['[data-hook="cr-summarization-attributes"]', '#cr-summarization-attributes', '#reviewsMedley'], 1500);
      if (alternateSummary && alternateSummary.toLowerCase().indexOf('star') >= 0) items.push(alternateSummary);
    }
    return items.length > 0 ? JSON.stringify(items) : null;
  };
  var safeParseJson = function(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (_error) {
      return null;
    }
  };
  var normalizeVariationDimensionName = function(dimensionKey) {
    var names = {
      color_name: 'Color',
      size_name: 'Size',
      style_name: 'Style',
      pattern_name: 'Pattern',
      configuration: 'Configuration',
      capacity: 'Capacity'
    };
    return names[dimensionKey] || dimensionKey;
  };
  var serializeTwisterVariationOptions = function() {
    var stateScripts = Array.from(document.querySelectorAll('#twister_feature_div script[type="a-state"], script[type="a-state"]'));
    for (var i = 0; i < stateScripts.length; i++) {
      var scriptText = stateScripts[i].textContent || '';
      if (scriptText.indexOf('sortedDimValuesForAllDims') < 0) continue;
      var parsed = safeParseJson(scriptText);
      if (!parsed || !parsed.sortedDimValuesForAllDims) continue;
      var dimensions = [];
      Object.keys(parsed.sortedDimValuesForAllDims).forEach(function(dimensionKey) {
        var rawOptions = parsed.sortedDimValuesForAllDims[dimensionKey];
        if (!Array.isArray(rawOptions)) return;
        var options = rawOptions.map(function(option) {
          return {
            label: option.dimensionValueDisplayText || null,
            state: option.dimensionValueState || null,
            asin: option.defaultAsin || null,
            pageLoadUrl: option.pageLoadURL || null,
            imageUrl: option.imageAttribute && option.imageAttribute.url ? option.imageAttribute.url : null,
            displaySubType: option.dimensionDisplaySubType || null
          };
        });
        var selected = options.filter(function(option) { return option.state === 'SELECTED'; }).map(function(option) { return option.label; });
        dimensions.push({
          dimensionKey: dimensionKey,
          dimensionName: normalizeVariationDimensionName(dimensionKey),
          selectedValues: selected,
          optionCount: options.length,
          options: options
        });
      });
      if (dimensions.length > 0) {
        return JSON.stringify({
          source: 'desktop-twister-sort-filter-data',
          dimensions: dimensions
        });
      }
    }
    return null;
  };
  var serializeVisibleVariationOptions = function() {
    var selectedLabels = collectTexts([
      '#inline-twister-expanded-dimension-text-color_name',
      '#inline-twister-expanded-dimension-text-size_name',
      '#inline-twister-expanded-dimension-text-style_name',
      '#inline-twister-expanded-dimension-text-pattern_name',
      '#inline-twister-expanded-dimension-text-configuration',
      '[id*="variation"] .selection'
    ], 20);
    var optionTexts = collectTexts([
      '#twister_feature_div li',
      '#variation_color_name li',
      '#variation_size_name li',
      '#variation_style_name li',
      '.inline-twister-swatch',
      '.dimension-value-list-item',
      '.swatch-list-container .swatchElement'
    ], 80);
    if (selectedLabels.length === 0 && optionTexts.length === 0) return null;
    return JSON.stringify({
      source: 'visible-twister-dom',
      selectedValues: selectedLabels,
      options: optionTexts
    });
  };

  var asin = null;
  var asinEl = document.querySelector('[name="ASIN"]');
  if (asinEl) asin = asinEl.value;
  if (!asin) {
    var asinMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
    asin = asinMatch ? asinMatch[1] : null;
  }

  var title = pickText(['#productTitle']);
  var brand = pickText(['#bylineInfo']);
  if (brand) {
    brand = brand.replace(/Visit the|Brand:|Store/gi, '').trim() || null;
  }
  var sellerOrStore = pickText(['#merchant-info', '#tabular-buybox-seller-name']);
  var currentPrice = pickText([
    '.priceToPay .a-offscreen',
    '#corePrice_feature_div .a-price .a-offscreen',
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '#corePrice_desktop .a-price .a-offscreen',
    '.a-price .a-offscreen'
  ]);
  var originalPrice = pickText(['.basisPrice .a-offscreen', '#priceblock_listprice']);
  var couponText = pickText(['#couponBadgeRegularVpc', '#couponTextpctch', '#couponText']);
  var origOrCoupon = originalPrice || couponText;

  var mainImageEl = document.getElementById('landingImage') || document.querySelector('#imgTagWrapperId img');
  var mainImageCandidates = mainImageEl ? imageCandidatesFor(mainImageEl) : [];
  var mainImage = mainImageCandidates.length > 0 ? mainImageCandidates[0] : null;
  var allVisibleImages = collectImageUrls(['#altImages img[src*="images/I/"], #altImages img, #imageBlock img'], 80);
  if (mainImage && allVisibleImages.indexOf(mainImage) === -1) {
    allVisibleImages.unshift(mainImage);
  }
  var visibleVideoNodes = document.querySelectorAll('#videoBlock_feature_div video, #videoBlock_feature_div [data-video-url], #videoThumbnail_feature_div li, #altImages li.videoThumbnail, #altImages [data-video-url]');
  var visibleVideoInfo = visibleVideoNodes.length > 0 ? String(visibleVideoNodes.length) + ' visible product video slots' : null;

  var bulletPoints = collectTexts(['#feature-bullets li .a-list-item'], 30);
  var aboutThisItem = pickSectionText(['#feature-bullets'], 3000);
  var productDescription = pickSectionText(['#productDescription p', '#productDescription'], 5000);
  var aPlusContent = pickSectionText(['#aplus', '#aplus_feature_div', '[data-cel-widget*="aplus"]'], 4000);
  var aPlusImageUrls = collectImageUrls(['#aplus img, #aplus_feature_div img, [data-cel-widget*="aplus"] img'], 80);

  var variationOptions = serializeTwisterVariationOptions() || serializeVisibleVariationOptions();
  var colorOpts = null;
  if (variationOptions) {
    var variationRecord = safeParseJson(variationOptions);
    var colorSizeDimensions = variationRecord && Array.isArray(variationRecord.dimensions)
      ? variationRecord.dimensions.filter(function(dimension) {
        return ['color_name', 'size_name', 'style_name', 'pattern_name', 'configuration', 'capacity'].indexOf(dimension.dimensionKey) >= 0;
      })
      : [];
    colorOpts = colorSizeDimensions.length > 0 ? JSON.stringify(colorSizeDimensions) : variationOptions;
  }

  var productInformation = serializeKeyValueRows(['#productOverview_feature_div tr', '#poExpander tr', '#productDetails_feature_div tr', '#prodDetails tr']);
  var technicalDetails = serializeKeyValueRows(['#productDetails_techSpec_section_1 tr', '#productDetails_detailBullets_sections1 tr', '#prodDetails tr']);
  var additionalInformation = serializeKeyValueRows(['#detailBullets_feature_div li', '#detailBulletsWrapper_feature_div li', '#productDetails_detailBullets_sections1 tr']);
  var bestSellersRankIfVisible = pickSectionText(['#SalesRank', '#detailBulletsWrapper_feature_div'], 500);
  if (bestSellersRankIfVisible && bestSellersRankIfVisible.toLowerCase().indexOf('rank') === -1) {
    bestSellersRankIfVisible = null;
  }
  var categoryPathItems = collectTexts([
    '#wayfinding-breadcrumbs_feature_div li a',
    '#wayfinding-breadcrumbs_feature_div li span.a-list-item'
  ], 20);
  var categoryPath = categoryPathItems.length > 0 ? categoryPathItems.join(' > ') : null;

  var ratingLabel = pickText([
    '#acrPopover .a-size-base.a-color-base',
    '#acrPopover .a-icon-alt',
    '[data-hook="rating-out-of-text"]',
    '[data-hook="average-star-rating"] .a-icon-alt'
  ]);
  if (!ratingLabel) {
    var ariaRatingEl = document.querySelector('[aria-label*="out of 5 stars"]');
    ratingLabel = ariaRatingEl ? normalizeText(ariaRatingEl.getAttribute('aria-label')) : null;
  }
  var ratingMatch = ratingLabel ? ratingLabel.match(/([0-9]+(?:[\.,][0-9]+)?)\s*out of 5 stars/i) : null;
  var rating = ratingMatch ? ratingMatch[1] + ' out of 5 stars' : ratingLabel;
  var reviewCount = pickText([
    '#acrCustomerReviewText',
    '[data-hook="total-review-count"]',
    'a[data-hook="see-all-reviews-link-foot"]'
  ]);
  if (!reviewCount && ratingLabel) {
    var reviewCountMatch = ratingLabel.match(/([0-9][0-9,\.]*)\s+ratings?/i);
    reviewCount = reviewCountMatch ? '(' + reviewCountMatch[1] + ')' : null;
  }
  var boughtInPastMonthIfVisible = pickText([
    '#socialProofingAsinFaceout_feature_div #social-proofing-faceout-title-tk_bought',
    '#socialProofingAsinFaceout_feature_div .social-proofing-faceout-title-text',
    '#socialProofingAsinFaceout_feature_div .social-proofing-faceout'
  ]);
  if (boughtInPastMonthIfVisible && !/\bbought\s+in\s+past\s+month\b/i.test(boughtInPastMonthIfVisible)) {
    boughtInPastMonthIfVisible = null;
  }
  var starDistribution = serializeStarDistribution();
  var qaContentRaw = pickSectionText(['#ask-btf-container', '#ask_lazy_load_div', '#ask_feature_div'], 3000);
  var qaContent = qaContentRaw && (qaContentRaw.indexOf('?') >= 0 || qaContentRaw.toLowerCase().indexOf('answer') >= 0 || qaContentRaw.toLowerCase().indexOf('question') >= 0) ? qaContentRaw : null;
  var frequentlyBoughtTogether = pickSectionText(['#sims-fbt', '#bundle_feature_div', '#frequently-bought-together_feature_div'], 2000);
  var customersAlsoBought = pickSectionText(['#purchase-sims-feature', '#desktop-dp-sims_purchase-sim-feature'], 2000);
  var compareWithSimilarItems = pickSectionText(['#HLCXComparisonTable', '#similarities_feature_div', '#comparison_table_feature_div'], 2000);
  var deliveryInfo = pickText(['#availability', '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE']);
  var returnInformation = pickText([
    '#RETURNS_POLICY .a-text-bold',
    '#RETURNS_POLICY',
    '#returns-policy-anchor-text',
    '[data-feature-name="returnsPolicy"]'
  ]);
  var otherVisibleParameters = pickSectionText(['#productFactsDesktopExpander', '#prodDetails', '#detailBulletsWrapper_feature_div'], 4000);
  var rawText = cleanVisibleText(document.body, 15000) || '';

  return {
    asin: asin,
    title: title,
    brand: brand,
    sellerOrStore: sellerOrStore,
    currentPrice: currentPrice,
    origOrCoupon: origOrCoupon,
    mainImage: mainImage,
    allVisibleImages: allVisibleImages,
    visibleVideoInfo: visibleVideoInfo,
    bulletPoints: bulletPoints,
    aboutThisItem: aboutThisItem,
    productDescription: productDescription,
    aPlusContent: aPlusContent,
    aPlusImageUrls: aPlusImageUrls,
    variationOptions: variationOptions,
    colorOpts: colorOpts,
    productInformation: productInformation,
    technicalDetails: technicalDetails,
    additionalInformation: additionalInformation,
    bestSellersRankIfVisible: bestSellersRankIfVisible,
    categoryPath: categoryPath,
    rating: rating,
    reviewCount: reviewCount,
    boughtInPastMonthIfVisible: boughtInPastMonthIfVisible,
    starDistribution: starDistribution,
    qaContent: qaContent,
    frequentlyBoughtTogether: frequentlyBoughtTogether,
    customersAlsoBought: customersAlsoBought,
    compareWithSimilarItems: compareWithSimilarItems,
    deliveryInfo: deliveryInfo,
    returnInformation: returnInformation,
    otherVisibleParameters: otherVisibleParameters,
    rawText: rawText,
  };
})();
`;
