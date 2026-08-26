import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dataContributionGuideUrl, FeedbackCard } from './GlobalLcaAsset';

describe('feedback contribution links', () => {
  it('offers the GitHub pull-request guide alongside the feedback form', () => {
    const markup = renderToStaticMarkup(<FeedbackCard />);

    expect(dataContributionGuideUrl).toBe(
      'https://github.com/jianchuanqi/global-lca-asset/blob/main/docs/data-update-example.md',
    );
    expect(markup).toContain(`href="${dataContributionGuideUrl}"`);
    expect(markup).toContain('Contribute data via GitHub PR');
    expect(markup).toContain('Send comment or feedback');
    expect(markup).toContain('View Git project');
  });
});
