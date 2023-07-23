import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "enum-member-counter" is now active!');

  let disposable = vscode.languages.registerHoverProvider('cpp', {
    provideHover(document, position, token) {
      const wordRange = document.getWordRangeAtPosition(position);
      const word = document.getText(wordRange);
      console.log('Hover triggered for word:', word);

      // Check if the word is an enum member
      if (isEnumMember(document, word)) {
        const enumMemberValue = getEnumMemberValue(document, position);
        if (enumMemberValue) {
          console.log('enumMemberValue:', enumMemberValue);
          return new vscode.Hover(enumMemberValue.toString());
        }
      }

      return null;
    },
  });

  context.subscriptions.push(disposable);
}

function isEnumMember(document: vscode.TextDocument, word: string): boolean {
  // Customize this condition based on your desired criteria for identifying enum members
  return /^[A-Za-z_]\w*$/.test(word);
}

function getEnumMemberValue(document: vscode.TextDocument, position: vscode.Position): number | undefined {
  const line = position.line;
  const currentLine = document.lineAt(line).text;

  let enumDeclarationStartLine = findEnumDeclarationStartLine(document, line);
  if (enumDeclarationStartLine !== -1) {
    const enumName = extractEnumName(document.lineAt(enumDeclarationStartLine).text);
    const enumMemberName = extractEnumMemberName(currentLine);

    if (enumName && enumMemberName) {
      const enumMemberValue = findEnumMemberValue(document, enumDeclarationStartLine, enumMemberName);
      if (enumMemberValue !== -1) {
        return enumMemberValue;
      }
    }
  }

  return undefined;
}

function findEnumDeclarationStartLine(document: vscode.TextDocument, line: number): number {
  while (line >= 0) {
    const lineText = document.lineAt(line).text;

    if (lineText.includes('enum')) {
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
  const match = lineText.match(/[A-Za-z_]\w+/);
  return match ? match[0] : undefined;
}

function findEnumMemberValue(document: vscode.TextDocument, startLine: number, memberName: string): number {
  const enumDeclarationEndLine = findEnumDeclarationEndLine(document, startLine);
  if (enumDeclarationEndLine > startLine && enumDeclarationEndLine !== -1) {
    for (let line = startLine + 1; line < enumDeclarationEndLine; line++) {
      const lineText = document.lineAt(line).text.trim();
      const match = lineText.match(/^(\w+)\s*=\s*([^,]+)/);

      if (match && match[1] === memberName) {
        return parseEnumMemberValue(match[2]);
      }
    }
  }

  return -1;
}

function findEnumDeclarationEndLine(document: vscode.TextDocument, startLine: number): number {
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
  return value.startsWith('0x') ? parseInt(value, 16) : parseInt(value);
}