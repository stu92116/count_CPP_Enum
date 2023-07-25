import * as vscode from 'vscode';
import { evaluate, freqzDependencies } from 'mathjs';

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "enum-member-counter" is now active!');

  const config = vscode.workspace.getConfiguration('enumMemberCounter');
  let displayFormats = config.get<string[]>('displayFormat') || ["Dec"];
  let color = config.get<string>('color') || "#d5e39d";

  let disposable = vscode.languages.registerHoverProvider('cpp', {
    provideHover(document, position, token) {
      const wordRange = document.getWordRangeAtPosition(position);
      const word = document.getText(wordRange);
      // console.log('Hover triggered for word:', word);

      // Check if the word is an enum member
      if (isEnumMember(document, word)) {
        const enumMemberValue = getEnumMemberValue(document, position);
        if (enumMemberValue !== undefined && enumMemberValue !== null) {
          // console.log('enumMemberValue:', enumMemberValue);
          // return new vscode.Hover("Enum Number : " + enumMemberValue.toString());
          
          const markdownContent = new vscode.MarkdownString(`Enum Number : `);
          markdownContent.supportHtml = true;
          
          let numFormOutput = numberBaseConverter(enumMemberValue, displayFormats);
          
          markdownContent.appendMarkdown(
            `<span style="color:${color};">${numFormOutput}</span>`);
          
          return new vscode.Hover(markdownContent);
        }
      }

      return null;
    },
  });
  context.subscriptions.push(disposable);

  // Enum value to Name
  let nameDispoable = vscode.commands.registerCommand('show-enum.findEnumMember', () => {
    // Show an input box for the user to enter the enum value
    vscode.window.showInputBox({ prompt: 'Enter the enum value' }).then((value) => {
      if (value) {
        // Retrieve the active text editor
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const document = editor.document;
          const position = editor.selection.active;

          // Find the enum member name base on the entered enum value and cursor location line
          const [memberName, memberLine] =
                      findEnumMemberName(document, position, evaluate(value) as number);
                              
          if (memberName) {
            vscode.window.showInformationMessage(`Enum Member Name : ${memberName}`);
            
            if (memberLine) {
              const startPos = new vscode.Position(memberLine, 0);
              const endPos = editor.document.lineAt(memberLine).range.end;
              const selectionRange = new vscode.Selection(startPos, endPos);
              editor.selection = new vscode.Selection(selectionRange.start, selectionRange.end);
              // Scroll to the cursor position
              editor.revealRange(selectionRange, vscode.TextEditorRevealType.InCenter);
            }
          } else {
            vscode.window.showWarningMessage(`No matching enum member found for value: ${value}`);
          }
        } else {
          vscode.window.showErrorMessage('No active text editor found');
        }
      }
    });
  });
  context.subscriptions.push(nameDispoable);

  // listen to config changes
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('enumMemberCounter')) {
      const newConfig = vscode.workspace.getConfiguration('enumMemberCounter');
      displayFormats = newConfig.get<string[]>('displayFormat') || ["Dec"];
      color = newConfig.get<string>('color') || "#d5e39d";
    }
  });
}


function isEnumMember(document: vscode.TextDocument, word: string): boolean {
  // Customize this condition based on your desired criteria for identifying enum members
  return /^[A-Za-z_]\w*$/.test(word);
}

function getEnumMemberValue(document: vscode.TextDocument,
                            position: vscode.Position): number | undefined {
  const line = position.line;
  const currentLine = document.lineAt(line).text;

  let enumDeclarationStartLine = findEnumDeclarationStartLine(document, line);
  if (enumDeclarationStartLine !== -1) {
    const enumName = extractEnumName(document.lineAt(enumDeclarationStartLine).text);
    const enumMemberName = extractEnumMemberName(currentLine);

    if (enumName && enumMemberName) {
      const enumMemberValue =
                  findEnumMemberValue(document, enumDeclarationStartLine, enumMemberName);
      if (enumMemberValue !== -1) {
        return enumMemberValue;
      }
    }
  }

  return undefined;
}

function findEnumDeclarationStartLine(document: vscode.TextDocument,
                                      line: number): number {
  while (line >= 0) {
    const lineText = document.lineAt(line).text;

    // lineText.includes('enum ')
    if (containsEnumDeclaration(lineText) && !startsWithComment(lineText)) {
      return line;
    }

    line--;
  }

  return -1;
}

function extractEnumName(lineText: string): string | undefined {
  const match = lineText.match(/enum\s+(\w+)/);
  return match ? match[1] : undefined;
}

function extractEnumMemberName(lineText: string): string | undefined {
  // const match = lineText.match(/[A-Za-z_]\w+/);
  const match = lineText.match(/[A-Za-z_]\w*/);
  return match ? match[0] : undefined;
}

