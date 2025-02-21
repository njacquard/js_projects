const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const mammoth = require('mammoth');
const docx = require('docx');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Word Documents', extensions: ['docx'] }
    ]
  });
  
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('process-document', async (event, { filePath }) => {
  try {
    // Read the document
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    const lines = text.split('\n');
    
    // Process document
    const cleanedLines = [];
    const removedRanges = [];
    let inRemovalRange = false;
    let currentRangeStart = null;
    let totalRemovedWords = 0;
    
    // Set fixed start and end phrases
    const startPhrase = "Selected Answer:";
    const endPhrase = "Answers:";
    
    lines.forEach((line, lineIndex) => {
      if (!inRemovalRange) {
        // Check if the start phrase is in this line
        const startIndex = line.indexOf(startPhrase);
        if (startIndex !== -1) {
          inRemovalRange = true;
          currentRangeStart = { line: lineIndex + 1, phrase: startPhrase };
          
          // Keep text before the start phrase
          const beforeStart = line.substring(0, startIndex);
          const remainingLine = line.substring(startIndex + startPhrase.length);
          
          // Check if the end phrase is also in this line
          const endIndex = remainingLine.indexOf(endPhrase);
          if (endIndex !== -1) {
            inRemovalRange = false;
            
            // Calculate removed content
            const removedContent = line.substring(startIndex, 
                                                startIndex + startPhrase.length + endIndex);
            totalRemovedWords += countWords(removedContent);
            
            removedRanges.push({
              startLine: lineIndex + 1,
              endLine: lineIndex + 1,
              content: removedContent
            });
            
            // Add remaining content after end phrase
            const afterEnd = remainingLine.substring(endIndex);
            const processedText = beforeStart + afterEnd;
            const processedLines = processedText.split('\n');
            cleanedLines.push(...processedLines);
          } else {
            // End phrase not found in this line
            const processedText = beforeStart;
            const processedLines = processedText.split('\n');
            cleanedLines.push(...processedLines);
          }
        } else {
          // No start phrase in this line
          const processedText = line;
          if (processedText.match(/(?<![\n])(\b\d+\.)/g))
          {
            cleanedLines.push('\n');
          }
          const processedLines = processedText.split('\n');
          cleanedLines.push(...processedLines);
        }
      } else {
        // We're in a removal range, looking for the end phrase
        const endIndex = line.indexOf(endPhrase);
        if (endIndex !== -1) {
          inRemovalRange = false;

          //cleanedLines.push('\n');
          
          // Save the removed content
          removedRanges.push({
            startLine: currentRangeStart.line,
            endLine: lineIndex + 1,
            content: `[Content from line ${currentRangeStart.line} to ${lineIndex + 1}]`
          });
          
          // Keep text after the end phrase with smart line breaks
          const afterEnd = line.substring(endIndex);
          const processedText = afterEnd;
          const processedLines = processedText.split('\n');
          cleanedLines.push(...processedLines);
          
          // Count removed words
          totalRemovedWords += countWords(line.substring(0, endIndex));
        } else {
          // Still in removal range, continue removing
          totalRemovedWords += countWords(line);
        }
      }
    });
    
    // If we're still in a removal range at the end, it means we never found the end phrase
    if (inRemovalRange) {
      removedRanges.push({
        startLine: currentRangeStart.line,
        endLine: lines.length,
        content: `[Content from line ${currentRangeStart.line} to end of document]`
      });
    }

    // Create new document with proper line breaks
    const doc = new docx.Document({
      sections: [{
        properties: {},
        children: cleanedLines
          .filter(line => line !== '')
          .map(line => 
            new docx.Paragraph({
              children: [new docx.TextRun(line.trim())],
              spacing: {
                after: 240  // Add space after each paragraph
              }
            })
          )
      }]
    });

    // Generate new file path
    const newPath = filePath.replace('.docx', '_cleaned.docx');
    
    // Save the document
    const buffer = await docx.Packer.toBuffer(doc);
    fs.writeFileSync(newPath, buffer);

    return {
      totalLines: lines.length,
      cleanedLines: cleanedLines.length,
      removedRanges: removedRanges.length,
      totalRemovedWords: totalRemovedWords,
      newFilePath: newPath
    };
  } catch (error) {
    throw new Error(`Processing failed: ${error.message}`);
  }
});

function countWords(str) {
  return str.split(/\s+/).filter(word => word.length > 0).length;
}