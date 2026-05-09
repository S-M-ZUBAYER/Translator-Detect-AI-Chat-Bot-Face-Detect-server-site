const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// Function to read all PDFs in a folder and extract their text
const folderPath = path.join(__dirname, "../data"); // Construct the absolute path

async function extractTextFromPDFs() {
    try {
        const files = fs.readdirSync(folderPath);
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === ".pdf");

        if (pdfFiles.length === 0) {
            console.log("No PDF files found in the folder.");
            return;
        }

        let combinedText = "";

        for (const pdfFile of pdfFiles) {
            const filePath = path.join(folderPath, pdfFile);

            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);

            // Normalize the extracted text
            let normalizedText = pdfData.text
                .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between lowercase and uppercase letters
                .replace(/(\d)([a-zA-Z])/g, '$1 $2') // Add space between digits and letters
                .replace(/([a-zA-Z])(\d)/g, '$1 $2') // Add space between letters and digits
                .replace(/\s{2,}/g, ' ');           // Replace multiple spaces with a single space

            combinedText += normalizedText.trim(); // Add trimmed text
            combinedText += "\n\n\n"; // Add 3-line spacing
        }

        // Path to save the extracted text
        const outputFilePath = path.join(__dirname, "../Output/extracted_text.txt");

        // Write combined text to the output file
        fs.writeFileSync(outputFilePath, combinedText, 'utf8');
        console.log(`Extracted text saved to: ${outputFilePath}`);

    } catch (error) {
        console.error("Error reading PDFs:", error);
    }
}

module.exports = extractTextFromPDFs;
