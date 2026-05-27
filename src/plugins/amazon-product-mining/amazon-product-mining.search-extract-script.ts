const AMAZON_SEARCH_EXTRACT_SCRIPT_TEMPLATE = String.raw`
return (function() {
  var normalizeText = function(text) {
    if (!text) return null;
    return text.replace(/\s+/g, ' ').trim();
  };
  var pickText = function(root, selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var element = root.querySelector(selectors[i]);
      var text = normalizeText(element && element.textContent ? element.textContent : null);
      if (text) return text;
    }
    return null;
  };
  var matchCommercialLine = function(text, patterns) {
    for (var i = 0; i < patterns.length; i++) {
      var match = text.match(patterns[i]);
      if (match && match[0]) return normalizeText(match[0]);
    }
    return null;
  };
  var body = document.body.innerText || "";
  if (document.querySelector('input[name="email"]') || document.querySelector('#ap_email')) {
    return { blocker: "login_required" };
  }
  if (document.querySelector('form[action*="captcha"]') || document.querySelector('#captchacharacters')) {
    return { blocker: "captcha" };
  }
  var items = [];
  var sliceStart = __START_INDEX__;
  var sliceLimit = __LIMIT__;
  var cards = document.querySelectorAll('[data-component-type="s-search-result"]');
  if (cards.length === 0) {
    cards = document.querySelectorAll('[data-asin]');
  }
  var allCards = Array.prototype.slice.call(cards);
  var selectedCards = allCards.slice(sliceStart, sliceStart + sliceLimit);
  var rank = sliceStart;
  selectedCards.forEach(function(card) {
    var asin = card.getAttribute('data-asin') || null;
    var cardText = normalizeText(card.innerText || '') || '';
    var titleEl = card.querySelector('h2 a span') || card.querySelector('.a-size-medium') || card.querySelector('.a-size-base-plus');
    var title = titleEl ? titleEl.textContent.trim() : null;
    var linkEl = card.querySelector('h2 a') || card.querySelector('a.a-link-normal');
    var href = linkEl ? linkEl.getAttribute('href') : null;
    if (!href) return;
    var productUrl = href.startsWith('http') ? href : ('https://' + window.location.host + href);
    var priceEl = card.querySelector('.a-price .a-offscreen') || card.querySelector('.a-price');
    var price = priceEl ? priceEl.textContent.trim() : null;
    var ratingEl = card.querySelector('.a-icon-star-small .a-icon-alt') || card.querySelector('[aria-label*="out of 5"]');
    var rating = ratingEl ? (ratingEl.textContent || ratingEl.getAttribute('aria-label') || null) : null;
    var reviewCountEl = card.querySelector('.a-size-base.s-underline-text') || card.querySelector('[aria-label*="ratings"]');
    var reviewCount = reviewCountEl ? reviewCountEl.textContent.trim() : null;
    var imgEl = card.querySelector('img.s-image') || card.querySelector('img[src*="images/I/"]');
    var mainImageUrl = imgEl ? imgEl.getAttribute('src') : null;
    var badgeText = card.querySelector('.s-sponsored-label-text');
    var isSponsored = badgeText ? badgeText.textContent.toLowerCase().includes('sponsored') : false;
    if (!isSponsored) {
      var sponsorDiv = card.querySelector('.s-label-popover-hover');
      if (sponsorDiv) isSponsored = true;
    }
    var primeEl = card.querySelector('[aria-label="Amazon Prime"]')
      || card.querySelector('.s-prime')
      || card.querySelector('[data-cy="prime-badge"]');
    var primeOrFba = primeEl ? 'Prime' : null;
    if (!primeOrFba && /fulfilled by amazon|fba/i.test(cardText)) {
      primeOrFba = 'Fulfilled by Amazon';
    }
    var couponEl = card.querySelector('.s-coupon-unclipped span')
      || card.querySelector('.couponBadge')
      || card.querySelector('[aria-label*="coupon"]');
    var couponText = couponEl ? normalizeText(couponEl.textContent) : matchCommercialLine(cardText, [/(?:Save|Coupon|Apply)\s+[^\n]+/i]);
    var originalPrice = pickText(card, [
      '.a-price.a-text-price .a-offscreen',
      '.a-price[data-a-strike="true"] .a-offscreen',
      '.a-price.a-text-price span[aria-hidden="true"]',
      '.basisPrice .a-offscreen',
      '.a-price[data-a-color="secondary"] .a-offscreen'
    ]);
    var discountText = matchCommercialLine(cardText, [/(?:Save\s+[^\n]+|\d+%\s+off|Limited time deal[^\n]*)/i]);
    var originalPriceOrDiscount = originalPrice || discountText;
    var deliveryText = pickText(card, [
      '[data-cy="delivery-recipe"]',
      '.a-color-base.a-text-bold',
      '.a-color-secondary .a-text-bold',
      '.a-row.a-size-base.a-color-secondary'
    ]);
    if (!deliveryText) {
      deliveryText = matchCommercialLine(cardText, [/(?:FREE delivery[^\n]*|Delivery[^\n]*|Get it by[^\n]*|Arrives[^\n]*|Overnight delivery[^\n]*)/i]);
    }
    rank++;
    items.push({
      asin: asin,
      title: title,
      productUrl: productUrl,
      price: price,
      rating: rating,
      reviewCount: reviewCount,
      mainImageUrl: mainImageUrl,
      isSponsored: isSponsored,
      rankPosition: rank,
      primeOrFba: primeOrFba,
      couponText: couponText,
      originalPriceOrDiscount: originalPriceOrDiscount,
      deliveryText: deliveryText,
    });
  });
  return {
    items: items,
    rawText: __RAW_TEXT__,
    totalCards: allCards.length
  };
})();
`;

export const buildAmazonSearchExtractScript = (input: {
  includeRawText: boolean;
  limit: number;
  startIndex: number;
}): string =>
  AMAZON_SEARCH_EXTRACT_SCRIPT_TEMPLATE
    .replace("__START_INDEX__", String(input.startIndex))
    .replace("__LIMIT__", String(input.limit))
    .replace("__RAW_TEXT__", input.includeRawText ? "document.body.innerText.substring(0, 8000)" : "null");