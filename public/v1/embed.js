/*
 * modafied.org/v1/embed.js - optional drop-in for sites listing data feeds.
 *
 * Plain HTML is always enough:
 *
 *   <a href="https://modafied.org/scorecards/nws">
 *     <img src="https://modafied.org/v1/emblems/nws.svg" alt="..." height="112">
 *   </a>
 *
 * This script exists for listing pages that want the emblem plus its trace line rendered
 * consistently across many feeds, and that want the displayed claim to be read from the
 * attestation rather than typed by hand. Usage:
 *
 *   <span data-modafied="nws"></span>
 *   <span data-modafied="usgs-earthquake" data-modafied-variant="compact"></span>
 *   <script src="https://modafied.org/v1/embed.js" defer></script>
 *
 * It is built for directories, which means it has to behave on a page listing a thousand feeds of
 * which we have benchmarked five. Two things make that work (ADR-0015):
 *
 * - It asks once, not once per row. /v1/emblems/index.json says which subjects we have measured at
 *   all. Every row not in it is answered "not benchmarked" from that single response, with no
 *   request of its own and no broken image while it waits.
 * - It fetches a claim only for rows a reader can actually see, via IntersectionObserver. A row
 *   nobody scrolls to costs nothing.
 *
 * The index carries membership and nothing else: no grade, no status, no points. So the claim on
 * any row still comes from that row's own live attestation, fetched fresh, exactly as before.
 *
 * What it deliberately does not do:
 * - It sets no cookie, reads no storage, and reports nothing back. It fetches two static
 *   files from modafied.org and renders them. There is no analytics in it and there will
 *   not be: a benchmark that watches who displays its emblems has a second business model.
 * - It never caches the claim into the host page's markup. The emblem and the attestation are
 *   fetched live, so a downgrade propagates on next load with no action by the host (E2, E4).
 * - It renders no "verified" state, because none exists (E1). The only states are a grade and
 *   insufficient data.
 *
 * If the fetch fails, the element falls back to a plain linked emblem image. An unreachable
 * benchmark must not blank out someone else's page.
 */
