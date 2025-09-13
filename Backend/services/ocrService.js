const Tesseract = require('tesseract.js');
const vision = require('@google-cloud/vision');
const pdfParse = require('pdf-parse');

class OCRService {
  constructor() {
    // Initialize Google Vision client
    this.visionClient = new vision.ImageAnnotatorClient();
    
    // Tesseract configuration
    this.tesseractConfig = {
      lang: 'eng',
      oem: 1, // LSTM OCR Engine Mode
      whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/-:$ ₹',
    };

    // Multiple PSM (Page Segmentation Mode) strategies for better accuracy
    this.psmModes = [
      6, // Uniform block of text
      7, // Single text line
      8, // Single word
      4, // Single column of text of variable sizes
      3  // Fully automatic page segmentation
    ];
  }

  /**
   * Extract text from image using multi-pass Tesseract OCR
   * @param {Buffer} imageBuffer - Image buffer
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<{text: string, confidence: number, method: string}>}
   */
  async extractTextFromImage(imageBuffer, progressCallback = null) {
    console.log('🔍 Starting multi-pass OCR extraction...');
    
    const results = [];
    
    try {
      // Run OCR with multiple PSM modes
      for (let i = 0; i < this.psmModes.length; i++) {
        const psm = this.psmModes[i];
        
        if (progressCallback) {
          progressCallback(`OCR Pass ${i + 1}/${this.psmModes.length} (PSM: ${psm})`, 
            (i / this.psmModes.length) * 100);
        }

        try {
          const result = await Tesseract.recognize(imageBuffer, 'eng', {
            ...this.tesseractConfig,
            psm,
            logger: (m) => {
              if (m.status === 'recognizing text' && progressCallback) {
                const progress = (i / this.psmModes.length) * 100 + 
                  (m.progress / this.psmModes.length);
                progressCallback(`OCR Pass ${i + 1}: ${Math.round(m.progress)}%`, progress);
              }
            }
          });

          if (result.data.text && result.data.text.trim().length > 10) {
            results.push({
              text: result.data.text.trim(),
              confidence: result.data.confidence,
              psm: psm
            });
            
            console.log(`✅ PSM ${psm} completed - Confidence: ${result.data.confidence}%`);
          }
        } catch (psmError) {
          console.warn(`⚠️ PSM ${psm} failed:`, psmError.message);
        }
      }

      if (results.length === 0) {
        throw new Error('All OCR attempts failed to extract readable text');
      }

      // Select best result based on confidence and text length
      const bestResult = results.reduce((best, current) => {
        const currentScore = current.confidence * (current.text.length / 100);
        const bestScore = best.confidence * (best.text.length / 100);
        return currentScore > bestScore ? current : best;
      });

      console.log(`🎯 Best OCR result: PSM ${bestResult.psm}, Confidence: ${bestResult.confidence}%`);

      return {
        text: bestResult.text,
        confidence: bestResult.confidence,
        method: 'tesseract'
      };

    } catch (error) {
      console.error('❌ Tesseract OCR failed:', error.message);
      throw new Error(`OCR extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF using Google Vision API with fallback
   * @param {Buffer} pdfBuffer - PDF buffer
   * @returns {Promise<{text: string, confidence: number, method: string}>}
   */
  async extractTextFromPDF(pdfBuffer) {
    console.log('📄 Starting PDF text extraction...');

    // Try Google Vision API first
    try {
      console.log('🔍 Attempting Google Vision API...');
      
      const [result] = await this.visionClient.documentTextDetection({
        image: {
          content: pdfBuffer.toString('base64')
        }
      });

      const fullTextAnnotation = result.fullTextAnnotation;
      
      if (fullTextAnnotation && fullTextAnnotation.text) {
        console.log('✅ Google Vision API successful');
        return {
          text: fullTextAnnotation.text.trim(),
          confidence: 95, // Google Vision typically has high confidence
          method: 'google-vision'
        };
      }
    } catch (visionError) {
      console.warn('⚠️ Google Vision API failed:', visionError.message);
    }

    // Fallback to pdf-parse
    try {
      console.log('📋 Falling back to pdf-parse...');
      
      const pdfData = await pdfParse(pdfBuffer);
      
      if (pdfData.text && pdfData.text.trim().length > 0) {
        console.log('✅ PDF-parse successful');
        return {
          text: pdfData.text.trim(),
          confidence: 80, // Lower confidence for pdf-parse
          method: 'pdf-parse'
        };
      }
      
      throw new Error('No text found in PDF');
    } catch (parseError) {
      console.error('❌ PDF-parse failed:', parseError.message);
      throw new Error(`PDF extraction failed: ${parseError.message}`);
    }
  }

  /**
   * Extract text from file based on type
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - File MIME type
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<{text: string, confidence: number, method: string}>}
   */
  async extractText(fileBuffer, mimeType, progressCallback = null) {
    const startTime = Date.now();
    
    try {
      let result;
      
      if (mimeType.startsWith('image/')) {
        result = await this.extractTextFromImage(fileBuffer, progressCallback);
      } else if (mimeType === 'application/pdf') {
        result = await this.extractTextFromPDF(fileBuffer);
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }

      const processingTime = Date.now() - startTime;
      console.log(`⏱️ OCR completed in ${processingTime}ms using ${result.method}`);

      return {
        ...result,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ OCR failed after ${processingTime}ms:`, error.message);
      throw error;
    }
  }
}

module.exports = new OCRService();
