import React, { useEffect } from 'react';
import { Tree } from './components/Tree/Tree';
import { sampleDocument } from './data/sampleData';
import { useTreeStore } from './store/treeStore';
import './App.css';

function App() {
  const initialize = useTreeStore((state) => state.actions.initialize);

  useEffect(() => {
    initialize(
      sampleDocument.nodes,
      sampleDocument.rootNodeId,
      sampleDocument.nodeTypeConfig || {}
    );
  }, [initialize]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Arborescent</h1>
        <p>Development workflow tool</p>
      </header>

      <main className="app-main">
        <div className="app-content">
          <Tree />
        </div>
      </main>
    </div>
  );
}

export default App;
