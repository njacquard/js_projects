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

ipcMain.handle('process-document', async (event, { filePath, startWord, endWord, caseSensitive, wholeWord }) => {
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
    
    // Prepare search terms
    const startWordRegex = prepareSearchRegex(startWord, caseSensitive, wholeWord);
    const endWordRegex = prepareSearchRegex(endWord, caseSensitive, wholeWord);
    
    lines.forEach((line, lineIndex) => {
      if (!inRemovalRange) {
        // Check if the start word is in this line
        const startMatch = line.match(startWordRegex);
        if (startMatch) {
          inRemovalRange = true;
          currentRangeStart = { line: lineIndex + 1, word: startWord };
          
          // Keep text before the start word
          const beforeStart = line.substring(0, startMatch.index);
          let remainingLine = line.substring(startMatch.index + startMatch[0].length);
          
          // Check if the end word is also in this line
          const endMatch = remainingLine.match(endWordRegex);
          if (endMatch) {
            inRemovalRange = false;
            const removedContent = line.substring(startMatch.index, 
                                                 startMatch.index + startMatch[0].length + endMatch.index + endWord.length);
            totalRemovedWords += countWords(removedContent);
            
            removedRanges.push({
              startLine: lineIndex + 1,
              endLine: lineIndex + 1,
              content: removedContent
            });
            
            // Add remaining content after end word
            const afterEnd = remainingLine.substring(endMatch.index + endMatch[0].length);
            cleanedLines.push(beforeStart + afterEnd);
          } else {
            // End word not found in this line, keep the content before start word
            cleanedLines.push(beforeStart);
          }
        } else {
          // No start word in this line, keep it as is
          cleanedLines.push(line);
        }
      } else {
        // We're in a removal range, looking for the end word
        const endMatch = line.match(endWordRegex);
        if (endMatch) {
          inRemovalRange = false;
          
          // Save the removed content
          removedRanges.push({
            startLine: currentRangeStart.line,
            endLine: lineIndex + 1,
            content: `[Content from line ${currentRangeStart.line} to ${lineIndex + 1}]`
          });
          
          // Keep text after the end word
          const afterEnd = line.substring(endMatch.index + endMatch[0].length);
          cleanedLines.push(afterEnd);
          
          // Count removed words
          totalRemovedWords += countWords(line.substring(0, endMatch.index + endMatch[0].length));
        } else {
          // Still in removal range, continue removing
          totalRemovedWords += countWords(line);
        }
      }
    });
    
    // If we're still in a removal range at the end, it means we never found the end word
    if (inRemovalRange) {
      removedRanges.push({
        startLine: currentRangeStart.line,
        endLine: lines.length,
        content: `[Content from line ${currentRangeStart.line} to end of document]`
      });
    }

    // Create new document
    const doc = new docx.Document({
      sections: [{
        properties: {},
        children: cleanedLines.map(line => 
          new docx.Paragraph({
            children: [new docx.TextRun(line)]
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

function prepareSearchRegex(word, caseSensitive, wholeWord) {
  let pattern = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
  
  if (wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }
  
  return new RegExp(pattern, caseSensitive ? 'g' : 'gi');
}

function countWords(str) {
  return str.split(/\s+/).filter(word => word.length > 0).length;
}