import React from 'react';
import { Tree } from './components/Tree/Tree';
import { sampleDocument } from './data/sampleData';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Arborescent</h1>
        <p>Development workflow tool</p>
      </header>

      <main className="app-main">
        <div className="app-content">
          <Tree document={sampleDocument} />
        </div>
      </main>
    </div>
  );
}

export default App;
