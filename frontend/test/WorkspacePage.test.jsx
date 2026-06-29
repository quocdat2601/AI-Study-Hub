import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import WorkspacePage from '../src/pages/WorkspacePage';
import { listDocuments } from '../src/services/documentApi';
import { listSharedDocuments } from '../src/services/chatApi';

vi.mock('../src/components/workspace/DocumentSidebar.jsx', () => ({
  default: ({ documents, selectedId, onSelectDocument }) => (
    <div data-testid="sidebar">
      <div data-testid="selected-id">{selectedId}</div>
      {documents.map((doc) => (
        <button key={doc.id} onClick={() => onSelectDocument(doc.id)} data-testid={`select-${doc.id}`}>
          {doc.title}
        </button>
      ))}
    </div>
  )
}));
vi.mock('../src/components/workspace/DocumentViewer.jsx', () => ({ default: () => <div data-testid="viewer" /> }));
vi.mock('../src/components/workspace/AIChatPanel.jsx', () => ({ default: () => <div data-testid="chat" /> }));
vi.mock('../src/components/workspace/WorkspaceResizeHandle.jsx', () => ({ default: () => <div /> }));

vi.mock('../src/services/documentApi.js', () => ({
  listDocuments: vi.fn()
}));
vi.mock('../src/services/chatApi.js', () => ({
  listSharedDocuments: vi.fn(() => Promise.resolve({ documents: [] })),
  listChatSessions: vi.fn(() => Promise.resolve({ sessions: [] })),
  getOrCreateDocumentChatSession: vi.fn(() => Promise.resolve({ id: 1 })),
  getChatSessionMessages: vi.fn(() => Promise.resolve({ messages: [], session: { id: 1, primaryDocumentId: 1 } }))
}));
vi.mock('../src/services/aiApi.js', () => ({
  getAiModelStatus: vi.fn(() => Promise.resolve({ gemini: { models: [] }, ollama: { allowedModels: [] } })),
  getAiUsage: vi.fn(() => Promise.resolve({}))
}));
vi.mock('../src/services/workspaceApi.js', () => ({
  fetchWorkspacePdf: vi.fn(() => Promise.resolve(new ArrayBuffer(8)))
}));

// A helper to observe the current URL
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

// A helper to test browser Back/Forward (MemoryRouter doesn't expose history easily to userEvent,
// so we use a custom wrapper with buttons to navigate).
function NavigationButtons() {
  const navigate = useNavigate();
  return (
    <div>
      <button data-testid="btn-back" onClick={() => navigate(-1)}>Back</button>
      <button data-testid="btn-forward" onClick={() => navigate(1)}>Forward</button>
    </div>
  );
}

function renderWorkspace(initialEntries = ["/workspace"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/workspace" element={<><WorkspacePage /><LocationDisplay /><NavigationButtons /></>} />
        <Route path="/workspace/documents/:documentId" element={<><WorkspacePage /><LocationDisplay /><NavigationButtons /></>} />
      </Routes>
    </MemoryRouter>
  );
}

import { cacheWorkspaceState } from '../src/utils/workspaceCache';

describe('WorkspacePage URL Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock localStorage
    const store = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, value) => { store[key] = String(value); }),
        clear: vi.fn(() => { Object.keys(store).forEach(key => delete store[key]); }),
        removeItem: vi.fn((key) => { delete store[key]; })
      },
      writable: true,
      configurable: true
    });
    
    window.localStorage.clear();
    
    // Reset workspace cache since it's a singleton
    cacheWorkspaceState({
      documents: null,
      selectedId: null,
      availableModels: null,
      modelStatus: null,
      usage: null
    });
  });

  it('no-document empty state: stays on /workspace when no documents exist', async () => {
    listDocuments.mockResolvedValueOnce([]);
    renderWorkspace(['/workspace']);

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/workspace');
    });
    // Sidebar should be empty
    expect(screen.queryByTestId('select-1')).toBeNull();
  });

  it('fallback behavior: /workspace redirects to first document when loaded', async () => {
    listDocuments.mockResolvedValueOnce([
      { id: 10, title: 'Doc 10' },
      { id: 20, title: 'Doc 20' }
    ]);
    renderWorkspace(['/workspace']);

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/workspace/documents/10');
      expect(screen.getByTestId('selected-id')).toHaveTextContent('10');
    });
  });

  it('last-opened fallback: /workspace redirects to lastOpenedDocumentId from localStorage', async () => {
    window.localStorage.setItem('aiStudyHub.workspace.lastOpenedDocumentId', '20');
    cacheWorkspaceState({ selectedId: 20 });
    listDocuments.mockResolvedValueOnce([
      { id: 10, title: 'Doc 10' },
      { id: 20, title: 'Doc 20' }
    ]);
    renderWorkspace(['/workspace']);

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/workspace/documents/20');
      expect(screen.getByTestId('selected-id')).toHaveTextContent('20');
    });
  });

  it('direct URL load: loads the specified document', async () => {
    listDocuments.mockResolvedValueOnce([
      { id: 10, title: 'Doc 10' },
      { id: 20, title: 'Doc 20' }
    ]);
    renderWorkspace(['/workspace/documents/20']);

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/workspace/documents/20');
      expect(screen.getByTestId('selected-id')).toHaveTextContent('20');
    });
  });

  it('invalid document fallback: redirects to next valid document', async () => {
    listDocuments.mockResolvedValueOnce([
      { id: 10, title: 'Doc 10' },
      { id: 20, title: 'Doc 20' }
    ]);
    renderWorkspace(['/workspace/documents/999']);

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/workspace/documents/10');
    });
  });

  it('click updates URL: selecting a document navigates to its URL', async () => {
    listDocuments.mockResolvedValue([
      { id: 10, title: 'Doc 10' },
      { id: 20, title: 'Doc 20' }
    ]);
    renderWorkspace(['/workspace/documents/10']);

    await waitFor(() => {
      expect(screen.getByTestId('selected-id')).toHaveTextContent('10');
    });

    await userEvent.click(screen.getByTestId('select-20'));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/workspace/documents/20');
      expect(screen.getByTestId('selected-id')).toHaveTextContent('20');
    });
  });

  it('Back/Forward navigation: changes selected document', async () => {
    listDocuments.mockResolvedValue([
      { id: 10, title: 'Doc 10' },
      { id: 20, title: 'Doc 20' }
    ]);
    renderWorkspace(['/workspace/documents/10']);

    await waitFor(() => {
      expect(screen.getByTestId('selected-id')).toHaveTextContent('10');
    });

    await userEvent.click(screen.getByTestId('select-20'));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/workspace/documents/20');
    });

    // Go back
    await userEvent.click(screen.getByTestId('btn-back'));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/workspace/documents/10');
      expect(screen.getByTestId('selected-id')).toHaveTextContent('10');
    });
  });
});
