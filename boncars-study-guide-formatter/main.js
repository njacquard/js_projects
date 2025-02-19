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

ipcMain.handle('process-document', async (event, { filePath, startWord, endWord, caseSensitive, wholeWord, removeStartWord }) => {
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
          
          // If removeStartWord is false, include the start word in beforeStart
          const contentToKeep = removeStartWord ? 
            beforeStart : 
            beforeStart + startMatch[0];
            
          // Adjust the remaining line if we're keeping the start word
          remainingLine = removeStartWord ?
            remainingLine :
            line.substring(startMatch.index + startMatch[0].length);
          
          // Check if the end word is also in this line
          const endMatch = remainingLine.match(endWordRegex);
          if (endMatch) {
            inRemovalRange = false;
            
            // Calculate removed content (with or without start word)
            const removedStartIndex = removeStartWord ? startMatch.index : startMatch.index + startMatch[0].length;
            const removedContent = line.substring(removedStartIndex, 
                                                 startMatch.index + startMatch[0].length + endMatch.index + endMatch[0].length);
            totalRemovedWords += countWords(removedContent);
            
            removedRanges.push({
              startLine: lineIndex + 1,
              endLine: lineIndex + 1,
              content: removedContent
            });
            
            // Add remaining content after end word with a new line
            const afterEnd = remainingLine.substring(endMatch.index + endMatch[0].length);
            cleanedLines.push(contentToKeep + afterEnd);
          } else {
            // End word not found in this line, keep the content before start word
            cleanedLines.push(contentToKeep);
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
          
          // Keep text after the end word and add a new line
          const afterEnd = line.substring(endMatch.index + endMatch[0].length);
          cleanedLines.push(afterEnd);
          
          // Count removed words
          totalRemovedWords += countWords(line.substring(0, endMatch.index + endWord.length));
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

    // Create new document with line breaks
    const doc = new docx.Document({
      sections: [{
        properties: {},
        children: cleanedLines.filter(line => line !== '').map(line => 
          new docx.Paragraph({
            spacing: {
              before: 200
            },
            children: [new docx.TextRun(line)],
            spacing: {
              after: 200 // Add space after each paragraph
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