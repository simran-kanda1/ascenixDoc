const {onCall} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const PizZip = require('pizzip');

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

    // 1. Replace "Fall " or "fall " with custom text
    if (edits.replaceFall) {
      const replacement = edits.replaceFall;
      const capitalizedReplacement = replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
      
      content = content.replace(/Fall\s+/g, `${capitalizedReplacement} `);
      content = content.replace(/fall\s+/g, `${replacement.toLowerCase()} `);
      content = content.replace(/\bFall\b(?!yx)/g, capitalizedReplacement);
      content = content.replace(/\bfall\b(?!yx)/g, replacement.toLowerCase());
    }

    // 2. Replace currency country
    if (edits.currencyCountry) {
      content = content.replace(
        /Fees are in Canadian dollars/g,
        `Fees are in ${edits.currencyCountry}`
      );
    }

    // 3. Replace home legal name
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

    // 4. Replace home location
    if (edits.homeLocation) {
      content = content.replace(
        /33 Christie Street, Toronto, ON M6G\s*3B1/g,
        edits.homeLocation
      );
    }

    // 5. Handle quarterly filing cycle dates - FIXED
    if (edits.quarterlyStartDate && edits.quarterlyEndDate) {
      content = replaceQuarterlyDates(content, edits.quarterlyStartDate, edits.quarterlyEndDate);
    }

    // 6. Handle pricing table - FIXED to only replace first table
    if (edits.pricingRows && edits.pricingRows.length > 0) {
      content = replacePricingTable(content, edits.pricingRows);
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

function formatDate(date) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const d = new Date(date);
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function replaceQuarterlyDates(content, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startFormatted = formatDate(start);
  const endFormatted = formatDate(end);
  
  // Calculate first billing date (first day of month after end date)
  const firstBilling = new Date(end);
  firstBilling.setDate(1);
  firstBilling.setMonth(firstBilling.getMonth() + 1);
  
  // Generate the four specific quarterly dates
  const q1 = new Date(firstBilling);
  const q2 = new Date(firstBilling);
  q2.setMonth(q2.getMonth() + 3);
  const q3 = new Date(firstBilling);
  q3.setMonth(q3.getMonth() + 6);
  const q4 = new Date(firstBilling);
  q4.setMonth(q4.getMonth() + 9);
  
  const q1Formatted = formatDate(q1);
  const q2Formatted = formatDate(q2);
  const q3Formatted = formatDate(q3);
  const q4Formatted = formatDate(q4);
  
  // Get the recurring pattern (month and day only)
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const recurringPattern = `${months[firstBilling.getMonth()]} 1, ${months[(firstBilling.getMonth() + 3) % 12]} 1, ${months[(firstBilling.getMonth() + 6) % 12]} 1, and ${months[(firstBilling.getMonth() + 9) % 12]} 1`;
  
  // Find and replace the initial billing period dates
  content = content.replace(
    /The initial billing period shall run from [^,]+, \d{4}, to [^,]+, \d{4}\./g,
    `The initial billing period shall run from ${startFormatted} to ${endFormatted}.`
  );
  
  // Replace the "Thereafter, quarterly billing shall begin on" part
  content = content.replace(
    /Thereafter, quarterly billing shall begin on [^,]+, \d{4}, and continue on [^.]+\./g,
    `Thereafter, quarterly billing shall begin on ${q1Formatted}, ${q2Formatted}, ${q3Formatted}, ${q4Formatted}, and continue on ${recurringPattern} each year.`
  );
  
  return content;
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