function findEnumMemberValue(document: vscode.TextDocument,
                             startLine: number, memberName: string): number {
  const enumDeclarationEndLine = findEnumDeclarationEndLine(document, startLine);
  if (enumDeclarationEndLine > startLine && enumDeclarationEndLine !== -1) {
    let memberValue: number = -1;
    let hasReachedMember = false;
    let keyMap = new Map<string, number>();

    for (let line = startLine + 1; line < enumDeclarationEndLine; line++) {
      const lineText = document.lineAt(line).text.trim();
      // handle comments
      if (startsWithComment(lineText)) { continue; }
  
      const match = lineText.match(/^(\w+)\s*(?:=\s*)?(.*)/);
      if (match) {
        const currentMemberName = match[1];
        const currentValue = match[2].trim();
        // if (!currentValue) {
        //   continue;
        // }
        if (!currentValue && currentMemberName === memberName) {
          memberValue = memberValue < 0 ? 0 : memberValue + 1;
        } else if (currentValue === ',') {
          // hasReachedMember = true;
          memberValue = memberValue < 0 ? 0 : memberValue + 1;
          // memberValue = memberValue + 1;
        } else if (Number(tryGetNumber(currentValue))) {
          memberValue = parseEnumMemberValue(currentValue);
        } else {  // handle currentValue assign as Enum Name
          let searchKey = removeStringAfterCommas(currentValue);
          let keyFind = keyMap.has(searchKey) ? keyMap.get(searchKey) : 0;
          memberValue = keyFind ? keyFind : 0;
        }

        // if finding match member Return
        if (currentMemberName === memberName) {
            // return memberValue !== undefined ? memberValue + 1 : 0;
            return memberValue;
        }

        // store key
        keyMap.set(currentMemberName, memberValue);

        // if (!currentValue || currentValue === ',') {
        //   // hasReachedMember = true;
        //   memberValue = memberValue !== undefined ? memberValue + 1 : 0;
        // } else {
        //   memberValue = parseEnumMemberValue(currentValue);
        // }
      }
    }
  }

  return -1;
}

function removeStringAfterCommas(input: string): string {
  return input.split(',')[0];
}

function findEnumDeclarationEndLine(document: vscode.TextDocument,
                                    startLine: number): number {
  const lineCount = document.lineCount;

  for (let line = startLine + 1; line < lineCount; line++) {
    const lineText = document.lineAt(line).text.trim();
    if (lineText.includes('}')) {
      return line;
    }
  }

  return -1;
}

function parseEnumMemberValue(value: string): number {
  // Handle hexadecimal and decimal values
  return evaluateFormula(value);
  // return value.startsWith('0x') ? parseInt(value, 16) : parseInt(value);
}

function startsWithComment(input: string): boolean {
  const trimmedInput = input.trim(); // Remove leading and trailing spaces
  return /^(\/\/|\*|\/)/.test(trimmedInput);
}

function containsEnumDeclaration(input: string): boolean {
  return /\benum\s+\w*\s*{/.test(input);
}

function numberToHex(num: number): string {
  return `0x${num.toString(16).toUpperCase()}`;
}

function tryGetNumber(formula: string): string {
  try {
    // 使用 eval 函数求值
    let pureFormula = removeStringAfterCommas(formula);
    return evaluate(pureFormula) as string;
  } catch (error) {
    // console.error('公式求值出错:', error);
    return 'undefined';
  }
}

function evaluateFormula(formula: string): number {
  let pureFormula = removeStringAfterCommas(formula);
  try {
    // 使用 eval 函数求值
    return evaluate(pureFormula) as number;
  } catch (error) {
    // console.error('公式求值出错:', error);
    return 0;
  }
}

function numberBaseConverter(enumMemberValue: number,
                             displayFormats: string[]): string {
  let formattedOutput: string = "";

  displayFormats.forEach((displayFormat) => {
    let formattedValue: string;

    switch (displayFormat) {
      case "Dec":
        formattedValue = enumMemberValue.toString();
        break;
      case "Hex":
        formattedValue = numberToHex(enumMemberValue);
        break;
      case "Bin":  // Convert to binary
        formattedValue = "0b" + enumMemberValue.toString(2);
        break;
      default:
        formattedValue = "";
        break;
    }
    if (formattedOutput !== "") {
      formattedOutput += " / ";
    }
    formattedOutput += formattedValue;
  });
  return formattedOutput;
}

function findEnumMemberName(document: vscode.TextDocument,
  position: vscode.Position, targetValue: number):
    [string | undefined, number | undefined] {
  // Loop from the cursor position line towards the start of document
  const lineCursor = position.line;
  // const currentLine = document.lineAt(lineCursor).text;
  
  let memberValue: number = -1;
  let keyMap = new Map<string, number>();

  let enumDeclareStartLine = findEnumDeclarationStartLine(document, lineCursor);
  if (enumDeclareStartLine === -1) { return [undefined, undefined]; } // protect guard
    
  const enumDeclarationEndLine = findEnumDeclarationEndLine(document, enumDeclareStartLine);
  const enumName = extractEnumName(document.lineAt(enumDeclareStartLine).text);
  if (enumDeclarationEndLine <= enumDeclareStartLine
                        || enumDeclarationEndLine === -1) { 
    return [undefined, undefined]; 
  } // protect guard

  for (let line = enumDeclareStartLine + 1; line <= enumDeclarationEndLine; line++) {
    const lineText = document.lineAt(line).text.trim();
    // handle comments
    if (startsWithComment(lineText)) { continue; }

    const match = lineText.match(/^(\w+)\s*(?:=\s*)?(.*)/);
    if (!match) { continue; }

    const currentMemberName = match[1];
    const currentValue = match[2].trim();

    if (!currentValue && memberValue === targetValue) {
      memberValue = memberValue < 0 ? 0 : memberValue + 1;
    } else if (currentValue === ',') {
      memberValue = memberValue < 0 ? 0 : memberValue + 1;
    } else if (Number(tryGetNumber(currentValue))) {
      memberValue = parseEnumMemberValue(currentValue);
    } else {  // handle currentValue assign as Enum Name
      let searchKey = removeStringAfterCommas(currentValue);
      let keyFind = keyMap.has(searchKey) ? keyMap.get(searchKey) : 0;
      memberValue = keyFind ? keyFind : 0;
    }

    // if finding match member Return
    if (memberValue === targetValue) {
      return [currentMemberName, line];
    }

    // store key
    keyMap.set(currentMemberName, memberValue);
  }

  return [undefined, undefined];
}
