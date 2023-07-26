"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const mathjs_1 = require("mathjs");
function activate(context) {
    console.log('Congratulations, your extension "enum-member-counter" is now active!');
    const config = vscode.workspace.getConfiguration('enumMemberCounter');
    let displayFormats = config.get('displayFormat') || ["Dec"];
    let color = config.get('color') || "#d5e39d";
    let disposable = vscode.languages.registerHoverProvider(['cpp', 'c'], {
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
                    markdownContent.appendMarkdown(`<span style="color:${color};">${numFormOutput}</span>`);
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
                    const [memberName, memberLine] = findEnumMemberName(document, position, (0, mathjs_1.evaluate)(value));
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
                    }
                    else {
                        vscode.window.showWarningMessage(`No matching enum member found for value: ${value}`);
                    }
                }
                else {
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
            displayFormats = newConfig.get('displayFormat') || ["Dec"];
            color = newConfig.get('color') || "#d5e39d";
        }
    });
}
exports.activate = activate;
function isEnumMember(document, word) {
    // Customize this condition based on your desired criteria for identifying enum members
    return /^[A-Za-z_]\w*$/.test(word);
}
function getEnumMemberValue(document, position) {
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
function findEnumDeclarationStartLine(document, line) {
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
function extractEnumName(lineText) {
    const match = lineText.match(/enum\s+(\w+)/);
    return match ? match[1] : undefined;
}
function extractEnumMemberName(lineText) {
    // const match = lineText.match(/[A-Za-z_]\w+/);
    const match = lineText.match(/[A-Za-z_]\w*/);
    return match ? match[0] : undefined;
}
function findEnumMemberValue(document, startLine, memberName) {
    const enumDeclarationEndLine = findEnumDeclarationEndLine(document, startLine);
    if (enumDeclarationEndLine > startLine && enumDeclarationEndLine !== -1) {
        let memberValue = -1;
        let hasReachedMember = false;
        let keyMap = new Map();
        for (let line = startLine + 1; line < enumDeclarationEndLine; line++) {
            const lineText = document.lineAt(line).text.trim();
            // handle comments
            if (startsWithComment(lineText)) {
                continue;
            }
            const match = lineText.match(/^(\w+)\s*(?:=\s*)?(.*)/);
            if (match) {
                const currentMemberName = match[1];
                const currentValue = match[2].trim();
                // if (!currentValue) {
                //   continue;
                // }
                if (!currentValue && currentMemberName === memberName) {
                    memberValue = memberValue < 0 ? 0 : memberValue + 1;
                }
                else if (currentValue === ',') {
                    // hasReachedMember = true;
                    memberValue = memberValue < 0 ? 0 : memberValue + 1;
                    // memberValue = memberValue + 1;
                }
                else if (Number(tryGetNumber(currentValue))) {
                    memberValue = parseEnumMemberValue(currentValue);
                }
                else { // handle currentValue assign as Enum Name
                    let searchKey = removeStringAfterCommas(currentValue);
                    let keyFind = keyMap.has(searchKey) ? keyMap.get(searchKey) : 0;
                    memberValue = keyFind ? keyFind : 0;
                }
                // if finding match member Return
                if (currentMemberName === memberName) {
                    return memberValue;
                }
                // store key
                keyMap.set(currentMemberName, memberValue);
            }
        }
    }
    return -1;
}
function removeStringAfterCommas(input) {
    return input.split(',')[0];
}
function findEnumDeclarationEndLine(document, startLine) {
    const lineCount = document.lineCount;
    for (let line = startLine + 1; line < lineCount; line++) {
        const lineText = document.lineAt(line).text.trim();
        if (lineText.includes('}')) {
            return line;
        }
    }
    return -1;
}
function parseEnumMemberValue(value) {
    // Handle hexadecimal and decimal values
    return evaluateFormula(value);
}
function startsWithComment(input) {
    const trimmedInput = input.trim(); // Remove leading and trailing spaces
    return /^(\/\/|\*|\/)/.test(trimmedInput);
}
function containsEnumDeclaration(input) {
    return /\benum\s+\w*\s*{/.test(input);
}
function numberToHex(num) {
    return `0x${num.toString(16).toUpperCase()}`;
}
function tryGetNumber(formula) {
    try {
        // 使用 eval 函数求值
        let pureFormula = removeStringAfterCommas(formula);
        return (0, mathjs_1.evaluate)(pureFormula);
    }
    catch (error) {
        // console.error('公式求值出错:', error);
        return 'undefined';
    }
}
function evaluateFormula(formula) {
    let pureFormula = removeStringAfterCommas(formula);
    try {
        // 使用 eval 函数求值
        return (0, mathjs_1.evaluate)(pureFormula);
    }
    catch (error) {
        // console.error('公式求值出错:', error);
        return 0;
    }
}
function numberBaseConverter(enumMemberValue, displayFormats) {
    let formattedOutput = "";
    displayFormats.forEach((displayFormat) => {
        let formattedValue;
        switch (displayFormat) {
            case "Dec":
                formattedValue = enumMemberValue.toString();
                break;
            case "Hex":
                formattedValue = numberToHex(enumMemberValue);
                break;
            case "Bin": // Convert to binary
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
function findEnumMemberName(document, position, targetValue) {
    // Loop from the cursor position line towards the start of document
    const lineCursor = position.line;
    // const currentLine = document.lineAt(lineCursor).text;
    let memberValue = -1;
    let keyMap = new Map();
    let enumDeclareStartLine = findEnumDeclarationStartLine(document, lineCursor);
    if (enumDeclareStartLine === -1) {
        return [undefined, undefined];
    } // protect guard
    const enumDeclarationEndLine = findEnumDeclarationEndLine(document, enumDeclareStartLine);
    const enumName = extractEnumName(document.lineAt(enumDeclareStartLine).text);
    if (enumDeclarationEndLine <= enumDeclareStartLine
        || enumDeclarationEndLine === -1) {
        return [undefined, undefined];
    } // protect guard
    for (let line = enumDeclareStartLine + 1; line <= enumDeclarationEndLine; line++) {
        const lineText = document.lineAt(line).text.trim();
        // handle comments
        if (startsWithComment(lineText)) {
            continue;
        }
        const match = lineText.match(/^(\w+)\s*(?:=\s*)?(.*)/);
        if (!match) {
            continue;
        }
        const currentMemberName = match[1];
        const currentValue = match[2].trim();
        if (!currentValue &&
            (memberValue < 0 ? 0 : memberValue + 1) === targetValue) {
            memberValue = memberValue < 0 ? 0 : memberValue + 1;
        }
        else if (currentValue === ',') {
            memberValue = memberValue < 0 ? 0 : memberValue + 1;
        }
        else if (Number(tryGetNumber(currentValue))) {
            memberValue = parseEnumMemberValue(currentValue);
        }
        else { // handle currentValue assign as Enum Name
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
    return [undefined, undefined]; // None
}
//# sourceMappingURL=extension.js.map