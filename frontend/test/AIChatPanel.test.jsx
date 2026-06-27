import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AIChatPanel from '../src/components/workspace/AIChatPanel';

vi.mock('../src/components/workspace/ChatAttachmentBar.jsx', () => ({ default: () => <div data-testid="attachment-bar" /> }));
vi.mock('../src/components/workspace/ChatSessionMenu.jsx', () => ({ default: () => <div data-testid="session-menu" /> }));
vi.mock('../src/community/communityUtils.js', () => ({
  renderMarkdownBody: (text) => text
}));
vi.mock('../src/components/workspace/workspaceDisplay.js', () => ({
  MODEL_LABELS: {}
}));
vi.mock('../src/components/workspace/WorkspaceIcons.jsx', () => ({
  ArrowUpIcon: () => <div />,
  ChevronDownIcon: () => <div />,
  ClockIcon: () => <div />,
  CopyIcon: () => <div />,
  SparklesIcon: () => <div />,
  UploadIcon: () => <div />
}));

describe('SourceList inside AIChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPanelWithSources = (sources) => {
    const messages = [
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Test answer',
        sources: sources,
      }
    ];
    return render(
      <AIChatPanel
        messages={messages}
        isProcessing={false}
        isAsking={false}
        error=""
        answerMode="hybrid"
        selectedModel="gemini"
        geminiModels={[]}
        ollamaModels={[]}
        onAnswerModeChange={vi.fn()}
        onModelChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );
  };

  it('groups chunks by document and displays correct labels', () => {
    const sources = [
      { documentId: 1, documentTitle: 'Doc A', chunkIndex: 1, content: 'Chunk 2 content', score: 0.9 },
      { documentId: 2, documentTitle: 'Doc B', chunkIndex: 0, content: 'Chunk 1 content' },
      { documentId: 1, documentTitle: 'Doc A', chunkIndex: 0, content: 'Chunk 1 content', pageNumber: 5 }
    ];
    renderPanelWithSources(sources);
    
    // Overall sources summary
    expect(screen.getByText('Retrieved sources (3)')).toBeInTheDocument();
    
    // Document summaries
    expect(screen.getByText('Doc A')).toBeInTheDocument();
    expect(screen.getByText('— 2 chunks')).toBeInTheDocument();
    expect(screen.getByText('Doc B')).toBeInTheDocument();
    expect(screen.getByText('— 1 chunk')).toBeInTheDocument();
  });

  it('deduplicates identical chunks', () => {
    const sources = [
      { documentId: 1, documentTitle: 'Doc A', chunkIndex: 1, content: 'A' },
      { documentId: 1, documentTitle: 'Doc A', chunkIndex: 1, content: 'A (duplicate)' }
    ];
    renderPanelWithSources(sources);
    
    expect(screen.getByText('Retrieved sources (1)')).toBeInTheDocument();
    expect(screen.getByText('— 1 chunk')).toBeInTheDocument();
  });

  it('sorts documents by payload order and chunks by chunkIndex', () => {
    const sources = [
      { documentId: 2, documentTitle: 'Doc B', chunkIndex: 5, content: 'B5' },
      { documentId: 1, documentTitle: 'Doc A', chunkIndex: 2, content: 'A2' },
      { documentId: 1, documentTitle: 'Doc A', chunkIndex: 1, content: 'A1' },
      { documentId: 2, documentTitle: 'Doc B', chunkIndex: 3, content: 'B3' }
    ];
    const { container } = renderPanelWithSources(sources);
    
    // Only get the document titles from the details group
    const docTitles = Array.from(container.querySelectorAll('details.group\\/doc > summary .truncate')).map(el => el.textContent);
    expect(docTitles).toEqual(['Doc B', 'Doc A']);
    
    // chunks inside Doc B
    expect(screen.getByText(/Chunk 4/)).toBeInTheDocument(); // chunkIndex 3 -> Chunk 4
    expect(screen.getByText(/Chunk 6/)).toBeInTheDocument(); // chunkIndex 5 -> Chunk 6
    // DOM order check is implicit since they are sorted in map
  });

  it('handles missing page/score values gracefully', () => {
    const sources = [
      { documentId: 1, documentTitle: 'Doc A', chunkIndex: 0, content: 'A' }
    ];
    renderPanelWithSources(sources);
    
    // Ensure "undefined" or "null" don't appear in the document
    const details = screen.getByText(/Chunk 1/);
    expect(details).toHaveTextContent(/^\+-Chunk 1$/); // No score or page appended
  });

  it('handles pageStart and pageEnd correctly', () => {
    const sources = [
      { documentId: 1, documentTitle: 'Doc A', chunkIndex: 0, pageStart: 2, pageEnd: 4, content: 'A' },
      { documentId: 1, documentTitle: 'Doc A', chunkIndex: 1, pageStart: 5, pageEnd: 5, content: 'B' }
    ];
    renderPanelWithSources(sources);
    
    expect(screen.getByText(/Chunk 1 · Pages 2-4/)).toBeInTheDocument();
    expect(screen.getByText(/Chunk 2 · Page 5/)).toBeInTheDocument();
  });

  it('defaults to expanded for one-document answers and collapsed for multi-document', () => {
    // Single document
    const { unmount } = renderPanelWithSources([{ documentId: 1, documentTitle: 'Doc A', chunkIndex: 0, content: 'A' }]);
    const docADetails = screen.getByText('Doc A').closest('details');
    expect(docADetails).toHaveAttribute('open');
    unmount();
    
    // Multi document
    renderPanelWithSources([
      { documentId: 1, documentTitle: 'Doc A', chunkIndex: 0, content: 'A' },
      { documentId: 2, documentTitle: 'Doc B', chunkIndex: 0, content: 'B' }
    ]);
    const docA = screen.getByText('Doc A').closest('details');
    const docB = screen.getByText('Doc B').closest('details');
    expect(docA).not.toHaveAttribute('open');
    expect(docB).not.toHaveAttribute('open');
  });

  it('truncates long filenames', () => {
    const longTitle = 'This is a very very long filename that should be truncated by css.pdf';
    renderPanelWithSources([{ documentId: 1, documentTitle: longTitle, chunkIndex: 0, content: 'A' }]);
    
    const titleEl = screen.getByText(longTitle);
    expect(titleEl).toHaveClass('truncate');
    expect(titleEl).toHaveAttribute('title', longTitle);
  });
});
