import React, { useState } from 'react';
import './App.css';
import HomePage from './HomePage';
import DocumentEditor from './DocumentEditor';
import DocumentEditorWithPilot from './DocumentEditorWithPilot';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const handleSelectTemplate = (templateId, templateName) => {
    setSelectedTemplate({ id: templateId, name: templateName });
    setCurrentView('editor');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedTemplate(null);
  };

  return (
    <div className="App">
      {currentView === 'home' ? (
        <HomePage onSelectTemplate={handleSelectTemplate} />
      ) : (
        <DocumentEditor 
          template={selectedTemplate}
          onBack={handleBackToHome}
        />
      )}
    </div>
  );
}

export default App;