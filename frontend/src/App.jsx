import { useState, useEffect } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { useAppState } from './store/useAppState';
import Sidebar from './components/Sidebar';
import EditorPanel from './components/EditorPanel';
import AIPanel from './components/AIPanel';
import ChatPanel from './components/ChatPanel';
import BottomPanel from './components/BottomPanel';
import TopBar from './components/TopBar';

export default function App() {
  const { state, dispatch, addHistory } = useAppState();
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [aiPanelOpen, setAiPanelOpen]   = useState(true);
  const [rightTab, setRightTab]         = useState('ai'); // 'ai' | 'chat'
  const [isMobile, setIsMobile]         = useState(false);
  const [isTablet, setIsTablet]         = useState(false);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (isTablet) setAiPanelOpen(false);
    if (!isTablet && !isMobile) setAiPanelOpen(true);
  }, [isTablet, isMobile]);

  const RightPanel = (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex border-b border-border flex-shrink-0 bg-card">
        <button
          onClick={() => setRightTab('ai')}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${rightTab === 'ai' ? 'text-accent border-b-2 border-accent' : 'text-gray-500 hover:text-gray-300'}`}
        >
          AI Report
        </button>
        <button
          onClick={() => setRightTab('chat')}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${rightTab === 'chat' ? 'text-accent border-b-2 border-accent' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Chat
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {rightTab === 'ai'
          ? <AIPanel state={state} dispatch={dispatch} />
          : <ChatPanel state={state} />
        }
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-bg">
        <TopBar state={state} dispatch={dispatch} onMenuClick={() => setSidebarOpen(!sidebarOpen)} onAiClick={() => setAiPanelOpen(!aiPanelOpen)} isMobile />
        {sidebarOpen && (
          <div className="absolute inset-0 z-50 bg-bg">
            <Sidebar state={state} dispatch={dispatch} onClose={() => setSidebarOpen(false)} />
          </div>
        )}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden">
            <EditorPanel state={state} dispatch={dispatch} addHistory={addHistory} />
          </div>
          {aiPanelOpen && <div className="h-72 border-t border-border">{RightPanel}</div>}
          <div className="h-48 border-t border-border">
            <BottomPanel state={state} dispatch={dispatch} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      <TopBar
        state={state} dispatch={dispatch}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        onAiClick={() => setAiPanelOpen(!aiPanelOpen)}
        aiPanelOpen={aiPanelOpen} sidebarOpen={sidebarOpen}
      />
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" autoSaveId="main-layout">
          {sidebarOpen && (
            <>
              <Panel id="sidebar" defaultSize={18} minSize={12} maxSize={30}>
                <Sidebar state={state} dispatch={dispatch} />
              </Panel>
              <PanelResizeHandle className="resize-handle" />
            </>
          )}
          <Panel id="center" minSize={30}>
            <PanelGroup direction="vertical" autoSaveId="center-layout">
              <Panel id="editor" defaultSize={60} minSize={30}>
                <EditorPanel state={state} dispatch={dispatch} addHistory={addHistory} />
              </Panel>
              <PanelResizeHandle className="resize-handle-row" />
              <Panel id="bottom" defaultSize={40} minSize={20}>
                <BottomPanel state={state} dispatch={dispatch} />
              </Panel>
            </PanelGroup>
          </Panel>
          {aiPanelOpen && (
            <>
              <PanelResizeHandle className="resize-handle" />
              <Panel id="ai-panel" defaultSize={25} minSize={18} maxSize={40}>
                {RightPanel}
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}