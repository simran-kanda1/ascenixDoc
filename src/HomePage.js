import React from 'react';

function HomePage({ onSelectTemplate }) {
  const templates = [
    {
      id: 'v2_0_without_pilot',
      name: 'v2.0 Without Pilot',
      description: 'User Agreement Template'
    },
    {
      id: 'with_pilot',
      name: 'With Pilot Agreement',
      description: 'Pilot Agreement Template'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            Ascenix Document Tool
          </h1>
          <p className="text-xl text-gray-600">
            Select a template to edit
          </p>
        </div>

        {/* Template Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => onSelectTemplate(template.id, template.name)}
              className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1 p-6"
            >
              <div className="flex flex-col h-full">
                {/* Icon */}
                <div className="mb-4">
                  <svg
                    className="w-16 h-16 text-indigo-600 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-gray-800 mb-2 text-center">
                  {template.name}
                </h3>
                <p className="text-gray-600 text-center mb-4 flex-grow">
                  {template.description}
                </p>

                {/* Button */}
                <button className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-200 font-medium">
                  Edit Template
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Click on a template card to begin editing</p>
        </div>
      </div>
    </div>
  );
}

export default HomePage;