import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AIChatPanel from '../src/components/workspace/AIChatPanel';

vi.mock('../src/components/workspace/ChatAttachmentBar.jsx', () => ({ default: () => <div /> }));
vi.mock('../src/components/workspace/ChatSessionMenu.jsx', () => ({ default: () => <div /> }));
vi.mock('../src/community/communityUtils.js', () => ({ renderMarkdownBody: (t) => t }));
vi.mock('../src/components/workspace/workspaceDisplay.js', () => ({ MODEL_LABELS: {} }));
vi.mock('../src/components/workspace/WorkspaceIcons.jsx', () => ({
  ArrowUpIcon: () => <div />,
  ChevronDownIcon: () => <div />,
  ClockIcon: () => <div />,
  CopyIcon: () => <div />,
  SparklesIcon: () => <div />,
  UploadIcon: () => <div />
}));

describe('AIChatPanel Paste Image Support', () => {
  const mockOnDropFiles = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPanel = () => {
    return render(
      <AIChatPanel
        messages={[]}
        selectedDocument={{ id: 1 }}
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
        onDropFiles={mockOnDropFiles}
        onQuestionChange={vi.fn()}
        question=""
      />
    );
  };

  const createMockPasteEvent = (itemsData) => {
    const items = itemsData.map(data => ({
      type: data.type,
      kind: data.kind || (data.type.startsWith('image/') ? 'file' : 'string'),
      getAsFile: () => {
        if (data.type.startsWith('image/')) {
          const file = new File([new Blob(['test'])], 'test.png', { type: data.type });
          return file;
        }
        return null;
      }
    }));
    return {
      clipboardData: {
        items
      },
      preventDefault: vi.fn(),
    };
  };

  it('image clipboard item enters the existing queue via onDropFiles', () => {
    renderPanel();
    const textarea = screen.getByPlaceholderText('Ask any question...');
    
    const pasteEvent = createMockPasteEvent([{ type: 'image/png' }]);
    fireEvent.paste(textarea, pasteEvent);

    expect(mockOnDropFiles).toHaveBeenCalledTimes(1);
    const files = mockOnDropFiles.mock.calls[0][0];
    expect(files.length).toBe(1);
    expect(files[0].type).toBe('image/png');
    expect(files[0].name).toMatch(/^pasted-image-\d{8}-\d{6}\.png$/);
  });

  it('multiple pasted images are queued sequentially', () => {
    renderPanel();
    const textarea = screen.getByPlaceholderText('Ask any question...');
    
    const pasteEvent = createMockPasteEvent([{ type: 'image/png' }, { type: 'image/jpeg' }]);
    fireEvent.paste(textarea, pasteEvent);

    expect(mockOnDropFiles).toHaveBeenCalledTimes(1);
    const files = mockOnDropFiles.mock.calls[0][0];
    expect(files.length).toBe(2);
    expect(files[0].name).toMatch(/^pasted-image-\d{8}-\d{6}-0\.png$/);
    expect(files[1].name).toMatch(/^pasted-image-\d{8}-\d{6}-1\.jpeg$/);
  });

  it('plain text paste remains unchanged', () => {
    renderPanel();
    const textarea = screen.getByPlaceholderText('Ask any question...');
    
    const pasteEvent = createMockPasteEvent([{ type: 'text/plain' }]);
    fireEvent.paste(textarea, pasteEvent);

    expect(mockOnDropFiles).not.toHaveBeenCalled();
  });

  it('mixed text and image clipboard data preserves text and queues images', () => {
    renderPanel();
    const textarea = screen.getByPlaceholderText('Ask any question...');
    
    const pasteEvent = createMockPasteEvent([{ type: 'text/plain' }, { type: 'image/png' }]);
    fireEvent.paste(textarea, pasteEvent);

    expect(mockOnDropFiles).toHaveBeenCalledTimes(1);
    const files = mockOnDropFiles.mock.calls[0][0];
    expect(files.length).toBe(1);
  });

  it('unsupported clipboard types are ignored', () => {
    renderPanel();
    const textarea = screen.getByPlaceholderText('Ask any question...');
    
    const pasteEvent = createMockPasteEvent([{ type: 'image/gif' }, { type: 'application/pdf' }]);
    fireEvent.paste(textarea, pasteEvent);

    expect(mockOnDropFiles).not.toHaveBeenCalled();
  });

});
