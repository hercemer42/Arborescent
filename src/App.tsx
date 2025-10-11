import React from 'react';
import { Tree } from './components/Tree/Tree';
import { sampleDocument } from './data/sampleData';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Arborescent</h1>
            <p className="text-sm text-gray-600">Development workflow tool</p>
          </div>
          <div className="text-xs text-gray-500">v0.1 MVP</div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto max-w-6xl py-6">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 min-h-[600px]">
          <Tree document={sampleDocument} />
        </div>
      </main>
    </div>
  );
}

export default App;
