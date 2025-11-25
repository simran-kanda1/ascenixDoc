import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './config';

function DocumentEditor({ template, onBack }) {
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);

  // ============================================================================
  // V2.0 WITHOUT PILOT - Form State
  // ============================================================================
  const [replaceFall, setReplaceFall] = useState('');
  const [replaceFallyx, setReplaceFallyx] = useState('Ascenix');
  const [currencyCountry, setCurrencyCountry] = useState('');
  const [homeLegalName, setHomeLegalName] = useState('');
  const [homeLocation, setHomeLocation] = useState('');
  const [section33Text, setSection33Text] = useState('3.3. Fallyx shall invoice the Client quarterly. The initial billing period shall run from December 1, 2025, to December 31, 2025. Thereafter, quarterly billing shall begin on January 1, 2026, and continue on January 1, April 1, July 1, and October 1 each year. If the Agreement becomes effective on a date other than the first of a month, the first payment shall be prorated based on the number of days from the Effective Date to the last day of that month. For greater certainty, the first day of the following month shall be deemed the start date of the first quarterly billing cycle.');
  const [pricingRows, setPricingRows] = useState([
    { description: '', fee: '' }
  ]);
  const [facilityRowsV2, setFacilityRowsV2] = useState([
    { facilityName: '', group: '', bedCount: '' }
  ]);

  // ============================================================================
  // WITH PILOT - Form State
  // ============================================================================
  const [replaceFallPilot, setReplaceFallPilot] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('01/01/2026');
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [currencyCountryPilot, setCurrencyCountryPilot] = useState('United States');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [terminationDate, setTerminationDate] = useState('02/28/2026');
  const [feeRows, setFeeRows] = useState([
    { bedCount: '', location: '', feePerBed: '' }
  ]);
  const [facilityRowsPilot, setFacilityRowsPilot] = useState([
    { facilityName: '', bedCount: '' }
  ]);

  // ============================================================================
  // V2.0 WITHOUT PILOT - Handlers
  // ============================================================================
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

  const handleAddFacilityRow = () => {
    setFacilityRowsV2([...facilityRowsV2, { facilityName: '', group: '', bedCount: '' }]);
  };

  const handleRemoveFacilityRow = (index) => {
    const newRows = facilityRowsV2.filter((_, i) => i !== index);
    setFacilityRowsV2(newRows);
  };

  const handleFacilityRowChange = (index, field, value) => {
    const newRows = [...facilityRowsV2];
    newRows[index][field] = value;
    setFacilityRowsV2(newRows);
  };

  // ============================================================================
  // WITH PILOT - Handlers
  // ============================================================================
  const handleAddFeeRow = () => {
    setFeeRows([...feeRows, { bedCount: '', location: '', feePerBed: '' }]);
  };

  const handleRemoveFeeRow = (index) => {
    if (feeRows.length > 1) {
      const newRows = feeRows.filter((_, i) => i !== index);
      setFeeRows(newRows);
    }
  };

  const handleFeeRowChange = (index, field, value) => {
    const newRows = [...feeRows];
    newRows[index][field] = value;
    setFeeRows(newRows);
  };

  const handleAddFacilityRowPilot = () => {
    setFacilityRowsPilot([...facilityRowsPilot, { facilityName: '', bedCount: '' }]);
  };

  const handleRemoveFacilityRowPilot = (index) => {
    if (facilityRowsPilot.length > 1) {
      const newRows = facilityRowsPilot.filter((_, i) => i !== index);
      setFacilityRowsPilot(newRows);
    }
  };

  const handleFacilityRowChangePilot = (index, field, value) => {
    const newRows = [...facilityRowsPilot];
    newRows[index][field] = value;
    setFacilityRowsPilot(newRows);
  };

  // ============================================================================
  // Submit Handler - Routes to appropriate Cloud Function
  // ============================================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDownloadUrl(null);

    try {
      const functions = getFunctions(app);

      if (template.id === 'v2_0_without_pilot') {
        // Call V2.0 Cloud Function
        const processDocument = httpsCallable(functions, 'processDocument');

        const edits = {
          replaceFall: replaceFall || undefined,
          replaceFallyx: replaceFallyx || undefined,
          currencyCountry: currencyCountry || undefined,
          homeLegalName: homeLegalName || undefined,
          homeLocation: homeLocation || undefined,
          section33Text: section33Text || undefined,
          pricingRows: pricingRows.filter(row => row.description && row.fee),
          facilityRows: facilityRowsV2.filter(row => row.facilityName || row.group || row.bedCount)
        };

        const result = await processDocument({
          templateId: template.id,
          edits
        });

        if (result.data.success) {
          setDownloadUrl(result.data.downloadUrl);
        }
      } else if (template.id === 'with_pilot') {
        // Call With Pilot Cloud Function
        const processWithPilotDocument = httpsCallable(functions, 'processWithPilotDocument');

        const edits = {
          replaceFall: replaceFallPilot || undefined,
          effectiveDate: effectiveDate || undefined,
          clientName: clientName || undefined,
          clientAddress: clientAddress || undefined,
          currencyCountry: currencyCountryPilot || undefined,
          currencyCode: currencyCode || undefined,
          terminationDate: terminationDate || undefined,
          feeRows: feeRows.filter(row => row.bedCount || row.location || row.feePerBed),
          facilityRows: facilityRowsPilot.filter(row => row.facilityName || row.bedCount)
        };

        const result = await processWithPilotDocument({
          templateId: template.id,
          edits
        });

        if (result.data.success) {
          setDownloadUrl(result.data.downloadUrl);
        }
      }
    } catch (err) {
      console.error('Error processing document:', err);
      setError(err.message || 'Failed to process document');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // Conditional Form Rendering Based on Template
  // ============================================================================
  const isWithPilot = template.id === 'with_pilot';
  const isV2 = template.id === 'v2_0_without_pilot';

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
          <h1 className="text-4xl font-bold text-gray-800 mb-2">{template.name}</h1>
          <p className="text-gray-600">Fill in the fields below to generate your customized document</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
          
          {/* ====================================================================
              V2.0 WITHOUT PILOT FORM FIELDS
              ==================================================================== */}
          {isV2 && (
            <>
              {/* Replace Fall */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Replace "Fall"/"fall" with (optional):
                </label>
                <input
                  type="text"
                  value={replaceFall}
                  onChange={(e) => setReplaceFall(e.target.value)}
                  placeholder="e.g., Behaviours, Analysis (leave empty to keep 'Fall')"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Replace Fallyx */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Replace "Fallyx"/"fallyx" with:
                </label>
                <input
                  type="text"
                  value={replaceFallyx}
                  onChange={(e) => setReplaceFallyx(e.target.value)}
                  placeholder="Default: Ascenix"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Currency Country */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency Country:
                </label>
                <input
                  type="text"
                  value={currencyCountry}
                  onChange={(e) => setCurrencyCountry(e.target.value)}
                  placeholder="e.g., United States, Canada"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Home Legal Name */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Home Legal Name:
                </label>
                <input
                  type="text"
                  value={homeLegalName}
                  onChange={(e) => setHomeLegalName(e.target.value)}
                  placeholder="Replace 'Responsive Health Management Inc.'"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Home Location */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Home Location:
                </label>
                <input
                  type="text"
                  value={homeLocation}
                  onChange={(e) => setHomeLocation(e.target.value)}
                  placeholder="Replace '33 Christie Street, Toronto, ON M6G3B1'"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Section 3.3 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Section 3.3 - Billing Terms:
                </label>
                <textarea
                  value={section33Text}
                  onChange={(e) => setSection33Text(e.target.value)}
                  rows="6"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Pricing Table */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Pricing Table:
                </label>
                {pricingRows.map((row, index) => (
                  <div key={index} className="mb-3 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => handleRowChange(index, 'description', e.target.value)}
                          placeholder="Description"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={row.fee}
                          onChange={(e) => handleRowChange(index, 'fee', e.target.value)}
                          placeholder="Fee"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        {pricingRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(index)}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  + Add Row
                </button>
              </div>

              {/* Facility Table */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Facility Table (Schedule A):
                </label>
                {facilityRowsV2.map((row, index) => (
                  <div key={index} className="mb-3 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          value={row.facilityName}
                          onChange={(e) => handleFacilityRowChange(index, 'facilityName', e.target.value)}
                          placeholder="Facility Name"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <input
                        type="text"
                        value={row.group}
                        onChange={(e) => handleFacilityRowChange(index, 'group', e.target.value)}
                        placeholder="Group"
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={row.bedCount}
                          onChange={(e) => handleFacilityRowChange(index, 'bedCount', e.target.value)}
                          placeholder="Bed Count"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        {facilityRowsV2.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFacilityRow(index)}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddFacilityRow}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  + Add Row
                </button>
              </div>
            </>
          )}

          {/* ====================================================================
              WITH PILOT FORM FIELDS
              ==================================================================== */}
          {isWithPilot && (
            <>
              {/* Replace Fall */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Replace "Fall"/"fall" with (optional):
                </label>
                <input
                  type="text"
                  value={replaceFallPilot}
                  onChange={(e) => setReplaceFallPilot(e.target.value)}
                  placeholder="e.g., Behaviours, Analysis (leave empty to keep 'Fall')"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Effective Date */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Effective Date:
                </label>
                <input
                  type="text"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  placeholder="MM/DD/YYYY"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">Format: MM/DD/YYYY (e.g., 01/01/2026)</p>
              </div>

              {/* Client Name */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Name:
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Replace 'Relavix Health Group LLC'"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Client Address */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Address:
                </label>
                <input
                  type="text"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Replace '[Insert Address Here]'"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Currency Country */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency Country:
                </label>
                <input
                  type="text"
                  value={currencyCountryPilot}
                  onChange={(e) => setCurrencyCountryPilot(e.target.value)}
                  placeholder="e.g., United States, Canada"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Currency Code */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency Code:
                </label>
                <input
                  type="text"
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                  placeholder="e.g., USD, CAD, EUR"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Termination Date */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Termination Date (Section 4.1):
                </label>
                <input
                  type="text"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                  placeholder="MM/DD/YYYY"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">Format: MM/DD/YYYY (e.g., 02/28/2026)</p>
              </div>

              {/* Fee Table */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Fee Table (Section 3.1):
                </label>
                {feeRows.map((row, index) => (
                  <div key={index} className="mb-3 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <input
                        type="text"
                        value={row.bedCount}
                        onChange={(e) => handleFeeRowChange(index, 'bedCount', e.target.value)}
                        placeholder="Total # of Beds"
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={row.location}
                        onChange={(e) => handleFeeRowChange(index, 'location', e.target.value)}
                        placeholder="Facility Location"
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={row.feePerBed}
                        onChange={(e) => handleFeeRowChange(index, 'feePerBed', e.target.value)}
                        placeholder="Fee / Bed / Day"
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFeeRow(index)}
                        disabled={feeRows.length === 1}
                        className={`px-4 py-2 rounded-lg ${
                          feeRows.length === 1
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-red-500 text-white hover:bg-red-600'
                        }`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddFeeRow}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  + Add Row
                </button>
              </div>

              {/* Facility Table */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Facility Table (Schedule A - Second Last Page):
                </label>
                {facilityRowsPilot.map((row, index) => (
                  <div key={index} className="mb-3 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          value={row.facilityName}
                          onChange={(e) => handleFacilityRowChangePilot(index, 'facilityName', e.target.value)}
                          placeholder="Facility Name"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={row.bedCount}
                          onChange={(e) => handleFacilityRowChangePilot(index, 'bedCount', e.target.value)}
                          placeholder="Bed Count"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveFacilityRowPilot(index)}
                          disabled={facilityRowsPilot.length === 1}
                          className={`px-4 py-2 rounded-lg ${
                            facilityRowsPilot.length === 1
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-red-500 text-white hover:bg-red-600'
                          }`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddFacilityRowPilot}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  + Add Row
                </button>
              </div>
            </>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-white ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? 'Processing...' : 'Generate Document'}
          </button>

          {/* Download Link */}
          {downloadUrl && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-semibold mb-3">✓ Document generated successfully!</p>
              <a
                href={downloadUrl}
                download
                className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
              >
                Download Document
              </a>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default DocumentEditor;