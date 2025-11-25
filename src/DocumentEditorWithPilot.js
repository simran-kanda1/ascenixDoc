import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { storage, functions } from './config';

function DocumentEditorWithPilot() {
  const [file, setFile] = useState(null);
  const [replaceFall, setReplaceFall] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('01/01/2026');
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [currencyCountry, setCurrencyCountry] = useState('United States');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [terminationDate, setTerminationDate] = useState('02/28/2026');
  const [feeRows, setFeeRows] = useState([
    { bedCount: '', location: '', feePerBed: '' }
  ]);
  const [facilityRows, setFacilityRows] = useState([
    { facilityName: '', bedCount: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.name.endsWith('.docx')) {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please select a valid .docx file');
      setFile(null);
    }
  };

  // Fee table row handlers
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

  // Facility table row handlers
  const handleAddFacilityRow = () => {
    setFacilityRows([...facilityRows, { facilityName: '', bedCount: '' }]);
  };

  const handleRemoveFacilityRow = (index) => {
    if (facilityRows.length > 1) {
      const newRows = facilityRows.filter((_, i) => i !== index);
      setFacilityRows(newRows);
    }
  };

  const handleFacilityRowChange = (index, field, value) => {
    const newRows = [...facilityRows];
    newRows[index][field] = value;
    setFacilityRows(newRows);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError('');
    setDownloadUrl('');

    try {
      // Upload file to Firebase Storage
      const timestamp = Date.now();
      const storageRef = ref(storage, `uploads/withPilot_${timestamp}_${file.name}`);
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);

      // Call Cloud Function to process document
      const processDocument = httpsCallable(functions, 'processWithPilotDocument');
      const result = await processDocument({
        fileUrl,
        replaceFall: replaceFall.trim(),
        effectiveDate: effectiveDate.trim(),
        clientName: clientName.trim(),
        clientAddress: clientAddress.trim(),
        currencyCountry: currencyCountry.trim(),
        currencyCode: currencyCode.trim(),
        terminationDate: terminationDate.trim(),
        feeRows: feeRows.filter(row => row.bedCount || row.location || row.feePerBed),
        facilityRows: facilityRows.filter(row => row.facilityName || row.bedCount)
      });

      setDownloadUrl(result.data.downloadUrl);
    } catch (err) {
      console.error('Error processing document:', err);
      setError(err.message || 'Failed to process document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Document Editor - With Pilot Agreement</h1>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Upload Template Document (.docx)
          </label>
          <input
            type="file"
            accept=".docx"
            onChange={handleFileChange}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Replace "Fall"/"fall" with (optional):
          </label>
          <input
            type="text"
            value={replaceFall}
            onChange={(e) => setReplaceFall(e.target.value)}
            placeholder="e.g., Behaviours, Analysis (leave empty to keep 'Fall')"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Effective Date:
          </label>
          <input
            type="text"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            placeholder="MM/DD/YYYY"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <small style={{ color: '#666' }}>Format: MM/DD/YYYY (e.g., 01/01/2026)</small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Client Name:
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Replace 'Relavix Health Group LLC' with..."
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Client Address:
          </label>
          <input
            type="text"
            value={clientAddress}
            onChange={(e) => setClientAddress(e.target.value)}
            placeholder="Replace '[Insert Address Here]' with..."
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Currency Country:
          </label>
          <input
            type="text"
            value={currencyCountry}
            onChange={(e) => setCurrencyCountry(e.target.value)}
            placeholder="e.g., United States, Canada"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Currency Code:
          </label>
          <input
            type="text"
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value)}
            placeholder="e.g., USD, CAD, EUR"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Termination Date (Section 4.1):
          </label>
          <input
            type="text"
            value={terminationDate}
            onChange={(e) => setTerminationDate(e.target.value)}
            placeholder="MM/DD/YYYY"
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <small style={{ color: '#666' }}>Format: MM/DD/YYYY (e.g., 02/28/2026)</small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
            Fee Table (Section 3.1):
          </label>
          {feeRows.map((row, index) => (
            <div key={index} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                    Total Number of Beds
                  </label>
                  <input
                    type="text"
                    value={row.bedCount}
                    onChange={(e) => handleFeeRowChange(index, 'bedCount', e.target.value)}
                    placeholder="e.g., 100"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                    Facility Location
                  </label>
                  <input
                    type="text"
                    value={row.location}
                    onChange={(e) => handleFeeRowChange(index, 'location', e.target.value)}
                    placeholder="e.g., Toronto, ON"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                    Fee / Bed / Day
                  </label>
                  <input
                    type="text"
                    value={row.feePerBed}
                    onChange={(e) => handleFeeRowChange(index, 'feePerBed', e.target.value)}
                    placeholder="e.g., $0.50"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFeeRow(index)}
                  disabled={feeRows.length === 1}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: feeRows.length === 1 ? '#ccc' : '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: feeRows.length === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddFeeRow}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Add Row
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
            Facility Table (Schedule A - Second Last Page):
          </label>
          {facilityRows.map((row, index) => (
            <div key={index} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                    Facility Name
                  </label>
                  <input
                    type="text"
                    value={row.facilityName}
                    onChange={(e) => handleFacilityRowChange(index, 'facilityName', e.target.value)}
                    placeholder="e.g., Sunrise Senior Living"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                    Bed Count
                  </label>
                  <input
                    type="text"
                    value={row.bedCount}
                    onChange={(e) => handleFacilityRowChange(index, 'bedCount', e.target.value)}
                    placeholder="e.g., 120"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFacilityRow(index)}
                  disabled={facilityRows.length === 1}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: facilityRows.length === 1 ? '#ccc' : '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: facilityRows.length === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddFacilityRow}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Add Row
          </button>
        </div>

        <button
          type="submit"
          disabled={loading || !file}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading || !file ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: loading || !file ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Processing...' : 'Generate Document'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {downloadUrl && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>Document processed successfully!</p>
          <a
            href={downloadUrl}
            download
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px'
            }}
          >
            Download Document
          </a>
        </div>
      )}
    </div>
  );
}

export default DocumentEditorWithPilot;