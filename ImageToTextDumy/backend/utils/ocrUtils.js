const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');

exports.extractTextFromImage = async (buffer) => {
  const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
  return text;
};

exports.extractTextFromPdf = async (buffer) => {
  const data = await pdfParse(buffer);
  return data.text;
};
