const {onCall} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const PizZip = require('pizzip');
const functions = require('firebase-functions');

admin.initializeApp();

const storage = admin.storage();
const bucket = storage.bucket();

exports.processDocument = onCall(async (request) => {
  try {
    const { templateId, edits } = request.data;

    const templatePath = `templates/${templateId}.docx`;
    const templateFile = bucket.file(templatePath);
    
    const [exists] = await templateFile.exists();
    if (!exists) {
      throw new Error('Template not found');
    }

    const [templateBuffer] = await templateFile.download();
    const zip = new PizZip(templateBuffer);
    let content = zip.file('word/document.xml').asText();

    // 1. Replace "Fallyx" or "fallyx" with custom text (usually "Ascenix")
    if (edits.replaceFallyx) {
      const replacement = edits.replaceFallyx;
      const capitalizedReplacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
      
      content = content.replace(/Fallyx/g, capitalizedReplacement);
      content = content.replace(/fallyx/g, replacement.toLowerCase());
    }

    // 2. Replace "Fall " or "fall " with custom text (but not "Fallyx")
    if (edits.replaceFall) {
      const replacement = edits.replaceFall;
      const capitalizedReplacement = replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
      
      // Replace "Fall " (with space) but not "Fallyx"
      content = content.replace(/Fall\s+/g, `${capitalizedReplacement} `);
      content = content.replace(/fall\s+/g, `${replacement.toLowerCase()} `);
      // Replace standalone "Fall" word boundaries but not if followed by "yx"
      content = content.replace(/\bFall\b(?!yx)/g, capitalizedReplacement);
      content = content.replace(/\bfall\b(?!yx)/g, replacement.toLowerCase());
    }

    // 3. Replace currency country
    if (edits.currencyCountry) {
      content = content.replace(
        /Fees are in Canadian dollars/g,
        `Fees are in ${edits.currencyCountry}`
      );
    }

    // 4. Replace home legal name
    if (edits.homeLegalName) {
      content = content.replace(
        /Responsive Health Management Inc\./g,
        edits.homeLegalName
      );
      content = content.replace(
        /Responsive Health Management Inc/g,
        edits.homeLegalName
      );
    }

    // 5. Replace home location
    if (edits.homeLocation) {
      content = content.replace(
        /33 Christie Street, Toronto, ON M6G\s*3B1/g,
        edits.homeLocation
      );
    }

    // 6. Replace Section 3.3 text
    if (edits.section33Text) {
      content = replaceSection33(content, edits.section33Text);
    }

    // 7. Handle pricing table - replace first table
    if (edits.pricingRows && edits.pricingRows.length > 0) {
      content = replacePricingTable(content, edits.pricingRows);
    }

    // 8. Handle facility table - replace image with table (second last page)
    if (edits.facilityRows && edits.facilityRows.length > 0) {
      content = replaceFacilityImage(content, edits.facilityRows);
    }

    zip.file('word/document.xml', content);

    const outputBuffer = zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    const timestamp = Date.now();
    const outputPath = `outputs/${templateId}-${timestamp}.docx`;
    const outputFile = bucket.file(outputPath);
    
    await outputFile.save(outputBuffer, {
      metadata: {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    });

    await outputFile.makePublic();
    const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${outputPath}`;

    return {
      success: true,
      downloadUrl,
      filename: `${templateId}-edited.docx`,
    };
  } catch (error) {
    console.error('Error processing document:', error);
    throw new Error(error.message);
  }
});

function replaceSection33(content, section33Text) {
  // Section 3.3 text needs to be converted into proper Word XML format
  // We need to find the section and replace all the text elements within it
  
  // First, let's try to find the section by looking for the characteristic text
  const section33StartPattern = /(<w:t[^>]*>)3\.3\.\s*Fallyx shall invoice/;
  const section33Match = content.match(section33StartPattern);
  
  if (!section33Match) {
    console.warn('Section 3.3 start pattern not found');
    return content;
  }
  
  // Find where section 3.3 starts
  const section33StartPos = content.indexOf(section33Match[0]);
  
  // Find the end - look for section 3.4 or 4.0
  const afterSection = content.substring(section33StartPos);
  const nextSectionPattern = /(<w:t[^>]*>)(3\.4\.|4\.)/;
  const nextSectionMatch = afterSection.match(nextSectionPattern);
  
  if (!nextSectionMatch) {
    console.warn('Could not find end of Section 3.3');
    return content;
  }
  
  const section33EndPos = section33StartPos + afterSection.indexOf(nextSectionMatch[0]);
  
  // Extract the section
  const beforeSection = content.substring(0, section33StartPos);
  const sectionToReplace = content.substring(section33StartPos, section33EndPos);
  const afterSectionContent = content.substring(section33EndPos);
  
  // Create new section with the provided text
  // We need to preserve the XML structure, so we'll replace just the text content
  // Get a template paragraph from the section
  const paragraphMatch = sectionToReplace.match(/<w:p\b[^>]*>.*?<\/w:p>/s);
  
  if (!paragraphMatch) {
    console.warn('Could not find paragraph template in Section 3.3');
    return content;
  }
  
  // Create a simple paragraph with the new text
  const newParagraph = paragraphMatch[0].replace(
    /(<w:t[^>]*>).*?(<\/w:t>)/s,
    `$1${escapeXml(section33Text)}$2`
  );
  
  // Reconstruct the content
  return beforeSection + newParagraph + afterSectionContent;
}

function replaceFacilityImage(content, facilityRows) {
  const validRows = facilityRows.filter(row => row.facilityName || row.group || row.bedCount);
  
  if (validRows.length === 0) {
    return content;
  }
  
  // Find the image (blip element) - this is typically on the second last page
  // We'll look for the last image in the document and replace it with a table
  const imageRegex = /<w:drawing>.*?<\/w:drawing>/gs;
  const imageMatches = content.match(imageRegex);
  
  if (!imageMatches || imageMatches.length === 0) {
    console.warn('No images found in document');
    return content;
  }
  
  // Get the last image (second last page likely has last image)
  const lastImage = imageMatches[imageMatches.length - 1];
  const imagePos = content.lastIndexOf(lastImage);
  
  // Create a new table with 3 columns: Facility Name, Group, Bed Count
  const tableXml = createFacilityTable(validRows);
  
  // Replace the image with the table
  const before = content.substring(0, imagePos);
  const after = content.substring(imagePos + lastImage.length);
  content = before + tableXml + after;
  
  return content;
}

function createFacilityTable(facilityRows) {
  // Create table structure with proper Word XML
  const headerRow = `
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="3000" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
            </w:rPr>
            <w:t>Facility Name</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="2000" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
            </w:rPr>
            <w:t>Group</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="2000" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
            </w:rPr>
            <w:t>Bed Count</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>`;
  
  const dataRows = facilityRows.map(row => `
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="3000" w:type="dxa"/>
        </w:tcPr>
        <w:p>
          <w:r>
            <w:t>${escapeXml(row.facilityName || '')}</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="2000" w:type="dxa"/>
        </w:tcPr>
        <w:p>
          <w:r>
            <w:t>${escapeXml(row.group || '')}</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="2000" w:type="dxa"/>
        </w:tcPr>
        <w:p>
          <w:r>
            <w:t>${escapeXml(row.bedCount || '')}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>`).join('');
  
  return `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="7000" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid>
        <w:gridCol w:w="3000"/>
        <w:gridCol w:w="2000"/>
        <w:gridCol w:w="2000"/>
      </w:tblGrid>
      ${headerRow}
      ${dataRows}
    </w:tbl>`;
}

function replacePricingTable(content, pricingRows) {
  const validRows = pricingRows.filter(row => row.description && row.fee);
  
  if (validRows.length === 0) {
    return content;
  }
  
  // Find the FIRST table only by using a non-global regex
  const tableRegex = /<w:tbl>.*?<\/w:tbl>/s;
  const tableMatch = content.match(tableRegex);
  
  if (!tableMatch) {
    console.warn('Pricing table not found');
    return content;
  }
  
  const originalTable = tableMatch[0];
  const tableStartPos = content.indexOf(originalTable);
  
  // Extract rows from the matched table
  const rowRegex = /<w:tr[^>]*>.*?<\/w:tr>/gs;
  const rows = originalTable.match(rowRegex);
  
  if (!rows || rows.length < 2) {
    console.warn('Could not parse table rows');
    return content;
  }
  
  // Keep header row
  const headerRow = rows[0];
  
  // Use second row as template
  const templateRow = rows[1];
  
  // Build new rows
  const newRows = validRows.map(rowData => {
    let newRow = templateRow;
    
    const cells = newRow.match(/<w:tc>.*?<\/w:tc>/gs);
    
    if (cells && cells.length >= 2) {
      // Replace text in first cell (description)
      let firstCell = cells[0];
      firstCell = firstCell.replace(
        /(<w:t[^>]*>)[^<]*(<\/w:t>)/g,
        `$1${escapeXml(rowData.description)}$2`
      );
      
      // Replace text in second cell (fee)
      let secondCell = cells[1];
      secondCell = secondCell.replace(
        /(<w:t[^>]*>)[^<]*(<\/w:t>)/g,
        `$1${escapeXml(rowData.fee)}$2`
      );
      
      // Reconstruct row with new cells
      newRow = newRow.replace(cells[0], firstCell);
      newRow = newRow.replace(cells[1], secondCell);
    }
    
    return newRow;
  });
  
  // Reconstruct the table with header + new rows
  const newTable = originalTable.replace(
    /<w:tr[^>]*>.*?<\/w:tr>/gs,
    () => ''
  ).replace(
    '</w:tbl>',
    headerRow + newRows.join('') + '</w:tbl>'
  );
  
  // Replace ONLY the first occurrence at the exact position
  const before = content.substring(0, tableStartPos);
  const after = content.substring(tableStartPos + originalTable.length);
  content = before + newTable + after;
  
  return content;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Initialize Firebase Admin (only if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Cloud Function to process "With Pilot Agreement" template
 * This is a completely self-contained function with all helpers included
 */
exports.processWithPilotDocument = functions.https.onCall(async (data, context) => {
  try {
    const {
      templateId,
      edits
    } = data;

    console.log('Processing With Pilot document with edits:', edits);

    // Get the template file from Firebase Storage
    const bucket = admin.storage().bucket();
    const templateFileName = 'templates/withPilotAgreement.docx'; // You'll upload this
    const templateFile = bucket.file(templateFileName);

    // Download template file
    const [fileBuffer] = await templateFile.download();

    // Load the docx file using PizZip
    const zip = new PizZip(fileBuffer);
    let content = zip.file('word/document.xml').asText();

    // Apply all replacements using helper functions defined within this function
    content = replaceFallText(content, edits.replaceFall);
    content = replaceEffectiveDate(content, edits.effectiveDate);
    content = replaceClientName(content, edits.clientName);
    content = replaceClientAddress(content, edits.clientAddress);
    content = replaceCurrency(content, edits.currencyCountry, edits.currencyCode);
    content = replaceTerminationDate(content, edits.terminationDate);
    content = replaceFeeTable(content, edits.feeRows);
    content = replaceFacilityTable(content, edits.facilityRows);

    // Update the document.xml in the zip
    zip.file('word/document.xml', content);

    // Generate the modified docx file
    const modifiedBuffer = zip.generate({ type: 'nodebuffer' });

    // Upload to Firebase Storage
    const timestamp = Date.now();
    const fileName = `processed/withPilot_${timestamp}.docx`;
    const outputFile = bucket.file(fileName);

    await outputFile.save(modifiedBuffer, {
      metadata: {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    // Generate a signed URL that expires in 1 hour
    const [downloadUrl] = await outputFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000 // 1 hour
    });

    console.log('Document processed successfully');
    return { 
      success: true, 
      downloadUrl 
    };

  } catch (error) {
    console.error('Error processing With Pilot document:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }

  // ============================================================================
  // HELPER FUNCTIONS - All contained within this Cloud Function
  // ============================================================================

  /**
   * Helper function to escape XML special characters
   */
  function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Replace "Fall" or "fall" with custom text (optional)
   * Uses word boundaries and negative lookahead to avoid replacing "Fallyx"
   */
  function replaceFallText(content, replacementText) {
    if (!replacementText) return content;
    
    // Match "Fall" or "fall" only when not followed by "yx"
    content = content.replace(/\bFall\b(?!yx)/g, replacementText);
    content = content.replace(/\bfall\b(?!yx)/g, replacementText.toLowerCase());
    
    return content;
  }

  /**
   * Replace effective date in opening paragraph
   * Handles dates that may be split across multiple <w:t> tags
   */
  function replaceEffectiveDate(content, newDate) {
    if (!newDate) return content;
    
    // Try pattern where date is split: 01/01/ in one tag, /202 in another, 6 in another
    const splitPattern = /(<w:t[^>]*>)([0-9]{2}\/[0-9]{2}\/)(<\/w:t>[\s\S]*?<w:t[^>]*>)(\/[0-9]{3})(<\/w:t>[\s\S]*?<w:t[^>]*>)([0-9])(<\/w:t>)/;
    const match = content.match(splitPattern);
    
    if (match) {
      // Date is split - reconstruct with new date
      const dateParts = newDate.match(/^([0-9]{2}\/[0-9]{2}\/)([0-9]{4})$/);
      if (dateParts) {
        const replacement = `$1${dateParts[1]}$3/${dateParts[2].substring(0, 3)}$5${dateParts[2].substring(3)}$7`;
        content = content.replace(splitPattern, replacement);
      }
    }
    
    // Also try simpler pattern if date is in single tag
    content = content.replace(/(<w:t[^>]*>)01\/01\/2026(<\/w:t>)/g, `$1${escapeXml(newDate)}$2`);
    
    return content;
  }

  /**
   * Replace client name (Relavix Health Group LLC)
   */
  function replaceClientName(content, newName) {
    if (!newName) return content;
    
    const escapedName = escapeXml(newName);
    
    // Replace full name and standalone "Relavix"
    content = content.replace(/(<w:t[^>]*>)Relavix Health Group LLC(<\/w:t>)/g, `$1${escapedName}$2`);
    content = content.replace(/(<w:t[^>]*>)Relavix Health Group LLC(<\/w:t>)/g, `$1${escapedName}$2`);
    
    return content;
  }

  /**
   * Replace client address placeholder
   */
  function replaceClientAddress(content, newAddress) {
    if (!newAddress) return content;
    
    const escapedAddress = escapeXml(newAddress);
    content = content.replace(/(<w:t[^>]*>)\[Insert Address Here\](<\/w:t>)/g, `$1${escapedAddress}$2`);
    
    return content;
  }

  /**
   * Replace currency in Section 3.2
   */
  function replaceCurrency(content, country, code) {
    if (!country || !code) return content;
    
    const escapedCountry = escapeXml(country);
    const escapedCode = escapeXml(code);
    
    // Replace "United States Dollars (USD)"
    const pattern = /(<w:t[^>]*>)United States Dollars \(USD\)(<\/w:t>)/g;
    content = content.replace(pattern, `$1${escapedCountry} Dollars (${escapedCode})$2`);
    
    return content;
  }

  /**
   * Replace termination date in Section 4.1
   */
  function replaceTerminationDate(content, newDate) {
    if (!newDate) return content;
    
    // Find pattern: "continue until 02/28/2026"
    const pattern = /(<w:t[^>]*>continue until )02\/28\/2026(<\/w:t>)/g;
    content = content.replace(pattern, `$1${escapeXml(newDate)}$2`);
    
    return content;
  }

  /**
   * Replace the fee table (first table in document - Section 3.1)
   */
  function replaceFeeTable(content, feeRows) {
    if (!feeRows || feeRows.length === 0) return content;
    
    // Find the first table in the document
    const tablePattern = /<w:tbl>[\s\S]*?<\/w:tbl>/;
    const tableMatch = content.match(tablePattern);
    
    if (!tableMatch) return content;
    
    const newTable = createFeeTable(feeRows);
    content = content.replace(tablePattern, newTable);
    
    return content;
  }

  /**
   * Create fee table XML structure with proper formatting
   */
  function createFeeTable(feeRows) {
    let tableXml = `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="4500"/>
      <w:gridCol w:w="4500"/>
    </w:tblGrid>`;
    
    // Header row
    tableXml += `
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="4500" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="D3D3D3"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
            </w:rPr>
            <w:t>Total Number of Beds / Facility Location</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="4500" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="D3D3D3"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
            </w:rPr>
            <w:t>*Fee / Bed / Day / Facility Location</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>`;
    
    // Data rows - combine bed count and location in both columns
    feeRows.forEach(row => {
      const bedCountLocation = `${row.bedCount} / ${row.location}`;
      const feeLocation = `${row.feePerBed} / ${row.location}`;
      
      tableXml += `
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="4500" w:type="dxa"/>
        </w:tcPr>
        <w:p>
          <w:r>
            <w:t>${escapeXml(bedCountLocation)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="4500" w:type="dxa"/>
        </w:tcPr>
        <w:p>
          <w:r>
            <w:t>${escapeXml(feeLocation)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>`;
    });
    
    tableXml += `</w:tbl>`;
    return tableXml;
  }

  /**
   * Replace the facility table (last table - Schedule A)
   */
  function replaceFacilityTable(content, facilityRows) {
    if (!facilityRows || facilityRows.length === 0) return content;
    
    // Find all tables
    const tablePattern = /<w:tbl>[\s\S]*?<\/w:tbl>/g;
    const tables = content.match(tablePattern);
    
    if (!tables || tables.length < 3) return content;
    
    // Replace the last table (third table in the document)
    const lastTable = tables[tables.length - 1];
    const newTable = createFacilityTable(facilityRows);
    
    // Find the position of the last table and replace it
    const lastTableIndex = content.lastIndexOf(lastTable);
    content = content.substring(0, lastTableIndex) + newTable + content.substring(lastTableIndex + lastTable.length);
    
    return content;
  }

  /**
   * Create facility table XML structure with proper formatting
   */
  function createFacilityTable(facilityRows) {
    let tableXml = `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="6000"/>
      <w:gridCol w:w="3000"/>
    </w:tblGrid>`;
    
    // Header row
    tableXml += `
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="6000" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="D3D3D3"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
            </w:rPr>
            <w:t>Facility Name</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="3000" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="D3D3D3"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
            </w:rPr>
            <w:t>Bed Count</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>`;
    
    // Data rows
    facilityRows.forEach(row => {
      tableXml += `
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="6000" w:type="dxa"/>
        </w:tcPr>
        <w:p>
          <w:r>
            <w:t>${escapeXml(row.facilityName)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="3000" w:type="dxa"/>
        </w:tcPr>
        <w:p>
          <w:r>
            <w:t>${escapeXml(row.bedCount)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>`;
    });
    
    tableXml += `</w:tbl>`;
    return tableXml;
  }
});