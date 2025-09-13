const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { Document, Packer, Paragraph, ImageRun } = require('docx');

// Create Word document from image buffer
async function createWordFromImage(buffer, originalName) {
  try {
    console.log('📄 Creating Word document from image...');
    
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            children: [
              new ImageRun({
                data: buffer,
                transformation: { 
                  width: 600, 
                  height: 800 
                },
                type: 'png' // or 'jpg' based on input
              })
            ]
          })
        ]
      }]
    });

    const tempWordPath = path.join(os.tmpdir(), `receipt_${Date.now()}_${originalName}.docx`);
    const docBuffer = await Packer.toBuffer(doc);
    fs.writeFileSync(tempWordPath, docBuffer);
    
    console.log('✅ Word document created:', tempWordPath);
    return tempWordPath;
  } catch (error) {
    console.error('❌ Word creation failed:', error);
    throw new Error('Failed to create Word document: ' + error.message);
  }
}

// Convert Word document to PDF using LibreOffice CLI
async function convertWordToPdf(wordPath) {
  try {
    console.log('📄 Converting Word to PDF using LibreOffice...');
    
    const pdfPath = wordPath.replace(/\.docx$/, '.pdf');
    const outputDir = path.dirname(wordPath);
    
    return new Promise((resolve, reject) => {
      // LibreOffice headless conversion command
      const cmd = `soffice --headless --convert-to pdf --outdir "${outputDir}" "${wordPath}"`;
      
      exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ LibreOffice conversion error:', error.message);
          console.error('stderr:', stderr);
          return reject(new Error('LibreOffice conversion failed: ' + error.message));
        }
        
        // Check if PDF was created
        if (fs.existsSync(pdfPath)) {
          console.log('✅ PDF created successfully:', pdfPath);
          resolve(pdfPath);
        } else {
          reject(new Error('PDF file not found after conversion'));
        }
      });
    });
  } catch (error) {
    console.error('❌ PDF conversion failed:', error);
    throw error;
  }
}

// Clean up temporary files
function cleanupTempFiles(filePaths) {
  filePaths.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ Cleaned up temp file:', filePath);
      }
    } catch (error) {
      console.warn('⚠️ Failed to cleanup temp file:', filePath, error.message);
    }
  });
}

// Main function: Convert image to Word, then to PDF, return PDF buffer
async function convertImageToWordToPdf(imageBuffer, originalName) {
  let wordPath, pdfPath;
  
  try {
    // Step 1: Create Word document
    wordPath = await createWordFromImage(imageBuffer, originalName);
    
    // Step 2: Convert to PDF
    pdfPath = await convertWordToPdf(wordPath);
    
    // Step 3: Read PDF buffer
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    // Step 4: Cleanup temp files
    cleanupTempFiles([wordPath, pdfPath]);
    
    console.log('✅ Image → Word → PDF conversion completed successfully');
    return pdfBuffer;
    
  } catch (error) {
    // Cleanup on error
    if (wordPath || pdfPath) {
      cleanupTempFiles([wordPath, pdfPath].filter(Boolean));
    }
    throw error;
  }
}

module.exports = {
  createWordFromImage,
  convertWordToPdf,
  cleanupTempFiles,
  convertImageToWordToPdf
};