(function () {
  'use strict';

  /*
   * Where Modafied lives is read from this script's own URL, never hardcoded. A host page loads
   * this file from wherever the benchmark is actually served, so that URL is the one address we
   * can be certain about. Hardcoding it means every emblem breaks the day the site moves, on
   * pages we do not control and cannot fix.
   */
  var ORIGIN = (function () {
    var src = '';
    if (document.currentScript && document.currentScript.src) {
      src = document.currentScript.src;
    } else {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].src && scripts[i].src.indexOf('/v1/embed.js') !== -1) {
          src = scripts[i].src;
          break;
        }
      }
    }
    var marker = src.indexOf('/v1/embed.js');
    if (marker === -1) return 'https://modafied.org';
    return src.slice(0, marker);
  })();
  var MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  var SANS =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

  function el(tag, styles, text) {
    var node = document.createElement(tag);
    if (styles) node.setAttribute('style', styles);
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function emblemUrl(sourceId, variant) {
    return ORIGIN + '/v1/emblems/' + sourceId + (variant === 'compact' ? '-compact' : '') + '.svg';
  }

  /* Fallback rendering: the emblem, linked to its card. No claim text we would have to invent. */
  function renderPlain(host, sourceId, variant) {
    host.textContent = '';
    var link = el('a');
    link.href = ORIGIN + '/scorecards/' + sourceId;
    link.target = '_blank';
    link.rel = 'noopener';
    var img = el('img');
    img.src = emblemUrl(sourceId, variant);
    img.alt = 'Modafied benchmark emblem for ' + sourceId;
    img.height = variant === 'compact' ? 28 : 112;
    img.setAttribute('loading', 'lazy');
    img.style.display = 'block';
    link.appendChild(img);
    host.appendChild(link);
  }

  /*
   * The subject is not in Modafied's catalog. A directory will ask about feeds we have never
   * benchmarked, and the honest answer is to say so in Modafied's own words rather than leave a
   * broken image that reads as an outage, or worse, let the host page invent a status for us.
   * "Not benchmarked" is a statement about us, not about the feed.
   */
  function renderUnknown(host, sourceId) {
    host.textContent = '';
    var chip = el(
      'span',
      'display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px dashed #9ca3af;' +
        'border-radius:5px;font-family:' + SANS + ';font-size:11px;color:#6b7280;line-height:1.4;'
    );
    chip.appendChild(el('span', 'font-weight:700;letter-spacing:0.08em;color:#4b5563;', 'MODAFIED'));
    chip.appendChild(document.createTextNode('not benchmarked'));
    chip.title =
      'Modafied has not benchmarked "' + sourceId + '". This says nothing about the feed, only ' +
      'that we have no measurement of it.';
    host.appendChild(chip);
  }

  function renderTraced(host, attestation, variant) {
    host.textContent = '';

    var wrap = el('span', 'display:inline-flex;flex-direction:column;gap:4px;font-family:' + SANS + ';');

    var link = el('a');
    link.href = attestation.evidence.scorecard_page_url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.style.display = 'block';
    link.style.lineHeight = '0';

    var img = el('img');
    img.src = attestation.emblem[variant === 'compact' ? 'compact' : 'full'];
    img.alt = attestation.emblem.alt || 'Modafied benchmark emblem';
    img.height = variant === 'compact' ? 28 : 112;
    img.setAttribute('loading', 'lazy');
    img.style.display = 'block';
    link.appendChild(img);
    wrap.appendChild(link);

    /* The trace line. This is the whole point of the script: the claim on the picture and the
       pointer to its evidence arrive together, from the same fetch, on someone else's page. */
    var line = el('span', 'font-size:11px;color:#6b7280;line-height:1.5;');
    line.appendChild(document.createTextNode('trace '));

    var traceLink = el('a', 'font-family:' + MONO + ';color:#374151;', attestation.trace_id);
    traceLink.href = attestation.trace_url;
    traceLink.target = '_blank';
    traceLink.rel = 'noopener';
    line.appendChild(traceLink);

    line.appendChild(
      document.createTextNode(' · method v' + attestation.method_version + ' · ')
    );

    var cardLink = el('a', 'color:#374151;', 'evidence');
    cardLink.href = attestation.evidence.scorecard_page_url;
    cardLink.target = '_blank';
    cardLink.rel = 'noopener';
    line.appendChild(cardLink);

    if (attestation.relationship && attestation.relationship !== 'none') {
      /* Disclosed on the emblem wherever it appears, not only on our own site (I1, I2). */
      line.appendChild(document.createTextNode(' · ' + attestation.relationship));
    }

    wrap.appendChild(line);
    host.appendChild(wrap);
  }

  /*
   * The membership index, fetched at most once per page no matter how many rows are on it. The
   * promise is memoised rather than the result, so a thousand rows mounting in the same tick share
   * one request instead of racing to start a thousand.
   *
   * Resolves to an object of ids for O(1) lookup, or null if we could not get the index at all.
   * Null is not "no subjects": it means we do not know, and the caller falls back to asking per
   * subject, which is what this script did before the index existed. An older deployment of
   * Modafied that has no index.json must not turn every emblem on someone's page into "not
   * benchmarked" - that would be us reporting our own gap as their absence.
   */
  var indexPromise = null;

  function subjectIndex() {
    if (indexPromise) return indexPromise;
    if (typeof fetch !== 'function') {
      indexPromise = Promise.resolve(null);
      return indexPromise;
    }
    indexPromise = fetch(ORIGIN + '/v1/emblems/index.json', {
      credentials: 'omit',
      cache: 'no-cache',
    })
      .then(function (response) {
        if (!response.ok) return null;
        return response.json();
      })
      .then(function (doc) {
        if (!doc || !doc.subjects || typeof doc.subjects.length !== 'number') return null;
        var members = {};
        for (var i = 0; i < doc.subjects.length; i++) members[doc.subjects[i]] = true;
        return members;
      })
      .catch(function () {
        return null;
      });
    return indexPromise;
  }

  /*
   * Defers the per-subject work until the row is close to the viewport. A feed directory is a long
   * page; fetching a claim for a row nobody has scrolled to spends the reader's bandwidth and our
   * request budget on something nobody will read. Where IntersectionObserver is missing we simply
   * do the work now, because a correct emblem late is worse than a correct emblem eagerly.
   */
  var observer = null;

  function whenVisible(host, run) {
    if (typeof IntersectionObserver !== 'function') {
      run();
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver(
        function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (!entries[i].isIntersecting) continue;
            var node = entries[i].target;
            observer.unobserve(node);
            var pending = node.modafiedResolve;
            node.modafiedResolve = null;
            if (pending) pending();
          }
        },
        { rootMargin: '400px 0px' }
      );
    }
    host.modafiedResolve = run;
    observer.observe(host);
  }

  /* Fetches and renders one subject's live claim. Called only for subjects we know we hold, or
     for every subject when the index could not be read. */
  function resolveClaim(host, sourceId, variant) {
    fetch(ORIGIN + '/v1/emblems/' + encodeURIComponent(sourceId) + '.json', {
      credentials: 'omit',
      cache: 'no-cache',
    })
      .then(function (response) {
        /* 404 is an answer, not a failure: this subject is not in the catalog. Distinguished from
           a real outage, because "we have not measured this" and "we are down" must not look the
           same on somebody else's page. */
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('attestation ' + response.status);
        return response.json();
      })
      .then(function (attestation) {
        if (attestation === null) {
          renderUnknown(host, sourceId);
        } else if (attestation && attestation.trace_id && attestation.emblem) {
          renderTraced(host, attestation, variant);
        }
      })
      .catch(function () {
        /* Keep whatever is already rendered. Silent by design: a listing page should not fill its
           console with our outage. */
        if (!host.firstChild) renderPlain(host, sourceId, variant);
      });
  }

  function mount(host) {
    var sourceId = host.getAttribute('data-modafied');
    if (!sourceId || host.getAttribute('data-modafied-mounted') === 'true') return;
    host.setAttribute('data-modafied-mounted', 'true');

    var variant = host.getAttribute('data-modafied-variant') === 'compact' ? 'compact' : 'full';

    if (typeof fetch !== 'function') {
      /* No fetch means no index and no attestation. The linked emblem is still correct and still
         live, because the SVG is regenerated at its URL on every publish. */
      renderPlain(host, sourceId, variant);
      return;
    }

    subjectIndex().then(function (members) {
      if (members && !members[sourceId]) {
        /* Answered from the one index response. No request for this row, and no <img> pointed at
           an emblem that does not exist, which is what used to make a directory page issue a
           thousand failing image requests before settling on the right answer. */
        renderUnknown(host, sourceId);
        return;
      }

      /* Either we know we hold this subject, or we could not read the index and have to ask. Show
         the linked emblem straight away so the row is never blank, then upgrade it to the traced
         rendering when the reader gets near it. */
      renderPlain(host, sourceId, variant);
      whenVisible(host, function () {
        resolveClaim(host, sourceId, variant);
      });
    });
  }

  function mountAll() {
    var hosts = document.querySelectorAll('[data-modafied]');
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }

  window.modafiedEmblems = { mount: mountAll };
})();
