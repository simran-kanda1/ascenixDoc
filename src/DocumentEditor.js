import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './config';

function DocumentEditor({ template, onBack }) {
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);

  // Form state
  const [replaceFall, setReplaceFall] = useState('');
  const [currencyCountry, setCurrencyCountry] = useState('');
  const [homeLegalName, setHomeLegalName] = useState('');
  const [homeLocation, setHomeLocation] = useState('');
  const [quarterlyStartDate, setQuarterlyStartDate] = useState('');
  const [quarterlyEndDate, setQuarterlyEndDate] = useState('');
  const [pricingRows, setPricingRows] = useState([
    { description: '', fee: '' }
  ]);

  const handleAddRow = () => {
    setPricingRows([...pricingRows, { description: '', fee: '' }]);
  };

  const handleRemoveRow = (index) => {
    const newRows = pricingRows.filter((_, i) => i !== index);
    setPricingRows(newRows);
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...pricingRows];
    newRows[index][field] = value;
    setPricingRows(newRows);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDownloadUrl(null);

    try {
      const functions = getFunctions(app);
      const processDocument = httpsCallable(functions, 'processDocument');

      const edits = {
        replaceFall: replaceFall || undefined,
        currencyCountry: currencyCountry || undefined,
        homeLegalName: homeLegalName || undefined,
        homeLocation: homeLocation || undefined,
        quarterlyStartDate: quarterlyStartDate || undefined,
        quarterlyEndDate: quarterlyEndDate || undefined,
        pricingRows: pricingRows.filter(row => row.description && row.fee)
      };

      const result = await processDocument({
        templateId: template.id,
        edits
      });

      if (result.data.success) {
        setDownloadUrl(result.data.downloadUrl);
      }
    } catch (err) {
      console.error('Error processing document:', err);
      setError(err.message || 'Failed to process document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center text-indigo-600 hover:text-indigo-800 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Templates
          </button>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            {template.name}
          </h1>
          <p className="text-gray-600">
            Fill in the fields below to customize your document
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
          {/* Replace Fall/Fall */}
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-2">
              Replace "Fall" / "fall" with:
            </label>
            <input
              type="text"
              value={replaceFall}
              onChange={(e) => setReplaceFall(e.target.value)}
              placeholder="e.g., Behaviours, Analysis, etc."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              This will replace all instances of "Fall " or "fall " in the document
            </p>
          </div>

          {/* Currency Country */}
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-2">
              Currency Country:
            </label>
            <input
              type="text"
              value={currencyCountry}
              onChange={(e) => setCurrencyCountry(e.target.value)}
              placeholder="e.g., US dollars, British pounds, etc."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Replaces "Fees are in Canadian dollars"
            </p>
          </div>

          {/* Home Legal Name */}
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-2">
              Home Legal Name:
            </label>
            <input
              type="text"
              value={homeLegalName}
              onChange={(e) => setHomeLegalName(e.target.value)}
              placeholder="e.g., ABC Healthcare Inc."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Replaces "Responsive Health Management Inc."
            </p>
          </div>

          {/* Home Location */}
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-2">
              Home Location:
            </label>
            <input
              type="text"
              value={homeLocation}
              onChange={(e) => setHomeLocation(e.target.value)}
              placeholder="e.g., 123 Main St, City, Province/State, Postal Code"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Replaces "33 Christie Street, Toronto, ON M6G3B1"
            </p>
          </div>

          {/* Quarterly Filing Cycle */}
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-3">
              Quarterly Filing Cycle (Section 3.3):
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-600 text-sm mb-1">Start Date:</label>
                <input
                  type="date"
                  value={quarterlyStartDate}
                  onChange={(e) => setQuarterlyStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm mb-1">End Date:</label>
                <input
                  type="date"
                  value={quarterlyEndDate}
                  onChange={(e) => setQuarterlyEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Updates the billing cycle dates in section 3.3
            </p>
          </div>

          {/* Pricing Table */}
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-3">
              Pricing Table:
            </label>
            <div className="space-y-3">
              {pricingRows.map((row, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-grow">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) => handleRowChange(index, 'description', e.target.value)}
                      placeholder="Description (e.g., 0 - 750)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="w-1/3">
                    <input
                      type="text"
                      value={row.fee}
                      onChange={(e) => handleRowChange(index, 'fee', e.target.value)}
                      placeholder="Fee (e.g., $0.10)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {pricingRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(index)}
                      className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddRow}
              className="mt-3 flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Row
            </button>
            <p className="text-sm text-gray-500 mt-2">
              Add or remove rows to customize the pricing table
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Success Message with Download */}
          {downloadUrl && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 mb-3">Document processed successfully!</p>
              <a
                href={downloadUrl}
                download
                className="inline-block px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Download Document
              </a>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              'Generate Document'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default DocumentEditor;