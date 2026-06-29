import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatAttachmentBar from '../src/components/workspace/ChatAttachmentBar.jsx';

function renderBar(props = {}) {
  return render(
    <ChatAttachmentBar
      activeAttachments={[]}
      availableDocuments={[]}
      onAttach={vi.fn()}
      onClearPending={vi.fn()}
      onDeleteAllRecoverable={vi.fn()}
      onDeleteRecoverable={vi.fn()}
      onRemove={vi.fn()}
      onRemoveQueued={vi.fn()}
      onRemoveTemporary={vi.fn()}
      onRestore={vi.fn()}
      onRetryQueued={vi.fn()}
      onSave={vi.fn()}
      onUpload={vi.fn()}
      pendingItems={[]}
      recoverableAttachments={[]}
      sessionId={10}
      uploadProgress={0}
      {...props}
    />
  );
}

describe('ChatAttachmentBar image previews', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders active image attachments with persistent thumbnail URL and lightbox', () => {
    const { container } = renderBar({
      activeAttachments: [{
        id: 2,
        title: 'pasted-image.png',
        fileType: 'IMAGE',
        thumbnailUrl: 'https://example.test/signed-image',
        documentScope: 'session',
        extractionStatus: 'ready',
      }],
    });

    fireEvent.click(screen.getByRole('button', { name: /1 file/i }));

    const previewButton = screen.getByRole('button', { name: /preview pasted-image\.png/i });
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.test/signed-image');

    fireEvent.click(previewButton);
    expect(container.querySelector('[data-image-lightbox]')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'pasted-image.png' }).getAttribute('src')).toBe('https://example.test/signed-image');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-image-lightbox]')).not.toBeInTheDocument();
  });

  it('uses object URLs only for pending local image uploads and revokes them on cleanup', () => {
    const file = new File(['image-bytes'], 'local.png', { type: 'image/png' });
    const { rerender } = renderBar({
      pendingItems: [{
        id: 'queue-1',
        file,
        status: 'uploading',
        progress: 40,
      }],
    });

    fireEvent.click(screen.getByRole('button', { name: /1 file/i }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(screen.getByRole('button', { name: /preview local\.png/i })).toBeInTheDocument();

    rerender(
      <ChatAttachmentBar
        activeAttachments={[]}
        availableDocuments={[]}
        onAttach={vi.fn()}
        onClearPending={vi.fn()}
        onDeleteAllRecoverable={vi.fn()}
        onDeleteRecoverable={vi.fn()}
        onRemove={vi.fn()}
        onRemoveQueued={vi.fn()}
        onRemoveTemporary={vi.fn()}
        onRestore={vi.fn()}
        onRetryQueued={vi.fn()}
        onSave={vi.fn()}
        onUpload={vi.fn()}
        pendingItems={[]}
        recoverableAttachments={[]}
        sessionId={10}
        uploadProgress={0}
      />
    );

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-preview');
  });

  it('falls back to IMG badge when an active image has no preview URL', () => {
    renderBar({
      activeAttachments: [{
        id: 2,
        title: 'pasted-image.png',
        fileType: 'IMAGE',
        thumbnailUrl: null,
        documentScope: 'session',
        extractionStatus: 'ready',
      }],
    });

    fireEvent.click(screen.getByRole('button', { name: /1 file/i }));
    expect(screen.queryByRole('button', { name: /preview pasted-image\.png/i })).not.toBeInTheDocument();
    expect(screen.getByText('IMG')).toBeInTheDocument();
  });
});
