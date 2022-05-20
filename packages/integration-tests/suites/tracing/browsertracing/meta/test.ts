import { expect } from '@playwright/test';
import { Event, EventEnvelopeHeaders } from '@sentry/types';

import { sentryTest } from '../../../../utils/fixtures';
import { envelopeHeaderRequestParser, getFirstSentryEnvelopeRequest } from '../../../../utils/helpers';

sentryTest(
  'should create a pageload transaction based on `sentry-trace` <meta>',
  async ({ getLocalTestPath, page }) => {
    const url = await getLocalTestPath({ testDir: __dirname });

    const eventData = await getFirstSentryEnvelopeRequest<Event>(page, url);

    expect(eventData.contexts?.trace).toMatchObject({
      op: 'pageload',
      parent_span_id: '1121201211212012',
      trace_id: '12312012123120121231201212312012',
    });

    expect(eventData.spans?.length).toBeGreaterThan(0);
  },
);

// TODO this we can't really test until we actually propagate sentry- entries in baggage
// skipping for now but this must be adjusted later on
sentryTest.skip(
  'should pick up `baggage` <meta> tag and propagate the content in transaction',
  async ({ getLocalTestPath, page }) => {
    const url = await getLocalTestPath({ testDir: __dirname });

    const envHeader = await getFirstSentryEnvelopeRequest<EventEnvelopeHeaders>(page, url, envelopeHeaderRequestParser);

    expect(envHeader.baggage).toBeDefined();
    expect(envHeader.baggage).toEqual('{version:2.1.12}');
  },
);

sentryTest(
  "should create a navigation that's not influenced by `sentry-trace` <meta>",
  async ({ getLocalTestPath, page }) => {
    const url = await getLocalTestPath({ testDir: __dirname });

    const pageloadRequest = await getFirstSentryEnvelopeRequest<Event>(page, url);
    const navigationRequest = await getFirstSentryEnvelopeRequest<Event>(page, `${url}#foo`);

    expect(pageloadRequest.contexts?.trace).toMatchObject({
      op: 'pageload',
      parent_span_id: '1121201211212012',
      trace_id: '12312012123120121231201212312012',
    });

    expect(navigationRequest.contexts?.trace.op).toBe('navigation');
    expect(navigationRequest.contexts?.trace.trace_id).toBeDefined();
    expect(navigationRequest.contexts?.trace.trace_id).not.toBe(pageloadRequest.contexts?.trace.trace_id);

    const pageloadSpans = pageloadRequest.spans;
    const navigationSpans = navigationRequest.spans;

    const pageloadSpanId = pageloadRequest.contexts?.trace.span_id;
    const navigationSpanId = navigationRequest.contexts?.trace.span_id;

    expect(pageloadSpanId).toBeDefined();
    expect(navigationSpanId).toBeDefined();

    pageloadSpans?.forEach(span =>
      expect(span).toMatchObject({
        parent_span_id: pageloadSpanId,
      }),
    );

    navigationSpans?.forEach(span =>
      expect(span).toMatchObject({
        parent_span_id: navigationSpanId,
      }),
    );
  },
);
